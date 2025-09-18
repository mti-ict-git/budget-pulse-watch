# Docker Deployment Guide

This guide explains how to deploy the Budget Pulse Watch application using Docker with different environment configurations.

## Environment Configurations

### Development Environment
- **Purpose**: Local development with hot reload
- **Shared Storage**: Local directory (`./backend/shared-dev`)
- **Database**: Development database
- **Command**: `./deploy-development.ps1`

### Staging Environment
- **Purpose**: Testing production-like setup
- **Shared Storage**: CIFS network mount (same as production)
- **Database**: Staging database
- **Command**: `./deploy-staging.ps1`

### Production Environment
- **Purpose**: Live production deployment
- **Shared Storage**: CIFS network mount
- **Database**: Production database
- **Command**: `./deploy-production.ps1`

## Prerequisites

### For Development
- Docker and Docker Compose installed
- No additional network configuration required

### For Staging/Production
- Docker and Docker Compose installed
- Network access to:
  - SQL Server (10.60.10.47:1433)
  - LDAP Server (10.60.10.56:636)
  - Network Share (//mbma.com/shared)
- Domain credentials configured in environment files

## Environment Files

### `.env.production`
```bash
# Network Share Authentication
DOMAIN_USERNAME=mbma\prfservice
DOMAIN_PASSWORD=YourSecurePassword123!
SHARED_FOLDER_PATH=/app/shared
```

### `.env.staging`
Similar to production but with staging-specific database and URLs.

## Docker Compose Files

- `docker-compose.yml` - Base configuration
- `docker-compose.development.yml` - Development overrides
- `docker-compose.staging.yml` - Staging overrides  
- `docker-compose.production.yml` - Production overrides

## Network Share Configuration

The application uses CIFS mounting to access the network share:

```yaml
volumes:
  shared_storage:
    driver: local
    driver_opts:
      type: cifs
      o: "username=${DOMAIN_USERNAME},password=${DOMAIN_PASSWORD},domain=mbma.com,uid=1000,gid=1000,iocharset=utf8,file_mode=0777,dir_mode=0777"
      device: "//mbma.com/shared/PR_Document/PT Merdeka Tsingshan Indonesia"
```

## Deployment Commands

### Development
```powershell
./deploy-development.ps1
```

### Staging
```powershell
./deploy-staging.ps1
```

### Production
```powershell
./deploy-production.ps1
```

## Troubleshooting

### Network Share Issues
1. Verify domain credentials in environment file
2. Check network connectivity to share
3. Ensure Docker has permission to mount CIFS volumes
4. Check container logs: `docker-compose logs backend`

### Database Connection Issues
1. Verify database server accessibility
2. Check firewall settings
3. Validate credentials and connection string

### LDAP Authentication Issues
1. Verify LDAP server connectivity
2. Check certificate trust settings
3. Validate bind DN and credentials

## Monitoring

### Check Container Status
```bash
docker-compose ps
```

### View Logs
```bash
docker-compose logs -f backend
```

### Test Network Share Access
```bash
docker-compose exec backend ls -la /app/shared
```

## Security Considerations

- Environment files contain sensitive credentials
- Use proper file permissions (600) for .env files
- Regularly rotate domain service account passwords
- Monitor container logs for security events
- Use encrypted database connections (DB_ENCRYPT=true)