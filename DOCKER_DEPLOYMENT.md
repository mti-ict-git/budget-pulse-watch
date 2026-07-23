# Docker Deployment Guide

This repository uses Docker Compose for all container-based environments. For production, the single source of truth is:

- `docker-compose.production.yml`
- `deploy-production.sh`
- `backend/.env.production`

## Production

```bash
cp backend/.env.production.template backend/.env.production
chmod +x deploy-production.sh
./deploy-production.sh
```

The production script will validate the environment file, build containers, start the stack, run backend migrations, and verify frontend/backend health checks.

## Services

- `frontend`: React build served by Nginx on host port `9007`
- `backend`: Express API on host port `5004`, container port `3001`
- `pronto_sync`: background worker connected to `http://backend:3001`
- `pronto_sync` persists browser session artifacts under `./backend/artifacts`

## Notes

- SQL Server is external and configured through `backend/.env.production`
- Existing network-share env is supported:
  - `DOMAIN_USERNAME`
  - `DOMAIN_PASSWORD`
  - `CIFS_SHARE_PATH`
- Newer CIFS env is also supported:
  - `CIFS_SERVER`
  - `CIFS_SHARE`
  - `CIFS_USERNAME`
  - `CIFS_PASSWORD`
- Production deploys use `docker compose`, not legacy `docker-compose`

## Useful Commands

```bash
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f
docker compose -f docker-compose.production.yml down
```

See `DEPLOYMENT.md` for the detailed production workflow and troubleshooting notes.
