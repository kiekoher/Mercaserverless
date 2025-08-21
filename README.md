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

## Decisiones Arquitectónicas

### Almacenamiento de Puntos de Venta en Rutas

Durante el diseño del esquema de la base de datos, se tomó la decisión de almacenar los IDs de los puntos de venta de una ruta como un array de enteros (`BIGINT[]`) en la tabla `rutas`.

- **Ventaja:** Este enfoque desnormalizado simplifica las consultas de lectura para obtener una ruta completa y sus puntos, evitando la necesidad de un `JOIN` con una tabla intermedia. Para el caso de uso principal de la aplicación (mostrar la ruta del día de un mercaderista), esto es muy eficiente.
- **Desventaja:** Complica las consultas inversas (p. ej., encontrar todas las rutas que incluyen un punto de venta específico).
- **Conclusión:** Para la fase actual del proyecto, la eficiencia en la lectura de rutas se consideró prioritaria. Si en el futuro surgen necesidades de consulta más complejas, se podría considerar una refactorización a un esquema normalizado con una tabla de unión (`ruta_puntos_de_venta`).

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
    SUPABASE_SERVICE_KEY=YOUR_SUPABASE_SERVICE_KEY # Clave de servicio (solo servidor)
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY
    GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
    REDIS_URL=redis://localhost:6379 # Requerido para el rate limiter
    RATE_LIMIT_FAIL_OPEN=true # Permite que el rate limiter falle abierto en desarrollo
    LOG_LEVEL=info # Nivel de logs
    LOG_FILE_PATH=./logs/app.log # Ruta del archivo de logs
    LOG_MAX_SIZE=10485760 # Tamaño máximo antes de rotar (bytes)
    LOG_MAX_FILES=5 # Número máximo de archivos de log
    CYPRESS_ADMIN_ID=<uuid>
    CYPRESS_SUPERVISOR_ID=<uuid>
    CYPRESS_MERCADERISTA_ID=<uuid>
    ```
    *Nota: Aunque la aplicación actual simula las respuestas de estas APIs, el código está estructurado para usarlas, por lo que el archivo `.env` es necesario.*
    Asegúrate de definir `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY` y `GOOGLE_MAPS_API_KEY`; los endpoints correspondientes retornarán error si faltan. `REDIS_URL` es obligatorio para el rate limiter en producción, de lo contrario las solicitudes serán bloqueadas. Usa `RATE_LIMIT_FAIL_OPEN=true` solo en desarrollo para evitar bloqueos cuando Redis no esté disponible.

    Este archivo `.env` es solo para desarrollo local. Está incluido en `.gitignore` y no debe subirse al repositorio ni copiarse a servidores.

3.  **Instala las dependencias del proyecto:**
    Abre una terminal en la raíz del proyecto y ejecuta:
    ```bash
    npm install
    ```
4.  **Audita las dependencias:**
    ```bash
    npm audit --omit=dev
    ```
    El comando fallará si se detectan vulnerabilidades altas o críticas.

### Gestión de secretos en producción

En producción **no** copies el archivo `.env` al servidor. En su lugar, crea un archivo exclusivo para el servidor (no versionado) que Docker Compose cargará automáticamente.

Ejemplo en un servidor Ubuntu, creando `/etc/mercaderista.env` con los secretos:

```bash
sudo tee /etc/mercaderista.env <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
GEMINI_API_KEY=...
GOOGLE_MAPS_API_KEY=...
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
LOG_FILE_PATH=/var/log/mercaderista/app.log
LOG_MAX_SIZE=10485760
EOF
sudo chmod 600 /etc/mercaderista.env
```

El archivo debe ser administrado únicamente en el servidor. El repositorio incluye la plantilla `.env.example` para referencia, pero **todos** los archivos que coincidan con `.env*` están ignorados por Git.

Una vez creado el archivo, levanta la aplicación con:

```bash
docker compose up -d
```

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

Asegúrate de tener [Docker](https://www.docker.com/get-started) y Docker Compose instalados. El archivo `docker-compose.yml` levanta los servicios de la aplicación junto con PostgreSQL y Redis, necesarios para la base de datos y el rate limiter.

1.  **Construir y levantar los contenedores:**
    Desde la raíz del proyecto, ejecuta:
    ```bash
    docker-compose up --build
    ```
    La primera vez tomará un tiempo mientras se construye la imagen. Las siguientes veces será mucho más rápido. La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

    El contenedor de PostgreSQL se inicia vacío; aplica tus migraciones de Supabase (`supabase db push` o restaurando un dump) antes de usar la aplicación.

2.  **Detener el contenedor:**
    Presiona `Ctrl + C` en la terminal. Para eliminar el contenedor y la red, puedes ejecutar:
    ```bash
    docker-compose down
    ```

### Logs

Los registros se generan con [pino](https://github.com/pinojs/pino). En producción se utiliza el transporte [`pino-roll`](https://github.com/mcollina/pino-roll#readme), que rota el archivo indicado por `LOG_FILE_PATH` cuando supera `LOG_MAX_SIZE` (en bytes) y mantiene hasta `LOG_MAX_FILES` archivos. En desarrollo se utiliza un formato legible en la terminal.

Si se define la variable `LOG_REMOTE_URL`, los logs se enviarán también a ese endpoint HTTP para agregación centralizada.

Para evitar que los registros ocupen espacio indefinidamente, se recomienda programar un `cron` que elimine archivos antiguos, por ejemplo:

```bash
find /var/log/mercaderista -type f -mtime +30 -delete
```

### Seguridad y sanitización

Los campos de texto enviados por los usuarios se procesan con la función `sanitizeInput` para eliminar etiquetas HTML y saltos de línea antes de almacenarlos. Esta mitigación reduce riesgos de inyección, pero se recomienda combinarla con validaciones adicionales según el contexto de uso.
