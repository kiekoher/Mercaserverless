# Guía Operacional para Despliegues en Vercel

Este documento resume los procedimientos clave para mantener el sistema Mercaderista en un entorno de producción alojado en Vercel.

## Requisitos de Configuración

- Todas las variables de entorno listadas en `.env.example` deben definirse en el panel de Vercel antes de cada despliegue; la aplicación depende de ellas para iniciar correctamente.
- El middleware habilita de forma predeterminada la protección CSRF y el *rate limiting*, por lo que es necesario mantener las claves de CSRF y el servicio de Redis configurados y monitoreados.

## Monitoreo y Alertas

### Fuentes de Observabilidad
- **Logs**: La integración con Logtail (Better Stack) centraliza todos los logs de la aplicación. Es la fuente principal para alertas basadas en eventos.
- **Métricas y APM**: Vercel Analytics y la integración con un servicio de APM (Datadog, Better Stack, etc.) son clave para monitorear el rendimiento (Core Web Vitals, latencia de API) y el estado general de las funciones serverless.
- **Servicios de Terceros**: Los dashboards de Supabase y Upstash deben ser monitoreados para la salud específica de la base de datos y la caché/rate-limiter.

### Configuración de Alertas Recomendadas (en Logtail/Better Stack)

Es fundamental configurar alertas específicas y priorizadas para una respuesta a incidentes eficaz.

**P1 - Alertas Críticas (Notificación inmediata a canal de emergencias)**
- **Asunto:** `[CRITICAL] Tasa de Errores 5xx Elevada`
  - **Condición:** Si el número de logs con `level: "error"` y `status: 5*` supera el 5% del total en un período de 5 minutos.
  - **Razón:** Indica una falla generalizada en la API.
- **Asunto:** `[CRITICAL] Fallo de Autenticación o Seguridad`
  - **Condición:** Al detectar un log con los mensajes `"Invalid CSRF token"`, `"permission denied for..."` o `"BYPASS_AUTH must be false in production"`.
  - **Razón:** Indica un posible ataque, un error de configuración de seguridad grave o un bug crítico.

**P2 - Alertas de Advertencia (Notificación estándar a canal de operaciones)**
- **Asunto:** `[WARN] Latencia Elevada en API`
  - **Condición:** Si la latencia media del endpoint `/api/optimize-route` o `/api/planificar-rutas` supera los 3000ms durante 10 minutos.
  - **Razón:** Indica una degradación del rendimiento que afecta la experiencia del usuario.
- **Asunto:** `[WARN] Fallos en Servicios Externos`
  - **Condición:** Al detectar logs de error que contengan `"AI API timeout"`, `"Gemini error"` o `"Geocode error"`.
  - **Razón:** Informa sobre problemas con las APIs de Google, permitiendo una respuesta proactiva (ej. deshabilitar temporalmente la funcionalidad).
- **Asunto:** `[INFO] Aumento de Violaciones de CSP`
  - **Condición:** Si se reciben más de 10 reportes de CSP (`/api/csp-report`) en una hora.
  - **Razón:** Podría indicar un intento de ataque XSS o un error en el frontend que está bloqueando recursos legítimos.

## Rotación de Secretos
- **Fuente de Verdad**: Vercel es la única fuente de verdad para todas las variables de entorno de producción.
- **Procedimiento**: Programe rotaciones trimestrales de todas las claves y tokens sensibles, incluyendo `SUPABASE_SERVICE_KEY`, `LOGTAIL_SOURCE_TOKEN`, y las credenciales de Upstash Redis.
- **Health Check Token**: Mantenga en secreto el `HEALTHCHECK_TOKEN` utilizado para el endpoint de salud interno (`/api/health`) y cámbielo si se sospecha de filtración. Este endpoint puede ser usado por servicios de monitoreo externos para verificar la disponibilidad de la API.
- **Auditoría**: Documente cada rotación de secretos y revoque las credenciales antiguas inmediatamente después de confirmar que el nuevo secreto está funcionando correctamente.

## Respaldo y Recuperación

### Base de Datos (Supabase)

- **Activación de Backups**: Asegúrese de que los respaldos automáticos diarios (`Automated backups`) estén habilitados en el dashboard de Supabase (`Project Settings` > `Backups`). Para aplicaciones críticas, considere activar la recuperación de punto en el tiempo (`Point-in-Time Recovery`), que permite restaurar a cualquier minuto de las últimas horas o días (según el plan).

- **Procedimiento de Prueba de Restauración (Simulacro Trimestral)**: Realizar pruebas de restauración es **crítico** para validar la integridad de los backups y el plan de recuperación ante desastres.
  1.  **Acceso y Selección**: Navegue al dashboard de Supabase del proyecto de producción, vaya a `Project Settings` > `Backups`. En la lista de `Automated backups`, elija un backup reciente para la prueba.
  2.  **Restauración Aislada**: Inicie el proceso de restauración. **Es fundamental restaurar siempre en un NUEVO PROYECTO para no afectar la producción**. La interfaz de Supabase le guiará para crear una nueva instancia durante el proceso de restauración.
  3.  **Medición del Tiempo**: Anote el tiempo total que tarda el proceso, desde el inicio de la restauración hasta que la nueva instancia está completamente operativa. Este es su Tiempo de Recuperación (RTO) estimado.
  4.  **Validación de Datos**: Una vez que el proyecto temporal esté activo, realice comprobaciones básicas para verificar la integridad de los datos:
      - Conéctese a la nueva base de datos.
      - Ejecute consultas `SELECT COUNT(*)` en tablas clave como `profiles`, `rutas`, `puntos_de_venta`. Compare los resultados con los valores esperados.
      - Verifique el contenido de una o dos filas recientes para confirmar que los datos son correctos.
  5.  **Documentación y Limpieza**: Documente los resultados del simulacro: éxito/fallo, tiempo de restauración, y cualquier problema encontrado. Una vez completada la validación, **elimine inmediatamente el proyecto temporal** para evitar costes inesperados.

### Configuración de Vercel
- Antes de realizar cambios significativos en la configuración del proyecto en Vercel, tome una captura de pantalla o anote las configuraciones de variables de entorno y dominios.

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
