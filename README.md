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
    Copia el archivo de ejemplo `.env.example` y renómbralo a `.env`.
    ```bash
    cp .env.example .env
    ```
    Luego, rellena las variables con tus propias credenciales de Supabase y Google AI:
    ```
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY
    GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
    REDIS_URL=redis://localhost:6379 # Requerido para el rate limiter
    LOG_LEVEL=info # Nivel de logs
    ```
    *Nota: Aunque la aplicación actual simula las respuestas de estas APIs, el código está estructurado para usarlas, por lo que el archivo `.env` es necesario.*
    Asegúrate de definir `GEMINI_API_KEY` y `GOOGLE_MAPS_API_KEY`; los endpoints correspondientes retornarán error si faltan. Para entornos de producción también se recomienda definir `REDIS_URL` y `LOG_LEVEL`.

3.  **Instala las dependencias del proyecto:**
    Abre una terminal en la raíz del proyecto y ejecuta:
    ```bash
    npm install
    ```

### Gestión de secretos en producción

Para entornos de producción, evita almacenar credenciales en archivos `.env` dentro del servidor. Carga las variables sensibles desde el entorno del host o mediante [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/).

Ejemplo usando variables de entorno al levantar el contenedor:

```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... docker-compose up -d
```

Para mayor seguridad con Docker Secrets:

```bash
echo "valor" | docker secret create supabase-url -
echo "valor" | docker secret create supabase-key -
```

Y en `docker-compose.yml` referenciar los secretos en la sección `secrets`.

### Ejecución

#### Modo Local (Sin Docker)

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

#### Modo Dockerizado (Recomendado)

Asegúrate de tener [Docker](https://www.docker.com/get-started) y Docker Compose instalados.

1.  **Construir y levantar el contenedor:**
    Desde la raíz del proyecto, ejecuta:
    ```bash
    docker-compose up --build
    ```
    La primera vez tomará un tiempo mientras se construye la imagen. Las siguientes veces será mucho más rápido. La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

2.  **Detener el contenedor:**
    Presiona `Ctrl + C` en la terminal. Para eliminar el contenedor y la red, puedes ejecutar:
    ```bash
    docker-compose down
    ```
