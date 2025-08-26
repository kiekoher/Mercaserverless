# Guía de Operaciones para Producción

Este documento proporciona instrucciones críticas para el mantenimiento, monitorización y recuperación del sistema en un entorno de producción.

---

## Checklist Crítico Pre-Despliegue

Antes de cada despliegue a producción (`git push a main`), el ingeniero responsable **DEBE** confirmar los siguientes puntos.

- **[ ] 1. Backups de Base de Datos Activos:**
  - **Acción:** Navegar al Dashboard de Supabase del proyecto de **producción**.
  - **Verificar:** En la sección `Infraestructura > Backups`, confirmar que los "Daily backups" están **activos** y que se ha realizado al menos un backup en las últimas 24 horas.
  - **Riesgo si se ignora:** Pérdida total de datos en caso de un fallo.

- **[ ] 2. Variables de Entorno Configuradas:**
  - **Acción:** Navegar a `Settings > Environment Variables` en el proyecto de Vercel.
  - **Verificar:** Confirmar que todas las variables de entorno listadas en `VERCEL_DEPLOYMENT.md` para el entorno de `Production` están configuradas y tienen los valores correctos.
  - **Riesgo si se ignora:** La aplicación no se iniciará o tendrá fallos críticos en tiempo de ejecución.

---

## 1. Plan de Recuperación Ante Desastres (DRP) - Base de Datos Supabase

Esta es la tarea de mayor criticidad para el equipo de operaciones. La integridad de los datos es primordial.

### 1.1. Habilitar Backups Diarios Automáticos

Supabase ofrece backups automáticos en sus planes de pago. Si aún no está activado, esta es la **máxima prioridad**.

1.  **Navegar al Dashboard de Supabase:** Acceda al proyecto correspondiente.
2.  **Ir a Infraestructura > Backups:** (`Infrastructure` > `Backups`).
3.  **Habilitar Backups Diarios:** Asegúrese de que los backups automáticos estén habilitados. Supabase generalmente retiene estos backups por 7 días en planes estándar. Verifique la política de retención de su plan.

### 1.2. Procedimiento de Simulacro de Restauración (Acción Trimestral)

Un backup no es útil si no se puede restaurar. Este simulacro debe realizarse **cada 3 meses** para garantizar que el proceso funciona y que el equipo está familiarizado con él.

**Fase 1: Crear un Nuevo Proyecto Temporal en Supabase**

Nunca realice una restauración de prueba sobre el proyecto de producción.

1.  Cree un nuevo proyecto en su organización de Supabase. Puede llamarlo `kimberly-clark-rutero-restore-test`.
2.  Espere a que el nuevo proyecto esté completamente provisionado.

**Fase 2: Realizar la Restauración**

1.  **Vaya al proyecto de producción** en el dashboard de Supabase.
2.  Vaya a **Infraestructura > Backups**.
3.  Seleccione el backup más reciente (o uno específico que desee probar) y haga clic en **"Restore"**.
4.  **¡MUY IMPORTANTE!** En el diálogo de restauración, se le pedirá que seleccione el proyecto de destino. **Seleccione el proyecto temporal que acaba de crear (`kimberly-clark-rutero-restore-test`)**.
5.  Confirme la operación. La restauración puede tardar varios minutos dependiendo del tamaño de la base de datos.

**Fase 3: Validar los Datos Restaurados**

1.  Una vez completada la restauración, navegue al proyecto de prueba (`...-restore-test`).
2.  Utilice el **Editor de Tablas** (`Table Editor`) para verificar que los datos existen:
    *   Revise la tabla `pdvs` (Puntos de Venta). ¿Están los datos allí?
    *   Revise la tabla `rutas` y `visitas`. ¿Son consistentes?
    *   Revise la tabla `auth.users` para confirmar que los usuarios fueron restaurados.
3.  **(Opcional pero recomendado)** Conecte una instancia local de la aplicación al proyecto de prueba restaurado (cambiando las variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`) y verifique que puede iniciar sesión y ver los datos.

**Fase 4: Limpieza**

1.  Una vez validada la restauración, **elimine el proyecto de prueba** (`kimberly-clark-rutero-restore-test`) para evitar costos innecesarios.
2.  Documente la fecha y el resultado del simulacro.

---

## 2. Configuración de Alertas en Plataforma de Logging (Logtail/Better Stack)

El código ha sido instrumentado con `pino` para emitir logs estructurados y enviarlos a un servicio externo (como Logtail/Better Stack) en producción. El equipo de operaciones debe configurar alertas en dicha plataforma basadas en los siguientes mensajes y niveles de log para una monitorización proactiva.

### 2.1. Cómo Configurar las Alertas

En tu plataforma de logging (ej. Better Stack), navega a la sección de "Alerting" y crea reglas de alerta. La lógica general es:

`SI el nivel de log es [NIVEL] Y el mensaje contiene [TEXTO], ENTONCES enviar una notificación a [CANAL]`.

**Ejemplo de Alerta Crítica:**
- **Condición:** `level = "fatal"` (o número `60`)
- **Canal de Notificación:** PagerDuty / SMS / Llamada
- **Descripción:** Alerta de disponibilidad del sistema.

**Ejemplo de Alerta de Seguridad:**
- **Condición:** `level = "error"` (o número `50`) Y `msg` contiene `CSRF validation failed`
- **Canal de Notificación:** Slack canal `#security-alerts`
- **Descripción:** Intento de ataque CSRF detectado.

### 2.2. Definición de Alertas

#### Alertas de Prioridad CRÍTICA (Requieren acción inmediata)

| Nivel de Log | Mensaje Clave a Buscar | Razón y Acción |
| :--- | :--- | :--- |
| `error` (50) | `CSRF validation failed` | **[Seguridad]** Intento de ataque CSRF detectado. Investigar la IP de origen y el patrón de ataque. |
| `error` (50) | `Security error. Please refresh the page.` | **[Seguridad]** Fallo en la validación de seguridad, probablemente CSRF. |
| `fatal` (60) | `Database connection failed` | **[Disponibilidad]** La aplicación no puede conectarse a la base de datos de Supabase. Verificar el estado de Supabase. |
| `fatal` (60) | `Redis connection failed` | **[Disponibilidad]** La aplicación no puede conectarse a Redis. El Rate Limiting y la caché no funcionarán. El sistema está en modo "fail-closed", por lo que las peticiones serán bloqueadas. Verificar el estado de Upstash. |

### Alertas de Prioridad ALTA (Requieren investigación)

| Nivel de Log | Mensaje Clave a Buscar | Razón y Acción |
| :--- | :--- | :--- |
| `warn` (40) | `Rate limit exceeded` | **[Abuso]** Un usuario o IP está excediendo los límites de peticiones. Si es frecuente, considere bloquear la IP o investigar el comportamiento del usuario. |
| `error` (50) | `Geocoding API error` | El servicio de geocodificación de Google Maps está fallando. La optimización de rutas y la creación de PDV con dirección pueden no funcionar. Verificar el estado de la API de Google y los créditos. |
| `error` (50) | `Gemini API error` | El servicio de IA de Gemini está fallando. Las funcionalidades de resumen y análisis no funcionarán. Verificar el estado de la API de Google y los créditos. |
| `error` (50) | `Failed to send email` | El servicio de Resend para enviar correos está fallando. Los correos transaccionales (ej. reseteo de contraseña) no se están enviando. Verificar el estado de Resend. |
| `error` (50) | `CSP validation failed` | **[Seguridad]** El navegador de un usuario bloqueó la ejecución de un recurso debido a una violación de la Política de Seguridad de Contenidos. Investigar el reporte para ver si es un ataque XSS o una configuración incorrecta. |

### Alertas de Prioridad MEDIA (Informativas)

| Nivel de Log | Mensaje Clave a Buscar | Razón y Acción |
| :--- | :--- | :--- |
| `info` (30) | `Unauthenticated user redirected to login` | Informativo. Un usuario no autenticado intentó acceder a una ruta protegida. Normal, pero picos pueden indicar intentos de escaneo de vulnerabilidades. |
| `info` (30) | `User logged in successfully` | Informativo. Útil para seguimiento de actividad de usuarios. |

---

## 3. Monitorización de Disponibilidad (Uptime)

Además de las alertas basadas en logs, es fundamental tener un monitor de uptime externo (como Better Uptime, UptimeRobot, etc.) que verifique constantemente si la aplicación está en línea y respondiendo correctamente.

### Configuración del Monitor

- **Endpoint a Monitorear:** `https://<tu-dominio-de-produccion>.com/api/health`
- **Método HTTP:** `GET`
- **Frecuencia:** Recomendado: cada 1-5 minutos.

### Cabeceras de Autenticación

El endpoint `/api/health` es securizado. El monitor de uptime **DEBE** enviar la siguiente cabecera HTTP en cada petición para autenticarse:

- **Nombre de la Cabecera:** `Authorization`
- **Valor de la Cabecera:** `Bearer <TU_HEALTHCHECK_TOKEN>`

Reemplaza `<TU_HEALTHCHECK_TOKEN>` con el valor de la variable de entorno `HEALTHCHECK_TOKEN` que has configurado en Vercel para el entorno de producción.

Si el monitor recibe una respuesta que no sea un `200 OK`, debe disparar una alerta de disponibilidad (ej. PagerDuty, SMS). Una respuesta `401 Unauthorized` o `403 Forbidden` indica un problema con el token de autenticación. Una respuesta `503 Service Unavailable` indica un problema con las dependencias de la aplicación (Base de Datos o Redis).
