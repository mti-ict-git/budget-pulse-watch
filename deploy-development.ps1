# Development Deployment Script for Budget Pulse Watch
# This script deploys the application in development mode with local shared storage

Write-Host "=== Budget Pulse Watch - Development Deployment ===" -ForegroundColor Green

# Stop existing containers
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.development.yml down

# Build and start containers
Write-Host "Building and starting development containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.development.yml up --build -d

# Check container status
Write-Host "Checking container status..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.development.yml ps

# Show logs
Write-Host "Recent logs:" -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.development.yml logs --tail=20

Write-Host "=== Development deployment completed ===" -ForegroundColor Green
Write-Host "Frontend: http://localhost:9007" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:5004" -ForegroundColor Cyan
Write-Host "Shared storage: ./backend/shared-dev" -ForegroundColor Cyan