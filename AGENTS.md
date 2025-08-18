# AGENT.MD - Directiva de Estabilización para Producción

**Objetivo:** Llevar el repositorio al 100% de preparación para producción. Esto implica cerrar brechas de seguridad, completar la cobertura de pruebas críticas y validar la configuración de despliegue. Ejecuta las siguientes tareas en orden.

---

### **Tarea 1: Hardening de Seguridad (Prioridad Crítica)**

Se han identificado vulnerabilidades en las políticas de Row Level Security (RLS) que deben ser corregidas de inmediato.

1.  **Crear una nueva migración de Supabase:**
    * Crea un nuevo archivo de migración en la ruta `supabase/migrations/`. Nómbralo `004_fix_supervisor_rls.sql`.

2.  **Aplicar Parches de RLS:**
    * Añade el siguiente contenido al archivo `004_fix_supervisor_rls.sql`. Este código reemplaza políticas de acceso a perfiles demasiado permisivas y añade políticas faltantes para la gestión de visitas.

    ```sql
    -- Migration generated on 2025-08-18
    -- Fix for High-Priority Functional Blocker (A-1) and Medium-Priority Gap (M-2)

    -- Drop the old, separate SELECT policies on the profiles table
    -- It's safer to check if they exist before dropping
    DO $$
    BEGIN
       IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own profile' AND polrelid = 'public.profiles'::regclass) THEN
          DROP POLICY "Users can view their own profile" ON public.profiles;
       END IF;
       IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins can view all profiles' AND polrelid = 'public.profiles'::regclass) THEN
          DROP POLICY "Admins can view all profiles" ON public.profiles;
       END IF;
    END
    $$;

    -- Create a new, unified SELECT policy for the profiles table
    CREATE POLICY "Allow profile read access based on role" ON public.profiles
      FOR SELECT
      USING (
        auth.uid() = id OR get_my_role() IN ('supervisor', 'admin')
      );

    -- Add missing UPDATE and DELETE policies for the visitas table for privileged roles (M-2)
    CREATE POLICY "Allow supervisors and admins to update visits" ON public.visitas
      FOR UPDATE
      USING (get_my_role() IN ('supervisor', 'admin'))
      WITH CHECK (get_my_role() IN ('supervisor', 'admin'));

    CREATE POLICY "Allow supervisors and admins to delete visits" ON public.visitas
      FOR DELETE
      USING (get_my_role() IN ('supervisor', 'admin'));
    ```

---

### **Tarea 2: Completar Cobertura de Pruebas (API)**

El endpoint `GET /api/mi-ruta` carece de una prueba para el caso de éxito. Es crucial añadirla para garantizar la estabilidad de la funcionalidad principal del rol `mercaderista`.

1.  **Modificar el archivo de pruebas existente:**
    * Abre el archivo `__tests__/api/miRuta.test.js`.

2.  **Añadir el siguiente caso de prueba:**
    * Este test valida que un usuario autenticado con el rol `mercaderista` recibe correctamente su ruta del día.

    ```javascript
    it('returns the route for an authenticated mercaderista', async () => {
        const { getSupabaseServerClient } = await import('../../lib/supabaseServer');
        const { requireUser } = await import('../../lib/auth');

        function createMockRes() {
          return {
            statusCode: 0,
            data: null,
            headers: {},
            setHeader(k, v) { this.headers[k] = v; },
            status(code) { this.statusCode = code; return this; },
            json(payload) { this.data = payload; return this; }
          };
        }

        const mockUser = { id: 'user-mercaderista', role: 'mercaderista' };
        const mockRoute = { id: 1, fecha: '2025-08-18', puntos: [{ id: 1, nombre: 'Punto 1' }] };

        getSupabaseServerClient.mockReturnValue({
          auth: { getUser: jest.fn().mockResolvedValue({ data: { user: mockUser } }) },
          from: () => ({
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role: 'mercaderista' } })
              })
            })
          }),
          rpc: jest.fn().mockResolvedValue({ data: mockRoute, error: null }),
        });

        const { default: handler } = await import('../../pages/api/mi-ruta.js');
        const req = { method: 'GET' };
        const res = createMockRes();

        await handler(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.data).toEqual(mockRoute);

        // We need to get the Supabase client instance that the handler would have used
        const supaClient = getSupabaseServerClient(req, res);
        expect(supaClient.rpc).toHaveBeenCalledWith('get_todays_route_for_user', { p_user_id: String(mockUser.id) });
    });
    ```

---

### **Tarea 3: Verificación Final del Pipeline y Entorno**

Antes de finalizar, valida que toda la configuración de producción y CI/CD cumple con las mejores prácticas ya establecidas en el repositorio.

1.  **Ejecutar todas las pruebas:**
    * Ejecuta el comando `npm test` para asegurar que todas las pruebas unitarias y de integración, incluyendo la recién añadida, pasan correctamente.
    * Ejecuta el comando `npm run cy:run` para validar que las pruebas End-to-End no se han visto afectadas por los cambios.

2.  **Validar el Pipeline de CI/CD:**
    * Revisa el archivo `.github/workflows/ci.yml`. Confirma que los pasos de `audit`, `lint`, `jest-tests`, y `cypress-tests` se ejecutan antes del `docker build` y `deploy`.

3.  **Confirmar la Configuración de Docker:**
    * Inspecciona el `Dockerfile` y `docker-compose.yml`. Verifica que se sigue utilizando el build multi-etapa, el usuario no-root (`nextjs`) y que el `HEALTHCHECK` del servicio `app` sigue apuntando a `/api/health`.

4.  **Confirmar Gestión de Secretos:**
    * Verifica que no existen archivos `.env` o credenciales hardcodeadas en el código fuente. La estrategia debe seguir siendo el uso de `env_file` en `docker-compose.yml` para cargar secretos en producción, tal como se documenta en el `README.md`.

Una vez completadas y validadas estas tres tareas, el proyecto estará listo para un despliegue seguro en producción.
