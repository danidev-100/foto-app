# Guía Completa: Deploy de foto-app en VPS

## Tabla de contenidos

1. [Elegir VPS](#1-elegir-vps)
2. [Instalar Ubuntu 24.04](#2-instalar-ubuntu-2404)
3. [Conectarte por SSH](#3-conectarte-por-ssh)
4. [Instalar Docker](#4-instalar-docker)
5. [Configurar Neon (Base de datos)](#5-configurar-neon-base-de-datos)
6. [Subir el código](#6-subir-el-código)
7. [Configurar variables de entorno](#7-configurar-variables-de-entorno)
8. [Deploy](#8-deploy)
9. [Verificar que todo anda](#9-verificar-que-todo-anda)
10. [Dominio propio (opcional)](#10-dominio-propio-opcional)
11. [HTTPS con Let's Encrypt (opcional)](#11-https-con-lets-encrypt-opcional)
12. [Mantenimiento](#12-mantenimiento)

---

## 1. Elegir VPS

Recomendaciones económicas:

| Proveedor | RAM | CPU | Disco | Precio/mes |
|---|---|---|---|---|
| **Hetzner** (CPX11) | 2GB | 2 vCPU | 40GB | ~€4 |
| **DigitalOcean** (Basic) | 1GB | 1 vCPU | 25GB | $6 |
| **Linode/Akamai** | 1GB | 1 vCPU | 25GB | $5 |
| **RackNerd** | 1GB | 2 vCPU | 20GB | ~$10/año |

**Mínimo recomendado**: 1GB RAM, 1 vCPU, 20GB disco.

### Pasos para crear el VPS:

1. Creá una cuenta en el proveedor elegido
2. Creá un nuevo droplet/instancia
3. Elegí **Ubuntu 24.04 LTS** como sistema operativo
4. Elegí la región más cercana a tus usuarios (ej: São Paulo, Miami)
5. Elegí autenticación por **SSH key** (recomendado) o **password**
6. Crear la instancia

---

## 2. Instalar Ubuntu 24.04

La mayoría de VPS ya vienen con Ubuntu pre-instalado. Si no:

### Desde el panel del proveedor:

1. Andá a la sección **OS/Reinstall** del panel
2. Seleccioná **Ubuntu 24.04 LTS**
3. Confirmá la instalación (borra todo el disco)
4. Esperá 2-5 minutos

### Si necesitás instalarlo manualmente (bare metal):

1. Descargá Ubuntu Server: https://ubuntu.com/download/server
2. Creá un USB booteable con Rufus (Windows) o balenaEtcher
3. Booteá desde el USB
4. Seguí el instalador:
   - Idioma: English
   - Keyboard: Spanish (o el que uses)
   - Network: DHCP automático
   - Storage: usar disco completo
   - Profile: crear usuario `deploy` con password
   - SSH Server: **marcar** (importante!)
   - No instalar snaps extras
5. Reboot y listo

---

## 3. Conectarte por SSH

### Si usás password:

```bash
# Desde tu PC (Windows PowerShell, Mac Terminal, o Linux)
ssh root@tu-ip-del-vps
# Te pide el password que configuraste
```

### Si usás SSH key (recomendado):

```bash
# Desde tu PC, generar una key si no tenés
ssh-keygen -t ed25519 -C "tu-email@email.com"
# Enter, enter, enter (3 veces)

# Copiar la key al VPS
ssh-copy-id root@tu-ip-del-vps

# Ahora conectarte sin password
ssh root@tu-ip-del-vps
```

### Desde Windows con PuTTY (alternativa):

1. Descargá PuTTY: https://www.putty.org
2. Host Name: `tu-ip-del-vps`
3. Port: `22`, Connection type: `SSH`
4. Click Open
5. Login: `root`, Password: el que configuraste

---

## 4. Instalar Docker

### En el VPS (una vez conectado por SSH):

```bash
# Actualizar el sistema
apt update && apt upgrade -y

# Instalar dependencias
apt install -y ca-certificates curl gnupg

# Agregar el repositorio oficial de Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instalar Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verificar
docker --version
docker compose version

# Agregar tu usuario al grupo docker (para no usar sudo)
usermod -aG docker $USER

# Activar Docker para que arranque con el sistema
systemctl enable docker
systemctl start docker
```

---

## 5. Configurar Neon (Base de datos)

### Crear la base de datos:

1. Andá a https://neon.tech
2. Creá una cuenta (gratis con Google/GitHub)
3. Click en **New Project**
4. Nombre: `foto-app`
5. Región: elegí la más cercana a tu VPS
6. Click **Create Project**

### Obtener el connection string:

1. En el dashboard de Neon, andá a tu proyecto
2. Click en **Connection Details** o **Connect**
3. Copiá el **Connection string** (formato: `postgres://user:pass@ep-xxx.aws.neon.tech/foto_app?sslmode=require`)
4. Guardalo, lo vas a necesitar

### Crear las tablas (opcional — tu app lo hace automáticamente):

Tu app tiene migraciones que se ejecutan al iniciar, así que **no necesitás crear tablas manualmente**. Neon + tu app lo hacen solos.

---

## 6. Subir el código

### Opción A: Clonar desde GitHub (recomendado)

```bash
# En el VPS
cd /opt
git clone https://github.com/danidev-100/foto-app.git
cd foto-app
```

### Opción B: SCP desde tu PC

```bash
# Desde tu PC (no desde el VPS)
scp -r C:\Users\DANI\Desktop\foto-app root@tu-ip-del-vps:/opt/foto-app
```

### Opción C: SFTP con FileZilla

1. Descargá FileZilla: https://filezilla-project.org
2. Host: `sftp://tu-ip-del-vps`, User: `root`, Password: tu password
3. Conectar
4. Arrastrá la carpeta `foto-app` a `/opt/`

---

## 7. Configurar variables de entorno

```bash
# En el VPS
cd /opt/foto-app

# Copiar el ejemplo
cp .env.example .env

# Editar
nano .env
```

### Contenido del `.env`:

```env
# ── App ──
APP_PORT=80

# ── Database (Neon) ──
# Pegá acá el connection string que copiaste de Neon
DATABASE_URL=postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/foto_app?sslmode=require

# ── JWT (generá uno nuevo) ──
# En el VPS, podés generar uno con: openssl rand -base64 32
JWT_SECRET=aqui-va-tu-jwt-secret-generado

# ── Mercado Pago ──
MP_ACCESS_TOKEN=tu-token-de-mercadopago
MP_SANDBOX=true
```

### Generar JWT_SECRET:

```bash
openssl rand -base64 32
```

Copiá el resultado y pegalo en el `.env`.

### Guardar y salir de nano:

- `Ctrl + O` → Enter (guardar)
- `Ctrl + X` (salir)

---

## 8. Deploy

```bash
# En el VPS, dentro de /opt/foto-app
cd /opt/foto-app

# Levantar todo
docker compose up -d

# Ver el progreso (los containers se están construyendo)
docker compose logs -f
```

El primer deploy tarda 3-5 minutos porque descarga las imágenes y construye los containers.

---

## 9. Verificar que todo anda

```bash
# Ver los containers corriendo
docker compose ps

# Deberías ver 2 containers: foto-app-backend-1 y foto-app-frontend-1

# Ver logs del backend
docker compose logs backend

# Ver logs del frontend
docker compose logs frontend

# Probar el backend
curl http://localhost:8080/api/health

# Deberías ver algo como: {"status":"ok"}

# Probar el frontend
curl http://localhost

# Deberías ver el HTML de tu app React
```

### Desde tu navegador:

Abrí `http://tu-ip-del-vps` y deberías ver tu app funcionando.

---

## 10. Dominio propio (opcional)

### Comprar un dominio:

- **Namecheap**: https://www.namecheap.com (desde $9/año)
- **Cloudflare Registrar**: https://cloudflare.com (precio de costo, sin markup)

### Configurar DNS:

1. Andá al panel de tu registrador de dominio
2. Creá un registro **A**:
   - **Tipo**: A
   - **Nombre**: `@` (o `www` si querés `www.tudominio.com`)
   - **Valor**: `tu-ip-del-vps`
   - **TTL**: 300 (o automático)

3. Esperá 5-30 minutos a que se propague

4. Verificar:
```bash
nslookup tudominio.com
# Debería mostrar tu IP del VPS
```

---

## 11. HTTPS con Let's Encrypt (opcional)

### Instalar Certbot:

```bash
# En el VPS
apt install -y certbot

# Parar Nginx temporalmente (porque certbot necesita el puerto 80 libre)
docker compose down

# Generar certificado
certbot certonly --standalone -d tudominio.com

# Seguir las instrucciones (poné tu email, aceptar términos)
```

### Configurar HTTPS:

Los certificados se guardan en `/etc/letsencrypt/live/tudominio.com/`

Para usar HTTPS con Docker, necesitás modificar el Nginx del frontend. La forma más simple es usar **Caddy** en vez de Nginx:

```bash
# Instalar Caddy en el VPS
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# Configurar Caddy como reverse proxy
nano /etc/caddy/Caddyfile
```

### Contenido del Caddyfile:

```
tudominio.com {
    reverse_proxy /api/* localhost:8080
    reverse_proxy /* localhost:80
}
```

```bash
# Iniciar Caddy
systemctl enable caddy
systemctl start caddy

# Levantar los containers sin exponer puertos al exterior
# (Caddy se encarga del tráfico)
docker compose up -d
```

Ahora tu app está en `https://tudominio.com` con HTTPS automático.

---

## 12. Mantenimiento

### Ver logs:

```bash
cd /opt/foto-app
docker compose logs -f        # Todos los logs
docker compose logs -f backend # Solo backend
docker compose logs -f frontend # Solo frontend
```

### Actualizar la app:

```bash
cd /opt/foto-app
git pull                      # Bajar los últimos cambios
docker compose down           # Parar containers
docker compose up -d --build  # Rebuild y levantar
```

### Reiniciar servicios:

```bash
docker compose restart
```

### Ver uso de recursos:

```bash
docker stats    # Uso de CPU/RAM por container
df -h           # Uso de disco
free -h         # Uso de memoria RAM
```

### Limpiar imágenes viejas:

```bash
docker system prune -a  # Borra imágenes no usadas (cuidado!)
```

### Backup de la base de datos (Neon):

Neon hace backups automáticos. Pero si querés un backup manual:

```bash
# Desde tu PC (no desde el VPS)
pg_dump "postgres://user:pass@ep-xxx.aws.neon.tech/foto_app?sslmode=require" > backup_$(date +%Y%m%d).sql
```

### Renovar certificado HTTPS:

```bash
# Certbot renueva automáticamente, pero podés forzar:
certbot renew --dry-run
```

---

## Resumen rápido (cheatsheet)

```bash
# 1. Conectar al VPS
ssh root@tu-ip

# 2. Ir al proyecto
cd /opt/foto-app

# 3. Levantar
docker compose up -d

# 4. Ver logs
docker compose logs -f

# 5. Actualizar
git pull && docker compose down && docker compose up -d --build

# 6. Parar
docker compose down
```

---

## Troubleshooting

### El container no arranca:

```bash
# Ver logs
docker compose logs backend

# Error común: DATABASE_URL incorrecto
# Verificá que el connection string de Neon esté bien
```

### El frontend no conecta al backend:

```bash
# Verificar que el backend esté corriendo
curl http://localhost:8080/api/health

# Verificar que Nginx esté proxyando bien
docker compose logs frontend | grep proxy
```

### Puerto 80 ya está en uso:

```bash
# Ver qué está usando el puerto 80
ss -tlnp | grep :80

# Si es otro servicio, paralo o cambiá APP_PORT en el .env
```

### Neon no conecta:

```bash
# Verificar que Neon permita conexiones desde tu VPS
# En Neon → Settings → IP Allow → agregar la IP de tu VPS
# O dejarlo en "Allow all" (menos seguro)
```
