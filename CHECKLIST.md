# Checklist Final de Puesta en Producción

Este documento es una guía de verificación secuencial para el lanzamiento de la aplicación a producción. No proceda a un paso sin haber completado el anterior.

## Fase 1: Preparación Final (Pre-Lanzamiento)

- [ ] **Aprobar y Fusionar Cambios:** Confirmar que el Pull Request final que contiene todas las mejoras de esta auditoría ha sido revisado, aprobado y fusionado a la rama `main`.
- [ ] **Verificar Pipeline de CI:** Confirmar que el pipeline de CI/CD en la rama `main` se ha ejecutado y ha pasado todas las pruebas (linting, tests unitarios, auditoría de seguridad) tras la fusión.
- [ ] **Conectar Repositorio a Vercel:** Si aún no se ha hecho, seguir las instrucciones en `VERCEL_DEPLOYMENT.md` (Paso 0) para conectar este repositorio a un proyecto de Vercel.
- [ ] **Configurar Variables de Entorno de Producción:**
    - [ ] Navegar al dashboard del proyecto en Vercel.
    - [ ] Ir a `Settings > Environment Variables`.
    - [ ] Añadir **TODAS** las variables listadas en `VERCEL_DEPLOYMENT.md` para el entorno de `Production`. Prestar especial atención a los secretos (`SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, etc.).
- [ ] **Habilitar Backups Avanzados (PITR):**
    - [ ] Navegar al dashboard del proyecto de Supabase de **producción**.
    - [ ] Ir a `Infrastructure > Backups`.
    - [ ] Activar el add-on de **Point-in-Time Recovery (PITR)**. Se recomienda un periodo de retención de al menos 7 días. (Nota: Esto es un servicio de pago).
- [ ] **Añadir Invitados Beta Iniciales:**
    - [ ] Navegar a la página de "Gestión Beta" en la aplicación (desplegada en preview o en producción si ya está activa).
    - [ ] Añadir los correos electrónicos del equipo interno y de los beta testers iniciales para que puedan registrarse.
- [ ] **Configurar Dominio Personalizado:**
    - [ ] En el dashboard de Vercel, ir a `Settings > Domains`.
    - [ ] Añadir el dominio de producción deseado (ej. `app.suempresa.com`) y seguir las instrucciones para configurar los registros DNS.

## Fase 2: Lanzamiento (Go-Live)

- [ ] **Promover a Producción:**
    - [ ] En el dashboard de Vercel, ir a la pestaña `Deployments`.
    - [ ] Localizar el último despliegue exitoso de la rama `main`.
    - [ ] Asegurarse de que esté promocionado a `Production`.
- [ ] **Realizar Prueba de Humo (Smoke Test) en Producción:**
    - [ ] Acceder a la URL de producción.
    - [ ] **Verificar acceso denegado:** Intentar registrarse con un email que **NO** esté en la lista beta. El registro debe fallar con un error.
    - [ ] **Verificar acceso permitido:** Registrarse con un email que **SÍ** esté en la lista beta. El registro debe ser exitoso.
    - [ ] Iniciar sesión con el nuevo usuario.
    - [ ] Navegar por las funcionalidades básicas (Dashboard, Rutas, etc.) para confirmar que la aplicación es funcional.

## Fase 3: Post-Lanzamiento

- [ ] **Monitoreo Activo:**
    - [ ] Observar activamente la plataforma de logging (Logtail/Better Stack) durante las primeras 1-2 horas en busca de un volumen inesperado de errores.
    - [ ] Verificar que el monitor de uptime externo (UptimeRobot, etc.) esté reportando un estado `200 OK` desde el endpoint de producción.
- [ ] **Comunicación:** Anunciar el lanzamiento exitoso al equipo y a los beta testers.

---
*Certificado para Producción y Despliegue.*
