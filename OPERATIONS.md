# Guía Operacional para Despliegues en Vercel

Este documento resume los procedimientos clave para mantener el sistema Mercaderista en un entorno de producción alojado en Vercel.

## Monitoreo y Alertas
- **Logs**: La integración con Logtail recibe todos los eventos a través de `@logtail/pino`. Es fundamental configurar alertas sobre errores (`level: "error"`) y advertencias (`level: "warn"`) directamente en la plataforma de Better Stack (Logtail).
- **Métricas y APM**: Utilice **Vercel Analytics** para monitorear las métricas de rendimiento del frontend (Core Web Vitals) y el tráfico de la aplicación. Para un monitoreo más profundo del rendimiento de las funciones serverless (APM), integre Vercel con un servicio de observabilidad compatible como Datadog o el propio Better Stack.
- **Redis (Upstash)**: Habilite las notificaciones por correo electrónico en el dashboard de Upstash para alertar sobre el uso de la cuota y la latencia elevada.
- **Supabase**: Configure alertas en el dashboard de Supabase para monitorear el uso de recursos de la base de datos, el estado de la API y el número de conexiones.

## Rotación de Secretos
- **Fuente de Verdad**: Vercel es la única fuente de verdad para todas las variables de entorno de producción.
- **Procedimiento**: Programe rotaciones trimestrales de todas las claves y tokens sensibles, incluyendo `SUPABASE_SERVICE_KEY`, `LOGTAIL_SOURCE_TOKEN`, y las credenciales de Upstash Redis.
- **Health Check Token**: Mantenga en secreto el `HEALTHCHECK_TOKEN` utilizado para el endpoint de salud interno (`/api/health`) y cámbielo si se sospecha de filtración. Este endpoint puede ser usado por servicios de monitoreo externos para verificar la disponibilidad de la API.
- **Auditoría**: Documente cada rotación de secretos y revoque las credenciales antiguas inmediatamente después de confirmar que el nuevo secreto está funcionando correctamente.

## Respaldo y Recuperación
- **Base de Datos (Supabase)**: Asegúrese de que los respaldos automáticos diarios estén habilitados en el dashboard de Supabase. Realice pruebas de restauración trimestrales en un entorno de staging para garantizar la integridad de los backups.
- **Configuración de Vercel**: Antes de realizar cambios significativos en la configuración del proyecto en Vercel, tome una captura de pantalla o anote las configuraciones de variables de entorno y dominios.

## Manejo de Incidentes
1.  **Contención**: Ante una falla crítica, pause inmediatamente los despliegues automáticos en el dashboard de Vercel (`Project Settings > Git > Pause Deployments`) para evitar que un nuevo commit empeore la situación.
2.  **Diagnóstico**: Revise los logs en tiempo real en Logtail y el estado de los servicios en los dashboards de Vercel, Supabase y Upstash para identificar la causa raíz.
3.  **Comunicación**: Informe a las partes interesadas sobre el incidente y el progreso de la resolución.
4.  **Resolución y Post-mortem**: Una vez resuelto el incidente, documente la causa raíz, la solución aplicada y las lecciones aprendidas en un sistema de seguimiento de incidencias para prevenir futuras recurrencias.

## Contacto de Soporte
- **Vercel**: https://vercel.com/support
- **Supabase**: https://supabase.com/support
- **Upstash**: https://upstash.com/support
- **Logtail (Better Stack)**: https://betterstack.com/docs/logs/
