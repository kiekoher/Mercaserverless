# Guía Operacional

Este documento resume los procedimientos clave para mantener el sistema Mercaderista en un entorno de producción.

## Requisitos de Configuración

- Todas las variables de entorno listadas en `.env.prod.example` deben definirse en el archivo `.env.prod` antes de cada despliegue. La aplicación depende de ellas para iniciar correctamente.
- El middleware habilita de forma predeterminada la protección CSRF y el *rate limiting*, por lo que es necesario mantener el servicio de Redis configurado y monitoreado.

## Monitoreo y Alertas

### Fuentes de Observabilidad
- **Logs**: La integración con Logtail (Better Stack) centraliza todos los logs de la aplicación. Es la fuente principal para alertas basadas en eventos. Se recomienda configurar un agente en el servidor host para reenviar los logs de los contenedores Docker a este servicio.
- **Métricas y APM**: La integración con un servicio de APM (Datadog, Better Stack, etc.) es clave para monitorear el rendimiento (latencia de API, uso de CPU/memoria de los contenedores).
- **Servicios de Terceros**: Los dashboards de Supabase (si se usa para Auth) y los proveedores de API (Google) deben ser monitoreados para su estado de salud.

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
- **Fuente de Verdad**: El archivo `.env.prod` en el servidor de producción es la única fuente de verdad para todas las variables de entorno. Este archivo **NUNCA** debe ser versionado en Git.
- **Procedimiento**: Programe rotaciones trimestrales de todas las claves y tokens sensibles, incluyendo `SUPABASE_SERVICE_KEY`, `LOGTAIL_SOURCE_TOKEN`, y las credenciales de la base de datos y servicios externos.
- **Health Check Token**: Mantenga en secreto el `HEALTHCHECK_TOKEN` utilizado para el endpoint de salud interno (`/api/health`) y cámbielo si se sospecha de filtración.
- **Auditoría**: Documente cada rotación de secretos y revoque las credenciales antiguas inmediatamente después de confirmar que el nuevo secreto está funcionando correctamente.

## Respaldo y Recuperación

### Base de Datos (PostgreSQL en Docker)

- **Estrategia de Backups**: El servicio `postgres-backup` en `docker-compose.prod.yml` realiza backups automáticos diarios.
- **Procedimiento de Restauración**: El procedimiento detallado para restaurar la base de datos desde un backup se encuentra en la **[Guía de Despliegue (DEPLOYMENT.md)](./DEPLOYMENT.md)**.
- **Simulacro de Restauración (Trimestral)**: Es **crítico** realizar pruebas de restauración trimestrales para validar la integridad de los backups y el procedimiento documentado. El objetivo es medir y asegurar un Tiempo de Recuperación (RTO) aceptable.

### Base de Datos (Supabase - Referencia)
La siguiente sección se mantiene como referencia del diseño original. Si se utiliza Supabase como proveedor de base de datos en la nube, estos pasos aplican.
- **Activación de Backups**: Asegúrese de que los respaldos automáticos diarios (`Automated backups`) estén habilitados en el dashboard de Supabase.
- **Procedimiento de Prueba de Restauración**: Siga la guía de Supabase para restaurar un backup en un nuevo proyecto de prueba para validar la integridad de los datos.

## Manejo de Incidentes
1.  **Contención**: Ante una falla crítica, considere detener el despliegie de nuevas versiones (ej. congelando la rama `main`) para evitar que un nuevo commit empeore la situación.
2.  **Diagnóstico**: Revise los logs en tiempo real en Logtail y el estado de los servicios (`docker-compose ps -a`) para identificar la causa raíz.
3.  **Comunicación**: Informe a las partes interesadas sobre el incidente y el progreso de la resolución.
4.  **Resolución y Post-mortem**: Una vez resuelto el incidente, documente la causa raíz, la solución aplicada y las lecciones aprendidas en un sistema de seguimiento de incidencias para prevenir futuras recurrencias.

## Contacto de Soporte
- **Supabase**: https://supabase.com/support
- **Upstash**: https://upstash.com/support
- **Logtail (Better Stack)**: https://betterstack.com/docs/logs/
