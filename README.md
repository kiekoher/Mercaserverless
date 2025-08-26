# Optimizador de Rutas para Mercaderistas

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

## Despliegue en Producción (Serverless)

Este proyecto está diseñado y configurado para un despliegue **100% serverless** utilizando Vercel y Supabase.

1.  **Hosting y Funciones Serverless:** El proyecto se despliega en **Vercel**. Cada `push` a la rama `main` dispara un despliegue automático a producción. Las Pull Requests generan sus propios despliegues de previsualización.
2.  **Base de Datos y Autenticación:** Se utiliza un proyecto de **Supabase** en la nube como base de datos PostgreSQL gestionada y para la autenticación de usuarios.
3.  **Configuración:** Las variables de entorno para producción (credenciales de Supabase, APIs, etc.) deben ser configuradas en el dashboard del proyecto en Vercel.
