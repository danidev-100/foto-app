# Deploy en VPS con Docker

## Requisitos

- VPS con Docker y Docker Compose instalados
- Base de datos PostgreSQL en Neon (https://neon.tech)
- Dominio o IP pública

## 1. Preparar el servidor

```bash
# Instalar Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Verificar
docker --version
docker compose version
```

## 2. Subir el código

```bash
# Opción A: Clonar desde GitHub
git clone https://github.com/danidev-100/foto-app.git
cd foto-app

# Opción B: SCP
scp -r foto-app/ user@vps:/opt/foto-app
```

## 3. Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Editar `.env`:

```env
APP_PORT=80
DATABASE_URL=postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/foto_app?sslmode=require
JWT_SECRET=$(openssl rand -base64 32)
MP_ACCESS_TOKEN=tu-token-de-mercadopago
MP_SANDBOX=false
```

## 4. Deploy

```bash
docker compose up -d
```

## 5. Verificar

```bash
# Ver logs
docker compose logs -f

# Ver servicios corriendo
docker compose ps

# Probar backend
curl http://tu-ip:8080/api/health

# Probar frontend
curl http://tu-ip
```

## Comandos útiles

| Comando | Descripción |
|---|---|
| `docker compose up -d` | Iniciar todo |
| `docker compose down` | Detener todo |
| `docker compose logs -f` | Ver logs |
| `docker compose down && docker compose up -d --build` | Rebuild + restart |
| `docker compose down -v` | Detener y borrar datos |

## Arquitectura

```
┌─────────────┐
│   Nginx:80  │ ← Puerto público (frontend)
│  (frontend) │
└──────┬──────┘
       │ /api/* → proxy
       ▼
┌─────────────┐
│  Node:8080  │ ← Backend (Express + Prisma)
│  (interno)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Neon DB   │ ← PostgreSQL en la nube
│  (externo)  │
└─────────────┘
```

- **Frontend**: React/Vite → Nginx sirve estáticos
- **Backend**: Node.js/Express → puerto interno 8080
- **Nginx**: `/api/*` → backend, `/*` → frontend SPA
- **PostgreSQL**: Neon (externo, no se corre en el VPS)
