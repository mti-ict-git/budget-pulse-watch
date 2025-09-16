# Production Deployment Guide

This guide covers deploying Budget Pulse Watch to production using Docker containers.

## Prerequisites

### System Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+
- Minimum 4GB RAM
- Minimum 20GB disk space
- Linux/Windows Server with network access

### Required Services
- PostgreSQL 15+ (included in docker-compose)
- ~~Redis 7+ (removed - not needed for this application)~~
- LDAP server (optional, for authentication)
- SMTP server (optional, for notifications)

## Quick Start

### 1. Clone and Setup
```bash
git clone <repository-url>
cd budget-pulse-watch
```

### 2. Configure Environment
```bash
# Copy environment template
cp backend/.env.production.template backend/.env.production

# Edit configuration
nano backend/.env.production
```

### 3. Deploy
```bash
# Linux/macOS
./scripts/deploy.sh

# Windows
.\scripts\deploy.ps1
```

## Detailed Configuration

### Environment Variables

Edit `backend/.env.production` with your specific values:

#### Database Configuration
```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=budget_pulse
DB_USER=postgres
DB_PASSWORD=your_secure_password_here
```

#### Security Configuration
```env
JWT_SECRET=your_very_long_and_secure_jwt_secret_key_here
SESSION_SECRET=your_secure_session_secret_here
BCRYPT_ROUNDS=12
```

#### LDAP Configuration (Optional)
```env
LDAP_URL=ldap://your-ldap-server:389
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=your_ldap_password
LDAP_SEARCH_BASE=ou=users,dc=company,dc=com
```

### SSL/HTTPS Setup

#### Option 1: Using Reverse Proxy (Recommended)
```bash
# Create nginx directory
mkdir -p nginx/ssl

# Copy SSL certificates
cp your-cert.pem nginx/ssl/
cp your-key.pem nginx/ssl/

# Update nginx configuration
# Edit nginx/nginx.conf for SSL settings
```

#### Option 2: Using Let's Encrypt
```bash
# Install certbot
sudo apt-get install certbot

# Generate certificates
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates to nginx directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/
```

## Deployment Options

### Standard Deployment
```bash
docker-compose up -d
```

### Docker Swarm Deployment
```bash
# Initialize swarm
docker swarm init

# Create secrets
echo "your_db_password" | docker secret create budget_pulse_db_password -
echo "your_jwt_secret" | docker secret create budget_pulse_jwt_secret -
# echo "your_redis_password" | docker secret create budget_pulse_redis_password - (Redis removed)

# Deploy stack
docker stack deploy -c docker-compose.yml -c docker-compose.secrets.yml budget-pulse
```

### Kubernetes Deployment
```bash
# Create namespace
kubectl create namespace budget-pulse

# Create secrets
kubectl create secret generic budget-pulse-secrets \
  --from-literal=db-password=your_db_password \
  --from-literal=jwt-secret=your_jwt_secret \
  # --from-literal=redis-password=your_redis_password \ (Redis removed)
  -n budget-pulse

# Apply manifests (create k8s/ directory with manifests)
kubectl apply -f k8s/ -n budget-pulse
```

## Monitoring and Health Checks

### Health Check Endpoints
- Frontend: `http://localhost:8080/health`
- Backend: `http://localhost:3000/health`
- Database: Built-in Docker health checks
- ~~Redis: Built-in Docker health checks~~ (Redis removed)

### Monitoring Setup
```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f frontend
docker-compose logs -f backend

# Monitor resource usage
docker stats
```

### Log Management
```bash
# Configure log rotation in docker-compose.yml
services:
  frontend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Backup and Recovery

### Database Backup
```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres budget_pulse > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker-compose exec -T postgres psql -U postgres budget_pulse < backup_file.sql
```

### Volume Backup
```bash
# Backup volumes
docker run --rm -v budget-pulse-watch_postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
# docker run --rm -v budget-pulse-watch_redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz /data (Redis removed)
```

## Security Best Practices

### 1. Network Security
- Use internal Docker networks
- Expose only necessary ports
- Implement firewall rules
- Use HTTPS in production

### 2. Container Security
- Run containers as non-root users
- Use minimal base images (Alpine)
- Regularly update base images
- Scan images for vulnerabilities

### 3. Secrets Management
- Never commit secrets to version control
- Use Docker secrets or external secret management
- Rotate secrets regularly
- Use strong, unique passwords

### 4. Access Control
- Implement proper RBAC
- Use LDAP/AD integration
- Enable audit logging
- Regular access reviews

## Scaling

### Horizontal Scaling
```bash
# Scale backend services
docker-compose up -d --scale backend=3

# Use load balancer (nginx, HAProxy, etc.)
# Configure in nginx.conf:
upstream backend {
    server backend_1:3000;
    server backend_2:3000;
    server backend_3:3000;
}
```

### Database Scaling
- Implement read replicas
- Use connection pooling
- Optimize queries and indexes
- Consider database sharding for large datasets

## Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker-compose logs service_name

# Check resource usage
docker system df
docker system prune
```

#### Database Connection Issues
```bash
# Test database connectivity
docker-compose exec backend node -e "console.log('DB test')"

# Check database logs
docker-compose logs postgres
```

#### Performance Issues
```bash
# Monitor resource usage
docker stats

# Check application metrics
curl http://localhost:3000/metrics
```

### Emergency Procedures

#### Rollback Deployment
```bash
# Stop current deployment
docker-compose down

# Deploy previous version
docker-compose up -d
```

#### Database Recovery
```bash
# Stop application
docker-compose stop backend frontend

# Restore database
docker-compose exec -T postgres psql -U postgres budget_pulse < backup_file.sql

# Restart application
docker-compose start backend frontend
```

## Maintenance

### Regular Tasks
- Update Docker images monthly
- Backup database weekly
- Monitor disk space daily
- Review logs weekly
- Update SSL certificates before expiry

### Update Procedure
```bash
# Pull latest images
docker-compose pull

# Restart services
docker-compose up -d

# Clean up old images
docker image prune -f
```

## Support

For deployment issues:
1. Check logs: `docker-compose logs`
2. Verify configuration: Review `backend/.env.production`
3. Test connectivity: Use health check endpoints
4. Check resources: Monitor CPU, memory, disk usage
5. Review documentation: This guide and API documentation

## Performance Tuning

### Database Optimization
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_prf_status ON prfs(status);
CREATE INDEX idx_prf_created_at ON prfs(created_at);

-- Configure PostgreSQL settings
-- Edit postgresql.conf:
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
```

### Application Optimization
- ~~Enable Redis caching~~ (Redis removed - not needed)
- Implement connection pooling
- Use CDN for static assets
- Enable gzip compression
- Optimize bundle size

### Infrastructure Optimization
- Use SSD storage
- Implement proper monitoring
- Configure log rotation
- Use container resource limits