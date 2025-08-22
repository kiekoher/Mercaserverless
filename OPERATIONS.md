# Guía Operacional

Este documento resume procedimientos claves para mantener el sistema Mercaderista en producción.

## Monitoreo y alertas
- **Logs**: Logtail recibe todos los eventos a través de `@logtail/pino`. Configure alertas en la plataforma para errores y advertencias.
- **Métricas**: Utilice el panel de Vercel y Supabase para revisar consumo de recursos. Se recomienda integrar un servicio de métricas como Datadog o New Relic para obtener alertas proactivas.
- **Redis (Upstash)**: habilite notificaciones de límite de cuota y latencia.

## Rotación de secretos
- Mantenga todos los tokens y claves en los valores de entorno de Vercel.
- Programe rotaciones trimestrales de `SUPABASE_SERVICE_KEY`, `LOGTAIL_SOURCE_TOKEN` y `UPSTASH_REDIS_URL`.
- Documente cualquier cambio y revoque credenciales antiguas inmediatamente.

## Respaldo y recuperación
- **Base de datos Supabase**: configure respaldos automáticos diarios y verifique periódicamente la restauración.
- **Configuración de Vercel**: exporte las variables de entorno antes de modificaciones mayores.

## Manejo de incidentes
1. Escale fallas críticas al canal de soporte y bloquee despliegues automáticos.
2. Revise logs recientes en Logtail y estado de servicios en Vercel/Supabase/Upstash.
3. Documente la causa raíz y la solución aplicada en el sistema de seguimiento de incidencias.

## Contacto de soporte
- **Vercel**: https://vercel.com/support
- **Supabase**: https://supabase.com/support
- **Upstash**: https://upstash.com/support
- **Logtail**: https://betterstack.com/docs/logs/

