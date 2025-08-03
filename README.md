# Optimizador de Rutas para Mercaderistas

## Descripción

Este proyecto es un Prototipo Funcional (MVP) de una aplicación web diseñada para digitalizar y optimizar el proceso de ruteo de mercaderistas. La solución permite a los supervisores crear y asignar rutas manualmente, y a los mercaderistas ver sus rutas asignadas para el día.

Este proyecto fue desarrollado como parte de una iniciativa para Kimberly-Clark y Manpower.

## Funcionalidades Implementadas

- **Autenticación de Usuarios:** Sistema de inicio y cierre de sesión para supervisores y mercaderistas (simulado con Supabase).
- **Gestión de Puntos de Venta:** Interfaz para que los supervisores puedan crear y ver los puntos de venta.
- **Gestión de Rutas (Manual):** Interfaz para que los supervisores creen rutas diarias, asignando un mercaderista y una selección de puntos de venta.
- **Vista de Ruta del Mercaderista:** Una página simple y optimizada para móviles donde el mercaderista puede ver su ruta asignada para el día actual.
- **Integración con IA (LLM):** Funcionalidad controlada que permite a los supervisores generar un resumen de texto amigable y motivador de una ruta utilizando un modelo de lenguaje grande (simulado con Google Gemini).

## Stack Tecnológico

- **Framework:** [Next.js](https://nextjs.org/)
- **Lenguaje:** JavaScript con React
- **Backend y Base de Datos:** [Supabase](https://supabase.io/) (simulado en los endpoints de la API)
- **IA / LLM:** [Google Gemini API](https://ai.google.dev/) (simulada en el endpoint de resumen)
- **Testing:** [Jest](https://jestjs.io/) con [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- **Estilos:** CSS plano (inline y global)

## Cómo Empezar

Sigue estos pasos para configurar y ejecutar el proyecto en tu máquina local.

### Prerrequisitos

Asegúrate de tener instalado [Node.js](https://nodejs.org/) (versión 18.x o superior).

### Instalación

1.  **Clona el repositorio** (o descarga los archivos).

2.  **Crea el archivo de variables de entorno:**
    Copia el archivo de ejemplo `.env.local.example` y renómbralo a `.env.local`.
    ```bash
    cp .env.local.example .env.local
    ```
    Luego, rellena las variables con tus propias credenciales de Supabase y Google AI:
    ```
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY
    ```
    *Nota: Aunque la aplicación actual simula las respuestas de estas APIs, el código está estructurado para usarlas, por lo que el archivo `.env.local` es necesario.*

3.  **Instala las dependencias del proyecto:**
    Abre una terminal en la raíz del proyecto y ejecuta:
    ```bash
    npm install
    ```

### Ejecución

1.  **Iniciar el servidor de desarrollo:**
    ```bash
    npm run dev
    ```
    Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.

2.  **Ejecutar las pruebas:**
    Para correr las pruebas unitarias y de componentes, ejecuta:
    ```bash
    npm test
    ```
