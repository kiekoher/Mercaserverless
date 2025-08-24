# Informe de Auditoría y Plan de Acción para Producción

## A. Resumen Ejecutivo

El proyecto se encuentra en un estado de desarrollo avanzado, con una base de código bien estructurada, una arquitectura clara orientada a servicios PaaS (Vercel, Supabase, Upstash) y buenas prácticas iniciales de fiabilidad (pruebas, CI). Sin embargo, **no está listo para un despliegue en producción** debido a la presencia de **vulnerabilidades de seguridad críticas y brechas funcionales de alto impacto**. Las áreas de mayor riesgo son la ausencia total de protección contra ataques CSRF en el backend y una política de seguridad a nivel de fila (RLS) en la base de datos que permite la escalada de privilegios de usuario. Adicionalmente, la falta de paginación en las APIs principales garantiza problemas de rendimiento y estabilidad a medida que los datos crezcan. Es imperativo solucionar estos puntos antes de cualquier lanzamiento.

## B. Plan de Acción Priorizado

| Prioridad | Descripción del Problema                                                                                             | Riesgo Asociado                                                                                                                                  |
| :-------- | :------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Crítico** | **Ausencia de Verificación CSRF:** El backend no valida los tokens CSRF, aunque el frontend los envía.                 | Exposición a ataques de Cross-Site Request Forgery, permitiendo a un atacante ejecutar acciones no autorizadas en nombre de un usuario legítimo. |
| **Alto**    | **Escalada de Privilegios en RLS:** La política de actualización de perfiles no impide que un usuario modifique su propio rol. | Un usuario con rol 'mercaderista' podría auto-promocionarse a 'admin', obteniendo control total sobre la aplicación y los datos.          |
| **Alto**    | **Falta de Paginación en la API:** Los endpoints que listan datos (usuarios, rutas, PDV) devuelven todos los registros a la vez. | Agotamiento de memoria del servidor, timeouts en la API, y una experiencia de usuario inaceptable con conjuntos de datos de producción.         |
| **Medio**   | **Saneamiento de Entradas Inconsistente:** La función `sanitizeInput` no se aplica a todos los datos de entrada en la API. | Aumenta la superficie de ataque para posibles inyecciones (SQL, XSS, Prompt Injection) si otras capas de seguridad fallan.                    |

## C. Soluciones Detalladas y Desarrollo de Características

### 1. (Crítico) Implementar Verificación CSRF en el Middleware

**Problema:** El archivo `lib/csrf.js` contiene la lógica de validación, pero `middleware.js` nunca la invoca.

**Solución Técnica:** Modificar `middleware.js` para que intercepte las peticiones que modifican estado y las valide.

```javascript
// En middleware.js, importa la función de verificación
import { verifyCsrf } from './lib/csrf'; // Asumiendo que mueves csrf.js a /lib

// Dentro de la función middleware, después de la gestión de sesión y antes de los headers:
export async function middleware(req) {
  // ... (código de gestión de sesión existente)

  // --- CSRF Protection ---
  // Solo proteger rutas de API que modifican estado
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const isStateChangingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);

    // El endpoint de login de Supabase y el de health-check público no deben tener CSRF
    const isExempted = req.nextUrl.pathname.startsWith('/api/auth') ||
                       req.nextUrl.pathname === '/api/health';

    if (isStateChangingMethod && !isExempted) {
      // La función verifyCsrf ya se encarga de la respuesta en caso de error
      // Necesitamos recrear la respuesta de Next aquí si falla la verificación.
      const csrfVerified = await verifyCsrfFromMiddleware(req);
      if (!csrfVerified) {
        return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  // ... (código de security headers existente)
  return res;
}

// Es necesario adaptar verifyCsrf para que funcione en el edge middleware
// o crear una función wrapper.
async function verifyCsrfFromMiddleware(req) {
    // Lógica de verifyCsrf adaptada para el middleware...
    // (Esta es una simplificación, la implementación real requiere pasar cookies y headers)
    return true; // Placeholder para la lógica real
}
```
**Nota:** La implementación exacta requiere adaptar `verifyCsrf` para que no use `res.status().json()` directamente, sino que devuelva `true`/`false`, ya que el middleware de Next.js tiene un API de respuesta diferente.

### 2. (Alto) Prevenir Escalada de Privilegios con RLS

**Problema:** La política de `UPDATE` en la tabla `profiles` no tiene una cláusula `WITH CHECK`.

**Solución Técnica:** Crear una nueva migración de Supabase para corregir las políticas.

**a. Crear el archivo de migración:** `supabase/migrations/014_fix_profile_update_rls.sql`

**b. Contenido del archivo:**
```sql
-- supabase/migrations/014_fix_profile_update_rls.sql

-- Eliminar las políticas de actualización antiguas y permisivas en la tabla de perfiles.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Crear una política segura para que los usuarios actualicen su propio perfil.
-- La cláusula WITH CHECK impide que un usuario cambie su propio ID o rol.
CREATE POLICY "Users can update their own profile securely" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Un usuario no puede cambiar su propio rol.
    role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Crear una política para que los administradores actualicen cualquier perfil.
-- El CHECK aquí es menos restrictivo, pero podría usarse para impedir que un admin se auto-degrade.
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');
```

### 3. (Alto) Añadir Paginación a la API y Frontend

**Problema:** Endpoints como `/api/users` o `/api/puntos-de-venta` no paginan.

**Solución Técnica:** Implementar paginación `offset-limit` en el backend y controles en el frontend.

**a. Backend (Ejemplo para `/api/puntos-de-venta.js`):**

```javascript
// En el handler del método GET en /api/puntos-de-venta.js

// 1. Validar query params de paginación
const page = req.query.page ? parseInt(req.query.page, 10) : 1;
const pageSize = req.query.pageSize ? parseInt(req.query.pageSize, 10) : 20;
const { from, to } = { from: (page - 1) * pageSize, to: page * pageSize - 1 };

// 2. Modificar la consulta a Supabase
let query = supabase.from('puntos_de_venta').select('*', { count: 'exact' });
// ... (lógica de búsqueda existente) ...
query = query.range(from, to);

const { data, error, count } = await query;

// 3. Devolver datos y contador total
res.status(200).json({ data, totalCount: count });
```

**b. Frontend (Ejemplo para `pages/admin/users.js`):**

```javascript
// En el componente de React

const [page, setPage] = useState(1);
const [totalCount, setTotalCount] = useState(0);

// Al hacer fetch de los datos
const response = await fetch(`/api/users?page=${page}&pageSize=20`);
const { data, totalCount } = await response.json();
setUsers(data);
setTotalCount(totalCount);

// Renderizar el componente de paginación de MUI
<Pagination
  count={Math.ceil(totalCount / 20)}
  page={page}
  onChange={(event, value) => setPage(value)}
/>
```

### 4. (Medio) Mejorar Consistencia del Saneamiento de Entradas

**Problema:** No todos los campos de entrada son validados o saneados.

**Solución Técnica:** Auditar cada endpoint de la API y aplicar validación con `zod` o `sanitizeInput` donde corresponda.

**a. Ejemplo de mejora para `/api/rutas.js` (Crear Ruta):**

```javascript
// En el handler del método POST en /api/rutas.js

// Usar Zod para una validación estricta en lugar de saneamiento manual
const schema = z.object({
  mercaderista_id: z.string().uuid({ message: "ID de mercaderista inválido." }),
  fecha: z.string().date({ message: "Formato de fecha inválido." }),
  puntos_de_venta_ids: z.array(z.number().int().positive()).min(1, "Debe haber al menos un punto de venta.")
});

const parseResult = schema.safeParse(req.body);

if (!parseResult.success) {
  return res.status(400).json({ error: parseResult.error.flatten() });
}

const { mercaderista_id, fecha, puntos_de_venta_ids } = parseResult.data;

// Proceder con la lógica de negocio usando los datos validados...
```

## D. Checklist Final de Puesta en Producción

1.  [ ] **Crear y aplicar la migración de base de datos** para corregir la política RLS de actualización de perfiles (`014_fix_profile_update_rls.sql`).
2.  [ ] **Modificar `middleware.js`** para implementar la verificación de tokens CSRF en todas las rutas de API que modifican estado.
3.  [ ] **Refactorizar los endpoints** de `GET` para `/api/users`, `/api/rutas`, y `/api/puntos-de-venta` para que acepten parámetros de paginación (`page`, `pageSize`) y devuelvan el contador total.
4.  [ ] **Actualizar las páginas del frontend** correspondientes (`/admin/users`, `/rutas`, etc.) para incluir controles de paginación y gestionar el estado de la página actual.
5.  [ ] **Auditar y refactorizar todos los endpoints de API** que reciben datos del cliente (`POST`, `PUT`) para usar `zod` para una validación estricta de todos los campos, en lugar de `sanitizeInput` manual.
6.  [ ] **Ejecutar la suite completa de pruebas** (`npm test`, `npm run lint`, `npm run cy:run`) para asegurar que no se han introducido regresiones.
7.  [ ] **Desplegar los cambios a un entorno de Staging** en Vercel conectado a una base de datos de prueba.
8.  [ ] **Realizar una prueba de humo manual** en Staging, verificando que el login, la creación/edición de datos y la paginación funcionan como se espera.
9.  [ ] **Fusionar los cambios a la rama `main`** para desplegar a producción.
10. [ ] **Monitorear los logs en Logtail y Vercel Analytics** durante las primeras horas después del despliegue para detectar cualquier comportamiento anómalo.
11. [ ] **Verificar en el dashboard de Supabase** que las nuevas políticas de RLS están activas.
