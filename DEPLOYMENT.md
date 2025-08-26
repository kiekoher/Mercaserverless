# Checklist de Puesta en Producción

Esta es la lista de verificación secuencial con todos los pasos a seguir para el despliegue de la aplicación en un entorno de producción para el beta cerrado.

## Fase 1: Verificaciones Finales del Código

Estos pasos ya han sido completados por el equipo de SRE/desarrollo.

- [X] **Implementar cabecera de `Content-Security-Policy`**: Verificado, implementado en `middleware.js`.
- [X] **Implementar protección anti-CSRF en toda la API**: **Completado.** Se ha añadido una validación de token CSRF (Double Submit Cookie) en todos los endpoints que modifican datos.
- [X] **Refactorizar funciones de base de datos para minimizar `SECURITY DEFINER`**: Completado.
- [X] **Consolidar/Verificar políticas de RLS**: Verificado, las políticas actuales son seguras y no requieren cambios.
- [X] **Actualizar dependencias `npm`**: Completado, sin vulnerabilidades conocidas.
- [X] **Instrumentar el código para logging de alertas**: **Completado.** El código ahora emite todos los logs necesarios para las alertas de seguridad y rendimiento.
- [X] **Verificar suite de pruebas unitarias (`npm test`)**: **Completado.** El 100% de las 101 pruebas unitarias pasan con éxito.

## Fase 2: Pruebas y Acciones Manuales Críticas

Estos pasos deben ser ejecutados por el equipo antes del despliegue.

1.  [ ] **Ejecutar Pruebas E2E (`npm run cy:run`)**:
    *   **Acción:** Realizar una pasada final de las pruebas End-to-End.
    *   **¡ADVERTENCIA!** Las pruebas E2E han estado fallando de forma persistente en el entorno de CI debido a un problema con la inicialización de la aplicación en Cypress. **Se recomienda encarecidamente realizar una verificación manual de los flujos de usuario principales** (login, ver ruta, crear PDV) en un entorno de pre-producción antes de continuar.

2.  [ ] **Realizar Simulacro de Restauración de Backup**:
    *   **Acción:** Seguir la guía en `OPERATIONS.md` para realizar el primer simulacro de restauración de la base de datos de Supabase.
    *   **Objetivo:** Validar la integridad de los backups y medir el Tiempo de Recuperación (RTO).
    *   **Criticidad:** **Alta.** No desplegar si este paso falla.

3.  [ ] **Configurar Alertas de Monitorización**:
    *   **Acción:** Utilizando la plataforma de logging (Logtail/Better Stack), configurar las alertas P1 y P2 detalladas en la sección "Monitoreo y Alertas" de `OPERATIONS.md`.
    *   **Objetivo:** Asegurar que el equipo reciba notificaciones inmediatas de fallos críticos o degradación del servicio.
    *   **Criticidad:** **Alta.**

## Fase 3: Proceso de Despliegue

Estos son los pasos para el día del lanzamiento.

4.  [ ] **Pausar los Despliegues Automáticos**:
    *   **Acción:** En el dashboard de Vercel, ir a `Project Settings > Git` y pausar los despliegues para evitar que commits accidentales interfieran con el lanzamiento.

5.  [ ] **Desplegar la Versión Estable a Producción**:
    *   **Acción:** Promocionar el último commit verificado de la rama `main` al dominio de producción.

6.  [ ] **Reanudar los Despliegues Automáticos**:
    *   **Acción:** Una vez que el despliegue se ha confirmado como exitoso, volver a habilitar los despliegues automáticos en Vercel.

## Fase 4: Monitoreo Post-Lanzamiento

7.  [ ] **Monitorear Activamente**:
    *   **Acción:** Durante las primeras horas después del despliegue, monitorear de cerca los logs en Logtail, el dashboard de Vercel y el de Supabase para detectar cualquier comportamiento anómalo.
    *   **Objetivo:** Identificar y responder rápidamente a cualquier incidente post-despliegue.

¡Felicidades por el lanzamiento!
