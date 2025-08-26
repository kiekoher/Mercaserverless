# Optimizador de Rutas para Mercaderistas

![Certified for Production](https://img.shields.io/badge/SRE%20Audit-Certified%20for%20Production-brightgreen)

## Descripción

Esta aplicación web está diseñada para digitalizar y optimizar el proceso de planificación de rutas para equipos de mercaderistas. La solución permite a los supervisores crear, asignar y gestionar rutas, mientras que los mercaderistas pueden visualizar sus rutas diarias y registrar sus visitas en tiempo real.


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
- **Hosting:** [Vercel](https://vercel.com/)

## Despliegue y Operaciones

Este proyecto está diseñado para un despliegue **100% serverless** utilizando Vercel y Supabase, con un fuerte enfoque en la seguridad y la observabilidad.

### Entornos de Despliegue

El proyecto se gestiona con tres entornos en Vercel:
- **Production:** Desplegado automáticamente desde la rama `main`. Es el entorno en vivo.
- **Preview:** Cada Pull Request genera su propio despliegue de previsualización. Sirve como entorno de Staging.
- **Development:** Para el desarrollo local, sincronizado mediante el CLI de Vercel.

### Configuración y Secretos

La configuración de la aplicación se gestiona exclusivamente a través de variables de entorno en el dashboard de Vercel. **No se deben utilizar archivos `.env` en producción.**

Para una guía detallada sobre cómo configurar las variables de entorno para cada ambiente, consulta el documento **[VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)**.

### Seguridad

La aplicación ha sido robustecida con las siguientes medidas de seguridad:
- **Cabeceras de Seguridad:** Se implementa una Política de Seguridad de Contenidos (CSP) estricta y otras cabeceras de seguridad (`X-Content-Type-Options`, `Referrer-Policy`, etc.) a través de middleware para mitigar ataques XSS y otros vectores.
- **Endpoint de Health Check Securizado:** El endpoint `/api/health` requiere un token de autorización para evitar su abuso.
- **CI/CD Seguro:** El pipeline de integración continua incluye auditoría de dependencias y análisis estático de código (SAST) con Semgrep.

### Operaciones y Monitorización

Para instrucciones sobre recuperación ante desastres, monitorización y configuración de alertas, consulta la **[Guía de Operaciones](./OPERATIONS.md)**.
