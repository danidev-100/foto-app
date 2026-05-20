# Deploy en VPS con Docker

## Requisitos

- VPS con Docker y Docker Compose instalados
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
POSTGRES_PASSWORD=tu-password-seguro
JWT_SECRET=$(openssl rand -base64 32)
MP_ACCESS_TOKEN=tu-token-de-mercadopago
MP_SANDBOX=false
```

## 4. Deploy

```bash
make docker-up
# o: docker compose up -d
```

## 5. Verificar

```bash
# Ver logs
make docker-logs

# Ver servicios corriendo
docker compose ps

# Probar
curl http://tu-ip/api/health
```

## Comandos útiles

| Comando | Descripción |
|---|---|
| `make docker-up` | Iniciar todo |
| `make docker-down` | Detener todo |
| `make docker-logs` | Ver logs |
| `make docker-redeploy` | Rebuild + restart |
| `make docker-clean` | Detener y borrar datos |

## Arquitectura

```
┌─────────────┐
│   Nginx:80  │ ← Puerto público
│  (frontend) │
└──────┬──────┘
       │ /api/* → proxy
       ▼
┌─────────────┐
│  Go:8080    │ ← Backend
│  (interno)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │ ← Volumen persistente
│  (interno)  │
└─────────────┘
```

- **Frontend**: React/Vite → Nginx sirve estáticos
- **Backend**: Go/Fiber → puerto interno 8080
- **Nginx**: `/api/*` → backend, `/*` → frontend SPA
- **PostgreSQL**: datos en volumen `pgdata`
