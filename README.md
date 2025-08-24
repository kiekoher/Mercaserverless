# Optimizador de Rutas para Mercaderistas

## Descripción

Esta aplicación web está diseñada para digitalizar y optimizar el proceso de planificación de rutas para equipos de mercaderistas. La solución permite a los supervisores crear, asignar y gestionar rutas, mientras que los mercaderistas pueden visualizar sus rutas diarias y registrar sus visitas en tiempo real.

Este proyecto fue desarrollado como parte de una iniciativa para Kimberly-Clark y Manpower.

## Funcionalidades Principales

- **Autenticación de Usuarios:** Sistema de inicio y cierre de sesión para supervisores y mercaderistas, gestionado con Supabase Auth.
- **Gestión de Puntos de Venta (PDV):** Interfaz para la creación, visualización y gestión de puntos de venta, incluyendo la importación masiva desde archivos CSV.
- **Planificación y Gestión de Rutas:** Herramientas para que los supervisores creen rutas diarias, asignando un mercaderista y una selección de puntos de venta.
- **Vista de Ruta del Mercaderista:** Interfaz optimizada para móviles donde el mercaderista puede ver su ruta del día, registrar check-in/check-out y añadir observaciones.
- **Asistente de IA:** Funcionalidades que utilizan modelos de lenguaje (Google Gemini) para generar resúmenes y análisis de las rutas, ayudando a los supervisores a obtener insights sobre la operación.

## Stack Tecnológico

- **Framework:** [Next.js](https://nextjs.org/)
- **Lenguaje:** JavaScript con React
- **Backend y Base de Datos:** [Supabase](https://supabase.io/)
- **IA / LLM:** [Google Gemini API](https://ai.google.dev/)
- **Cache y Rate Limiting:** [Upstash Redis](https://upstash.com/)
- **Testing:** [Jest](https://jestjs.io/) para pruebas unitarias y [Cypress](https://www.cypress.io/) para E2E.
- **Estilos:** CSS plano (inline y global)

## Decisiones Arquitectónicas

### Almacenamiento de Puntos de Venta en Rutas

Durante el diseño del esquema de la base de datos, se tomó la decisión de almacenar los IDs de los puntos de venta de una ruta como un array de enteros (`BIGINT[]`) en la tabla `rutas`.

- **Ventaja:** Este enfoque desnormalizado simplifica las consultas de lectura para obtener una ruta completa y sus puntos, evitando la necesidad de un `JOIN` con una tabla intermedia. Para el caso de uso principal de la aplicación (mostrar la ruta del día de un mercaderista), esto es muy eficiente.
- **Desventaja:** Complica las consultas inversas (p. ej., encontrar todas las rutas que incluyen un punto de venta específico).
- **Conclusión:** Para la fase actual del proyecto, la eficiencia en la lectura de rutas se consideró prioritaria. Si en el futuro surgen necesidades de consulta más complejas, se podría considerar una refactorización a un esquema normalizado con una tabla de unión (`ruta_puntos_de_venta`).

## Seguridad y Operaciones

El proyecto ha sido desarrollado con un fuerte enfoque en la seguridad y la operabilidad, siguiendo las mejores prácticas para aplicaciones web modernas.

- **Seguridad a Nivel de Aplicación:** Se implementa una estricta Política de Seguridad de Contenido (CSP) y protección contra CSRF a través de middleware para mitigar ataques comunes.
- **Seguridad de Datos:** El acceso a los datos está controlado por políticas de Row Level Security (RLS) en Supabase, asegurando que los usuarios solo puedan acceder a la información que les corresponde.
- **Guía de Operaciones:** Para procedimientos detallados sobre monitoreo, configuración de alertas, rotación de secretos y planes de recuperación ante desastres, consulte la [**Guía Operacional (OPERATIONS.md)**](./OPERATIONS.md).

## Cómo Empezar

Sigue estos pasos para configurar y ejecutar el proyecto en tu máquina local para desarrollo.

### Prerrequisitos

Asegúrate de tener instalado [Node.js](https://nodejs.org/) en su versión 20.x.

### Configuración Local

1.  **Clona el repositorio**.

2.  **Crea el archivo de variables de entorno:**
    Copia el archivo de ejemplo `.env.example` y renómbralo a `.env`.
    ```bash
    cp .env.example .env
    ```
    Luego, rellena las variables con tus propias credenciales de desarrollo. Este archivo es solo para desarrollo local y no debe subirse al repositorio.

3.  **Instala las dependencias del proyecto:**
    ```bash
    npm install
    ```

4.  **Ejecuta el servidor de desarrollo:**
    ```bash
    npm run dev
    ```
    Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.

### Compilación Local de Producción

Para reproducir el proceso de compilación con variables de entorno ficticias, ejecuta:
```bash
npm run build:local
```
Esto permite validar el build antes de desplegar.

### Ejecución de Pruebas

Para correr las pruebas unitarias y de componentes, ejecuta:
```bash
npm test
```
Para las pruebas de extremo a extremo (E2E), utiliza Cypress:
```bash
npm run cy:run
```
Para verificar el estilo del código, puedes ejecutar:
```bash
npm run lint
```
Este comando utiliza variables de entorno de `.env.test`.

## Despliegue y Arquitectura Serverless

Este proyecto está diseñado para una arquitectura 100% serverless utilizando **Vercel** para el despliegue y servicios gestionados en la nube.

### Despliegue en Vercel

La aplicación se despliega automáticamente en Vercel con cada `push` a la rama `main`. Vercel se encarga de la compilación, el despliegue y la escalabilidad de la aplicación Next.js.

### Gestión de Variables de Entorno en Producción

Todas las variables de entorno requeridas por la aplicación (ver `.env.example`) deben ser configuradas directamente en el **panel de control de Vercel** para el proyecto correspondiente. Esto incluye:
- Credenciales de Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`).
- Claves de API para servicios externos (`GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`).
- URL del servicio de Redis. Se soporta la conexión REST de Upstash mediante `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` o el URL clásico `UPSTASH_REDIS_URL`.
- Token del servicio de logging (`LOGTAIL_SOURCE_TOKEN`).
- Tiempo máximo de espera para la API de IA (`AI_TIMEOUT_MS`).
- Control de *fail-open* para el rate limiter (`RATE_LIMIT_FAIL_OPEN`, por defecto `true`; establecer en `false` en producción para forzar bloqueo si Redis falla).
- Bypass de autenticación para pruebas (`NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS`, mantener en `false` en producción).

No se debe utilizar el archivo `.env` en el entorno de producción.

### Servicios en la Nube

- **Rate Limiting:** Se utiliza un servicio de Redis serverless como [Upstash](https://upstash.com/) para gestionar el límite de peticiones a la API.
- **Logging:** Los logs de la aplicación son enviados a un servicio de logging externo como [Logtail](https://logtail.com/) para su centralización y análisis.

### Seguridad y sanitización

Los campos de texto enviados por los usuarios se procesan con la función `sanitizeInput` para eliminar etiquetas HTML y saltos de línea antes de almacenarlos. Esta mitigación reduce riesgos de inyección, pero se recomienda combinarla con validaciones adicionales según el contexto de uso.

