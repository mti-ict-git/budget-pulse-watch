# Production Deployment Guide

This repository deploys to production with Docker Compose using a React frontend, an Express backend, and a dedicated `pronto_sync` worker. SQL Server runs outside Docker.

## Current Production Entry Points

- Compose file: `docker-compose.production.yml`
- Deploy script: `deploy-production.sh`
- Environment file: `backend/.env.production`
- Environment template: `backend/.env.production.template`

## Runtime Ports

- Frontend: `9007 -> 8080`
- Backend: `5004 -> 3001`

## Quick Start

### 1. Prepare the environment file

```bash
cp backend/.env.production.template backend/.env.production
```

Set the real values in `backend/.env.production`.

Minimum required keys:

```env
DB_SERVER=your-sql-server-host
DB_NAME=PRFMonitoringDB
DB_USER=sa
DB_PASSWORD=your-sql-password
JWT_SECRET=your-jwt-secret
SETTINGS_ENCRYPTION_KEY=your-settings-encryption-key
PORT=3001
FRONTEND_URL=http://localhost:9007
CORS_ORIGIN=http://localhost:9007
```

If production must mount the network share from inside the backend container, keep using the existing env style if that is what your server already has:

```env
DOMAIN_USERNAME=your-domain-username
DOMAIN_PASSWORD=your-domain-password
SHARED_FOLDER_PATH=/app/shared-documents
CIFS_SHARE_PATH=//your-file-server/your-share-name
```

The newer `CIFS_SERVER` / `CIFS_SHARE` / `CIFS_USERNAME` / `CIFS_PASSWORD` format is also supported, but not required.

### 2. Run the deployment script

```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

The script will:

- validate `backend/.env.production`
- create required local folders
- build and start Docker services
- wait for backend health
- run backend migrations
- wait for frontend health
- print container status and recent logs

## Manual Commands

### Deploy

```bash
docker compose -f docker-compose.production.yml up -d --build
```

### Run migrations

```bash
docker compose -f docker-compose.production.yml exec -T backend npm run db:migrate
```

### Check status

```bash
docker compose -f docker-compose.production.yml ps
```

### View logs

```bash
docker compose -f docker-compose.production.yml logs -f
```

## Service Layout

### Frontend

- Built from the repository root `Dockerfile`
- Served by Nginx on port `8080`
- Proxies `/api` requests to `backend:3001`

### Backend

- Built from `backend/Dockerfile`
- Runs on port `3001`
- Uses Chromium from the container image for OCR/PDF workflows
- Mounts:
  - `./backend/data -> /app/data`
  - `./backend/temp -> /app/temp`
  - `./docs -> /app/docs:ro`

### Pronto Sync

- Built from `backend/pronto-sync/Dockerfile`
- Uses the same production environment file
- Stores artifacts in `./backend/artifacts`
- Talks to backend via `http://backend:3001`

## Health Checks

- Frontend: `http://localhost:9007/health`
- Backend: `http://localhost:5004/health`

## Troubleshooting

### Build fails on Puppeteer download

- The backend image already sets `PUPPETEER_SKIP_DOWNLOAD=true`
- Chromium is installed inside the runtime image
- Rebuild with:

```bash
docker compose -f docker-compose.production.yml build backend --no-cache
```

### Build fails on esbuild `ETXTBSY`

- The frontend builder now uses Node 20 and foreground npm scripts
- Rebuild with:

```bash
docker compose -f docker-compose.production.yml build frontend --no-cache
```

### Backend stays unhealthy

- Check logs:

```bash
docker compose -f docker-compose.production.yml logs -f backend
```

- Confirm `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT=3001`
- If legacy network-share env is used, confirm these keys are present:
  - `DOMAIN_USERNAME`
  - `DOMAIN_PASSWORD`
  - `CIFS_SHARE_PATH`
- If newer CIFS env is used, confirm these keys are present:
  - `CIFS_SERVER`
  - `CIFS_SHARE`
  - `CIFS_USERNAME`
  - `CIFS_PASSWORD`

### Rollback

If you need to stop the current production stack:

```bash
docker compose -f docker-compose.production.yml down
```
