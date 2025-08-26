# Optimizador de Rutas para Mercaderistas

## Descripción

Esta aplicación web está diseñada para digitalizar y optimizar el proceso de planificación de rutas para equipos de mercaderistas. La solución permite a los supervisores crear, asignar y gestionar rutas, mientras que los mercaderistas pueden visualizar sus rutas diarias y registrar sus visitas en tiempo real.

Este proyecto fue desarrollado como parte de una iniciativa para Kimberly-Clark y Manpower.

## Funcionalidades Principales

- **Autenticación de Usuarios:** Sistema de inicio y cierre de sesión para supervisores y mercaderistas, gestionado con Supabase Auth.
- **Gestión de Puntos de Venta (PDV):** Interfaz para la creación, visualización y gestión de puntos de venta, incluyendo la importación masiva desde archivos CSV.
- **Planificación y Gestión de Rutas:** Herramientas para que los supervisores creen rutas diarias, asignando un mercaderista y una selección de puntos de venta.
- **Vista de Ruta del Mercaderista:** Interfaz optimizada para móviles donde el mercaderista puede ver su ruta del día, registrar check-in/check-out y añadir observaciones.
- **Asistente de IA:** El panel de control del supervisor incluye dos funcionalidades de IA:
  - **Análisis de Ruta Individual:** Permite generar un análisis detallado (KPI, insight, recomendación) para una ruta específica.
  - **Resumen de Operaciones:** Una nueva herramienta que permite a los supervisores generar un resumen ejecutivo sobre el rendimiento operativo dentro de un rango de fechas y, opcionalmente, para un mercaderista específico. Analiza los datos históricos de visitas para identificar tendencias y oportunidades.

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

- **Seguridad a Nivel de Aplicación:** Se implementa una estricta Política de Seguridad de Contenido (CSP), y el middleware activa por defecto la protección contra CSRF y el *rate limiting* para mitigar ataques comunes.
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

### Configuración Local Alternativa con Docker

Para simplificar aún más el entorno de desarrollo y no depender de servicios en la nube para la base de datos y la caché, puedes usar Docker Compose.

1.  **Asegúrate de tener Docker y Docker Compose instalados.**

2.  **Inicia los servicios de base de datos y caché:**
    Desde la raíz del proyecto, ejecuta:
    ```bash
    docker-compose up -d
    ```
    Esto iniciará un contenedor de PostgreSQL y uno de Redis en segundo plano.

3.  **Configura tus variables de entorno locales:**
    Copia el archivo `.env.local.example` a `.env` y úsalo. Este archivo ya está preconfigurado para conectarse a los servicios de Docker.

4.  **Aplica las migraciones de la base de datos:**
    Para que la base de datos local tenga el esquema correcto, asegúrate de que los servicios de Docker estén corriendo (`docker-compose up -d`) y luego ejecuta el siguiente comando:
    ```bash
    npx supabase db push
    ```
    Este comando aplicará todas las migraciones pendientes de la carpeta `supabase/migrations` a tu base de datos local.

5.  **Inicia la aplicación:**
    ```bash
    npm run dev
    ```

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
En entornos Linux minimalistas, Cypress requiere algunas dependencias del sistema. Si aparece un error como `missing system library libatk-1.0.so.0`, instala los paquetes necesarios con:
```bash
npm run cy:deps
```
Este script instala `xvfb`, `libatk1.0-0` y otras bibliotecas requeridas antes de ejecutar las pruebas.
Para verificar el estilo del código, puedes ejecutar:
```bash
npm run lint
```
Este comando utiliza variables de entorno de `.env.test`.

## Despliegue en Producción

Aunque este proyecto fue diseñado inicialmente para una arquitectura serverless, la configuración recomendada para producción se ha consolidado en un despliegue autocontenido y robusto utilizando **Docker y Docker Compose**.

Este enfoque proporciona un control total sobre la infraestructura y está diseñado para ser desplegado en cualquier proveedor de máquinas virtuales (como DigitalOcean, AWS EC2, etc.).

Para obtener una guía detallada paso a paso sobre cómo desplegar la aplicación en un servidor de producción, incluyendo la configuración de Nginx, SSL, y los procedimientos de mantenimiento como backups y migraciones, consulte la **[Guía de Despliegue (DEPLOYMENT.md)](./DEPLOYMENT.md)**.

