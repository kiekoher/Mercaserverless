# Guía de Despliegue en Servidor Dedicado con Docker

Esta guía describe el proceso para desplegar, mantener y actualizar la aplicación en una máquina virtual (ej. un Droplet de DigitalOcean) utilizando la configuración de Docker Compose para producción.

## Advertencia: Pruebas E2E
**Nota Crítica:** El checklist de despliegue anterior (`Checklist de Puesta en Producción`) indicaba que las pruebas End-to-End (`npm run cy:run`) fallan de forma persistente. Antes de cualquier despliegue a producción, es **altamente recomendable** ejecutar una verificación manual de los flujos de usuario más importantes (login, creación de rutas, etc.) en un entorno de pre-producción.

## 1. Requisitos Previos

Antes de comenzar, asegúrese de tener lo siguiente en su servidor de producción:
- **Docker y Docker Compose** instalados.
- **Git** instalado para clonar el repositorio.
- Un **nombre de dominio** apuntando a la dirección IP de su servidor.
- Un archivo `.env.prod` creado en la raíz del proyecto, con todas las variables de entorno configuradas según el `.env.prod.example`.

## 2. Despliegue Inicial

Siga estos pasos la primera vez que despliegue la aplicación.

### Paso 2.1: Iniciar los Servicios
Clone el repositorio en su servidor y, desde la raíz del proyecto, ejecute el siguiente comando para construir las imágenes e iniciar todos los servicios en segundo plano:

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### Paso 2.2: Configurar SSL (Let's Encrypt)
La configuración de Nginx está preparada para usar certificados SSL de Let's Encrypt. Para generar el certificado inicial y configurar la renovación automática, es necesario añadir un servicio `certbot` a su `docker-compose.prod.yml`:

```yaml
# En docker-compose.prod.yml, añada este servicio:
  certbot:
    image: certbot/certbot
    container_name: kimberly-certbot-prod
    restart: unless-stopped
    volumes:
      - certbot_conf:/etc/letsencrypt
      - certbot_www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew -q; sleep 12h & wait $${!}; done;'"
```

Una vez añadido el servicio, ejecute el siguiente comando para generar el certificado inicial. Reemplace los datos de ejemplo:
```bash
docker-compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path /var/www/certbot --email your-email@example.com -d your.domain.com --agree-tos --no-eff-email --force-renewal
```

Finalmente, reinicie Nginx para que cargue los certificados:
```bash
docker-compose -f docker-compose.prod.yml restart nginx
```
El servicio de Certbot se encargará de renovar los certificados automáticamente.

## 3. Mantenimiento y Actualizaciones

### 3.1. Actualizar la Aplicación
Para desplegar una nueva versión del código:
1.  Obtenga los últimos cambios del repositorio: `git pull`
2.  Reconstruya e inicie la aplicación:
    ```bash
    docker-compose -f docker-compose.prod.yml up -d --build app
    ```

### 3.2. Aplicar Migraciones de Base de Datos (Procedimiento Seguro)

Las migraciones modifican el esquema de la base de datos y deben aplicarse con cuidado. **Nunca** las aplique automáticamente durante el despliegue.

**Paso 1: (Opcional pero Recomendado) Realizar un Backup Manual**
El sistema realiza backups automáticos diarios. Sin embargo, antes de una migración importante, es prudente realizar uno manualmente:
```bash
docker-compose -f docker-compose.prod.yml exec postgres-backup backup
```
Esto creará un nuevo archivo de backup en el volumen `postgres_backups`.

**Paso 2: Ejecutar la Migración**
Utilice el siguiente comando para ejecutar un contenedor de un solo uso que aplicará las migraciones y luego se eliminará. Este es el método más seguro ya que utiliza el entorno exacto de la aplicación.

```bash
docker-compose -f docker-compose.prod.yml run --rm --entrypoint="npm run db:push" app
```

El flag `--rm` asegura que el contenedor se elimine después de completar la tarea. La opción `--entrypoint` anula el comando por defecto del contenedor (`node graceful-server.js`) y ejecuta únicamente el script de migración. Revise la salida del comando para asegurarse de que todas las migraciones se aplicaron correctamente.

### 3.3. Restaurar un Backup de Base de Datos
Para restaurar el último backup, puede ejecutar el siguiente comando. **ADVERTENCIA:** Esto sobreescribirá los datos actuales de la base de datos.
```bash
docker-compose -f docker-compose.prod.yml exec postgres-backup restore <backup-file-name.sql.gz>
```
Puede encontrar los nombres de los archivos de backup en el volumen `postgres_backups`.
