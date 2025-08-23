# Informe de Auditoría y Plan de Acción para Producción

**Proyecto:** Optimizador de Rutas para Mercaderistas
**Fecha de Auditoría:** 2025-08-23
**Auditor:** Jules, Arquitecto de Software y SRE Principal

## A. Resumen Ejecutivo

El proyecto "Optimizador de Rutas para Mercaderistas" se encuentra en un estado de madurez técnica notablemente alto. La base del código es de alta calidad, con una arquitectura bien definida en Next.js, un conjunto de pruebas robusto (unitarias y E2E) y un pipeline de CI/CD en GitHub Actions que automatiza la validación de la calidad del código. Las decisiones de diseño, como el uso de un middleware para las cabeceras de seguridad y la validación de entorno con Zod, demuestran un enfoque proactivo hacia la seguridad y la robustez.

Sin embargo, antes de esta auditoría, existían dos áreas de riesgo principal que comprometían una transición segura a producción. El **riesgo más crítico** era la dependencia de las capas de servicio gratuitas (`free tier`) para servicios fundamentales como la base de datos (Supabase) y la caché/rate-limiter (Upstash), lo que garantizaba problemas de fiabilidad, escalabilidad y posibles pérdidas de datos. El **segundo riesgo de alta prioridad** era la falta de observabilidad transaccional; aunque existía logging de errores, no había un sistema de trazabilidad estructurado para monitorear el flujo de peticiones, su duración y su contexto, lo que dificultaría enormemente la depuración de problemas en producción.

Esta auditoría ha abordado directamente estos puntos. Se ha consolidado la infraestructura para un despliegue exclusivo en Vercel, se ha implementado un sistema de logging estructurado en toda la API y se ha fortalecido la configuración de seguridad del entorno. El plan de acción detalla los pasos finales que el equipo debe tomar, principalmente a nivel de configuración de servicios externos, para asegurar un lanzamiento exitoso y sostenible.

## B. Plan de Acción Priorizado

A continuación se detallan los hallazgos identificados durante la auditoría y las acciones tomadas o recomendadas.

---

### Prioridad: Crítico
*   **Descripción del Problema:** El proyecto está configurado para utilizar los planes gratuitos de Supabase y Upstash Redis.
*   **Riesgo Asociado:**
    *   **Supabase (Free):** Los proyectos inactivos por más de una semana son pausados automáticamente, lo que causaría una interrupción total del servicio. No se incluyen backups automáticos, solo recuperación puntual (PITR) limitada, arriesgando la pérdida de datos. Los límites de la API son bajos y no hay soporte dedicado.
    *   **Upstash (Free):** Tiene un límite diario muy bajo de comandos (10,000) que puede ser fácilmente excedido por 50 usuarios, desactivando el rate limiting y potencialmente otras funcionalidades de caché. No ofrece garantía de servicio (SLA).
*   **Solución Aplicada/Recomendada:** **(Acción Requerida por el Equipo)** Se recomienda encarecidamente actualizar a planes de pago antes del despliegue. Las soluciones detalladas se encuentran en la sección C.

---

### Prioridad: Alto

*   **Descripción del Problema:** Ausencia de logging estructurado y transaccional en las rutas de la API. Solo se registraban errores de forma aislada, sin contexto de la petición (usuario, duración, status code).
*   **Riesgo Asociado:** Imposibilidad de depurar problemas de rendimiento, identificar patrones de error o auditar la actividad de los usuarios de manera efectiva en un entorno de producción. El tiempo medio de resolución (MTTR) de incidentes sería extremadamente alto.
*   **Solución Aplicada/Recomendada:** **(Solucionado)** Se implementó un wrapper de logging (`withLogging`) que se aplicó a todas las rutas de la API. Ahora, cada petición registra su inicio y fin con contexto enriquecido.

*   **Descripción del Problema:** La validación de variables de entorno, aunque robusta, permitía que ciertas variables críticas para la seguridad y la observabilidad fueran opcionales en producción.
*   **Riesgo Asociado:** Un despliegue accidental sin configurar el token de logging o el token del health check podría dejar al sistema sin monitoreo o con endpoints de servicio expuestos.
*   **Solución Aplicada/Recomendada:** **(Solucionado)** Se modificó el archivo `lib/env.server.js` para que `LOGTAIL_SOURCE_TOKEN` y `HEALTHCHECK_TOKEN` sean obligatorios en el entorno de producción. Además, se añadió una regla para prohibir explícitamente que `RATE_LIMIT_FAIL_OPEN` sea `true` en producción.

---

### Prioridad: Medio

*   **Descripción del Problema:** El repositorio contenía una doble estrategia de despliegue (Vercel y Docker/VPS), incluyendo un `Dockerfile` y un job de despliegue en el pipeline de CI/CD.
*   **Riesgo Asociado:** Aumenta la complejidad de mantenimiento y la superficie de ataque. Introduce la posibilidad de inconsistencias entre entornos y puede generar confusión en el equipo sobre cuál es la vía de despliegue oficial.
*   **Solución Aplicada/Recomendada:** **(Solucionado)** Se eliminaron el `Dockerfile`, `.dockerignore` y el job de despliegue en VPS del workflow de GitHub Actions. La documentación (`README.md`, `OPERATIONS.md`) fue actualizada para reflejar que Vercel es el único entorno de despliegue soportado.

---

### Prioridad: Bajo

*   **Descripción del Problema:** El proyecto carecía de un manual de directrices para agentes de IA como Jules.
*   **Riesgo Asociado:** Dificulta la colaboración efectiva con herramientas de IA, resultando en contribuciones de menor calidad o que no se adhieren a las convenciones del proyecto.
*   **Solución Aplicada/Recomendada:** **(Solucionado)** Se creó el archivo `AGENT.md` en la raíz del proyecto con el contenido proporcionado por el usuario, estableciendo un estándar para la interacción de agentes de IA con el repositorio.

## C. Soluciones Detalladas y Desarrollo de Características

### 1. Logging Estructurado con un Wrapper (HOF)

Para resolver la falta de observabilidad, se creó una función de orden superior (HOF) en `lib/api-logger.js` que envuelve cada manejador de la API.

**`lib/api-logger.js`:**
```javascript
import logger from './logger.server';
import { requireUser } from './auth';

export function withLogging(handler) {
  return async function (req, res) {
    const startTime = Date.now();
    const { method, url: path } = req;
    const { user } = await requireUser(req, res); // Non-blocking, for context

    logger.info({
      req: { method, path },
      user: { id: user?.id },
    }, `[API] Request received: ${method} ${path}`);

    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
      const duration = Date.now() - startTime;
      logger.info({
        req: { method, path },
        res: { statusCode: res.statusCode },
        user: { id: user?.id },
        duration,
      }, `[API] Request finished: ${method} ${path} -> ${res.statusCode} in ${duration}ms`);
      res.end = originalEnd;
      res.end(chunk, encoding);
    };

    try {
      await handler(req, res);
    } catch (error) {
      // ... (manejo de errores no capturados)
    }
  };
}
```
**Aplicación en una ruta (`pages/api/users.js`):**
```javascript
// ... (imports)
import { withLogging } from '../../lib/api-logger';

async function handler(req, res) {
  // ... lógica del endpoint
  if (error) {
    throw error; // El wrapper se encarga de loguear el error
  }
  // ...
}

export default withLogging(handler); // Se exporta el manejador envuelto
```

### 2. Robustecimiento de la Validación de Entorno

Se modificó `lib/env.server.js` para que las variables de entorno críticas sean obligatorias en producción y para forzar una configuración segura del rate limiter.

**`lib/env.server.js` (extracto):**
```javascript
// ... (esquema base)

const productionServerSchema = baseServerSchema
  .extend({
    LOGTAIL_SOURCE_TOKEN: z.string().min(1, { message: 'LOGTAIL_SOURCE_TOKEN is required in production.' }),
    HEALTHCHECK_TOKEN: z.string().min(1, { message: 'HEALTHCHECK_TOKEN is required in production.' }),
  })
  .refine((env) => env.RATE_LIMIT_FAIL_OPEN !== 'true', {
    path: ['RATE_LIMIT_FAIL_OPEN'],
    message: 'RATE_LIMIT_FAIL_OPEN must not be true in production.',
  });

// ... (lógica para seleccionar el esquema según NODE_ENV)
```

### 3. Recomendaciones para Servicios Externos (Acción Requerida)

*   **Supabase:**
    *   **Plan Recomendado:** `Pro Plan` (aprox. $25/mes).
    *   **Justificación:** Elimina el riesgo de que el proyecto sea pausado por inactividad, proporciona backups diarios automáticos, aumenta significativamente los límites de la API y ofrece soporte por email. Es el requisito mínimo para cualquier aplicación en producción.
*   **Upstash Redis:**
    *   **Plan Recomendado:** `Pay-as-you-go`.
    *   **Justificación:** Elimina los límites estrictos del plan gratuito. El coste es proporcional al uso, lo que es ideal para una aplicación con una carga inicial de 50 usuarios, permitiendo escalar sin interrupciones del servicio.

## D. Checklist Final de Puesta en Producción

Siga esta lista de verificación en orden para asegurar un despliegue exitoso.

- [ ] **1. Actualizar Planes de Servicios Externos:**
    - [ ] Acceder al dashboard de Supabase y actualizar el proyecto al plan "Pro".
    - [ ] Acceder al dashboard de Upstash y actualizar la base de datos Redis al plan "Pay-as-you-go".

- [ ] **2. Configurar Variables de Entorno en Vercel:**
    - [ ] Navegar a la configuración del proyecto en Vercel.
    - [ ] Asegurarse de que todas las variables listadas en `.env.example` estén configuradas para el entorno de producción.
    - [ ] **Confirmar** que `RATE_LIMIT_FAIL_OPEN` esté ausente o establecida en `false`.
    - [ ] **Confirmar** que `NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS` esté establecida en `false`.

- [ ] **3. Configurar Alertas de Monitoreo:**
    - [ ] Acceder a Logtail (Better Stack).
    - [ ] Crear una alerta que se dispare cuando se reciban logs con `level: "error"`.
    - [ ] Crear una alerta (opcional, de menor prioridad) para `level: "warn"`.
    - [ ] Acceder a Vercel y habilitar "Vercel Analytics" para el proyecto.

- [ ] **4. Despliegue Final:**
    - [ ] Realizar un Pull Request con la rama que contiene todos estos cambios a `main`.
    - [ ] Revisar y aprobar los cambios.
    - [ ] Hacer "Merge" del Pull Request. Vercel desplegará automáticamente la nueva versión.

- [ ] **5. Verificación Post-Despliegue:**
    - [ ] Monitorear el dashboard de Vercel en busca de errores de compilación o de ejecución en las funciones serverless.
    - [ ] Revisar los logs en Logtail para confirmar que las peticiones se están registrando correctamente.
    - [ ] Realizar una prueba de humo en la aplicación en producción (iniciar sesión, ver una ruta) para confirmar que las funcionalidades clave operan como se espera.
    - [ ] Monitorear el estado de los servicios (Supabase, Upstash) en sus respectivos dashboards durante las primeras horas.
