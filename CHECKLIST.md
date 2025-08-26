# Checklist para Lanzamiento en Producción (Beta Cerrada)

## Fase 1: Configuración de Infraestructura

- [ ] **Proyecto en Vercel:**
    - [ ] Crear el proyecto en Vercel y conectarlo al repositorio de GitHub.
    - [ ] Configurar el dominio de producción.
- [ ] **Proyecto en Supabase:**
    - [ ] Crear el proyecto de producción en Supabase.
    - [ ] Guardar las credenciales (`URL`, `anon_key`, `service_role_key`) de forma segura.
    - [ ] Configurar una política de backups robusta.
- [ ] **Variables de Entorno:**
    - [ ] Añadir todas las variables de entorno de producción al proyecto de Vercel (Supabase, Google Maps, Gemini, Resend, Upstash).
    - [ ] Doble verificación de que no se están usando credenciales de desarrollo.
- [ ] **Migraciones de Base de Datos:**
    - [ ] Ejecutar todas las migraciones en la base de datos de producción de Supabase usando la CLI.

## Fase 2: Pruebas y Calidad

- [ ] **Pruebas E2E:**
    - [ ] Ejecutar la suite completa de pruebas E2E (Cypress) apuntando al entorno de staging/previsualización de Vercel.
- [ ] **Pruebas de Carga (Opcional):**
    - [ ] Realizar pruebas de carga básicas en los endpoints críticos (login, carga de rutas) para asegurar que soportan el número esperado de usuarios beta.
- [ ] **Auditoría de Seguridad:**
    - [ ] Revisar que todas las políticas de Row Level Security (RLS) en Supabase estén activadas y sean correctas.
    - [ ] Verificar que la Content Security Policy (CSP) y la protección CSRF estén activas y configuradas para el dominio de producción.
- [ ] **Pruebas Manuales (UAT):**
    - [ ] Realizar una prueba completa de los flujos principales (creación de usuario, planificación de ruta, ejecución de ruta por el mercaderista) por parte del equipo.

## Fase 3: Despliegue y Lanzamiento

- [ ] **Migración de Datos Iniciales:**
    - [ ] Cargar los datos de los usuarios beta (supervisores, mercaderistas) y puntos de venta a la base de datos de producción.
- [ ] **Despliegue Final:**
    - [ ] Hacer merge de la rama de lanzamiento a `main` para disparar el despliegue final en Vercel.
- [ ] **Monitoreo:**
    - [ ] Configurar el monitoreo en Vercel y Supabase para observar el rendimiento y los errores.
    - [ ] Establecer un canal de comunicación (ej. Slack, Discord) para que los usuarios beta puedan reportar problemas.
- [ ] **Comunicación:**
    - [ ] Enviar las invitaciones y credenciales a los usuarios de la beta cerrada.
    - [ ] Proporcionar una guía rápida de uso o un video tutorial.
