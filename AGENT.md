AGENT.MD - Directiva para la Migración a una Arquitectura 100% Serverless
Objetivo: Migrar la aplicación de su actual configuración basada en Docker a una arquitectura 100% serverless, utilizando Vercel para el despliegue y servicios gestionados en la nube para toda la infraestructura de soporte. El objetivo es maximizar la fiabilidad, mejorar la escalabilidad y eliminar la sobrecarga operativa de la gestión de servidores.
Tarea 1: Desacoplamiento de Docker y Preparación del Entorno
La primera fase es preparar la aplicación para que funcione en un entorno gestionado, eliminando las dependencias del Dockerfile y docker-compose.yml.
 * Eliminar Archivos de Contenerización:
   * Suprime los archivos Dockerfile, docker-compose.yml y .dockerignore. La compilación (build) y el despliegue (deploy) serán gestionados directamente por Vercel.
 * Validar Configuración de Next.js:
   * Asegúrate de que el archivo next.config.js contenga la opción output: 'standalone'. Esta es una práctica óptima para despliegues optimizados, aunque Vercel maneja esto de forma nativa.
 * Actualizar el README.md:
   * Modifica el README.md para eliminar las instrucciones de ejecución con Docker. Reemplázalas con una sección sobre el despliegue en Vercel y la gestión de variables de entorno directamente en la plataforma Vercel.
Tarea 2: Migración de Servicios de Soporte a la Nube
Para lograr una arquitectura 100% serverless, los servicios que actualmente se ejecutan en contenedores locales (Redis y el sistema de logging) deben ser reemplazados por sus equivalentes gestionados en la nube.
 * Refactorizar el Rate Limiter para Usar Redis Serverless (Upstash):
   * Modifica el archivo lib/rateLimiter.js.
   * Actualiza la inicialización del cliente de ioredis para que utilice una nueva variable de entorno, UPSTASH_REDIS_URL, en lugar de la REDIS_URL local.
   * Añade UPSTASH_REDIS_URL al archivo .env.example para documentar la nueva configuración.
 * Refactorizar el Logger para un Servicio Externo (Logtail):
   * Modifica el archivo lib/logger.js.
   * Elimina el transporte de pino-roll que escribe en archivos locales, ya que no es compatible con entornos serverless.
   * Integra un transporte compatible con Vercel, como @logtail/pino. Añade la dependencia a package.json (npm install @logtail/pino).
   * Configura el nuevo transporte para que utilice una variable de entorno LOGTAIL_SOURCE_TOKEN y añádela al archivo .env.example.
Tarea 3: Adaptación del Pipeline de CI/CD para Despliegue Continuo en Vercel
El pipeline actual está diseñado para construir una imagen de Docker y desplegarla mediante SSH. Este flujo debe ser reemplazado por uno nativo de Vercel.
 * Actualizar el Workflow de GitHub Actions:
   * Modifica el archivo .github/workflows/ci.yml.
   * Elimina por completo los jobs docker y deploy.
   * La integración nativa de Vercel con GitHub se encargará del despliegue automáticamente en cada push a la rama main una vez que el repositorio esté conectado en la plataforma de Vercel. Los jobs de audit, lint y jest-tests/cypress-tests deben mantenerse como pasos de verificación previos al despliegue automático.
Tarea 4: Verificación Final
 * Ejecutar Pruebas:
   * Corre npm test para asegurar que todas las pruebas unitarias sigan pasando después de los cambios en el logging y el rate limiter.
 * Validar Scripts de Paquete:
   * Revisa el archivo package.json y asegúrate de que el script start se base en next start, eliminando cualquier referencia al server.js personalizado si ya no es necesario (Vercel lo gestiona automáticamente). El archivo server.js actual solo carga las variables de entorno y ejecuta el servidor de Next, por lo que puede ser reemplazado por la gestión de entorno de Vercel.
Una vez completadas estas tareas, el repositorio estará completamente preparado para un despliegue continuo en una arquitectura 100% serverless, aprovechando al máximo la fiabilidad y escalabilidad de la nube.
