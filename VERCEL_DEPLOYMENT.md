# Guía de Despliegue y Configuración de Entornos en Vercel

Esta guía detalla los pasos para configurar correctamente los entornos de despliegue (`Production`, `Preview`, `Development`) para este proyecto en Vercel. Una configuración de entorno adecuada es crítica para la seguridad y la estabilidad de la aplicación.

## Paso 0: Conectar el Repositorio a Vercel (Configuración Inicial)

Antes de poder gestionar variables de entorno, debes conectar este repositorio de GitHub a un proyecto en Vercel. Este es un proceso que solo se hace una vez.

1.  **Crear un Nuevo Proyecto en Vercel:**
    - Ve a tu [dashboard de Vercel](https://vercel.com/dashboard).
    - Haz clic en "Add New..." > "Project".
2.  **Importar Repositorio Git:**
    - En la sección "Import Git Repository", selecciona este repositorio de tu cuenta de GitHub.
3.  **Configurar el Proyecto:**
    - Vercel detectará automáticamente que es un proyecto de Next.js y pre-configurará la mayoría de las opciones.
    - **No es necesario** cambiar el "Build Command" (`next build`) ni el "Output Directory".
    - **No es necesario** configurar las variables de entorno en este paso. Lo haremos después, como se describe a continuación.
4.  **Desplegar:**
    - Haz clic en "Deploy". Vercel realizará el primer despliegue. Fallará si las variables de entorno no están configuradas, lo cual es esperado.

Una vez que el proyecto esté creado en Vercel, puedes proceder con la configuración de los entornos y las variables.

---

## Paso 1: Configuración de Entornos en Vercel

Vercel permite asignar variables de entorno a tres ambientes distintos:

1.  **Production:** El entorno en vivo. Se activa con los `git push` a la rama `main`.
2.  **Preview:** Entornos de pre-producción o staging. Se activan para cada `pull request` y `push` a ramas que no sean `main`.
3.  **Development:** El entorno de desarrollo local, sincronizado con el CLI de Vercel (`vercel dev`).

Para configurar las variables, ve al dashboard de tu proyecto en Vercel y navega a **Settings > Environment Variables**.

## Paso 2: Configuración de Variables de Entorno

Debes añadir cada una de las siguientes variables en el dashboard de Vercel. Para cada variable, puedes elegir a qué entornos se aplica.

### Variables de Infraestructura y APIs (Secretos)

Estas variables son sensibles y deben ser tratadas como secretos.

| Variable | Entorno(s) | Descripción y Valor Recomendado |
| :--- | :--- | :--- |
| `SUPABASE_SERVICE_KEY` | `Production`, `Preview` | **[SECRETO]** La clave de servicio de Supabase. **Usa una clave de un proyecto de Supabase de producción para `Production` y una de un proyecto de staging/dev para `Preview`.** |
| `GEMINI_API_KEY` | `Production`, `Preview` | **[SECRETO]** La clave de API para Google Gemini. |
| `GOOGLE_MAPS_API_KEY` | `Production`, `Preview` | **[SECRETO]** La clave de API para Google Maps Geocoding. |
| `UPSTASH_REDIS_REST_URL` | `Production`, `Preview` | **[SECRETO]** La URL del endpoint de tu base de datos de Upstash Redis. **Usa una BD de producción para `Production` y una de staging/dev para `Preview`.** |
| `UPSTASH_REDIS_REST_TOKEN`| `Production`, `Preview` | **[SECRETO]** El token de autorización para tu base de datos de Upstash Redis. |
| `LOGTAIL_SOURCE_TOKEN` | `Production`, `Preview` | **[SECRETO]** El token de origen para tu servicio de logging (Logtail/Better Stack). |
| `HEALTHCHECK_TOKEN` | `Production`, `Preview` | **[SECRETO]** Un token seguro y aleatorio que generarás tú mismo. Úsalo para acceder al endpoint de health check. |
| `RESEND_API_KEY` | `Production`, `Preview` | **[SECRETO]** La clave de API del servicio de envío de correos Resend, necesaria para las invitaciones y notificaciones. |

**Nota sobre `Development`:** Para el desarrollo local, Vercel CLI (`vercel dev`) puede descargar estas variables. También puedes mantenerlas en un archivo `.env.local` (que está en `.gitignore`) para trabajar offline.

### Variables Públicas de Next.js

Estas variables son accesibles desde el navegador.

| Variable | Entorno(s) | Descripción y Valor Recomendado |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | `Production`, `Preview` | La URL de tu proyecto de Supabase. **Asegúrate de que coincida con el proyecto correspondiente al entorno (prod/staging).** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `Production`, `Preview` | La clave anónima pública de tu proyecto de Supabase. **Asegúrate de que coincida con el proyecto correspondiente.** |
| `NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS` | `Development` | Pon a `true` solo para el entorno local (`Development`) si necesitas saltarte la autenticación para pruebas específicas. En `Production` y `Preview` debe ser `false` o no estar definida. |

### Variables de Configuración de la Aplicación

Estas variables controlan el comportamiento de la aplicación.

| Variable | Entorno(s) | Descripción y Valor Recomendado |
| :--- | :--- | :--- |
| `LOG_LEVEL` | `Production`, `Preview`, `Development` | Nivel de logs. **Recomendado: `info` para `Production`, `debug` para `Preview` y `Development`.** |
| `AI_TIMEOUT_MS` | `Production`, `Preview`, `Development` | Timeout para las llamadas a la API de IA. Valor por defecto: `10000`. |
| `RATE_LIMIT_FAIL_OPEN` | `Production`, `Preview`, `Development` | **Recomendado: `false` para todos los entornos.** Si `true`, el rate limiter permitiría el paso de peticiones si Redis falla, lo cual es un riesgo. |
| `GEOCODE_TIMEOUT_MS` | `Production`, `Preview`, `Development` | Timeout para la geocodificación. Valor por defecto: `1000`. |
| `GEOCODE_RETRIES` | `Production`, `Preview`, `Development` | Reintentos de geocodificación. Valor por defecto: `3`. |
| `GEOCODE_CONCURRENCY` | `Production`, `Preview`, `Development` | Concurrencia de geocodificación. Valor por defecto: `5`. |
| `GEOCODE_RETRY_BASE_MS` | `Production`, `Preview`, `Development` | Tiempo base para reintentos. Valor por defecto: `100`. |

---

Al seguir esta guía, asegurarás una separación limpia y segura de tus entornos, lo cual es una práctica fundamental para un despliegue en producción robusto.
