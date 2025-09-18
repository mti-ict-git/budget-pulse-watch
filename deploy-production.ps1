# Production Deployment Script for Budget Pulse Watch (PowerShell)
# This script deploys the application with CIFS network share mounting

Write-Host "🚀 Starting production deployment..." -ForegroundColor Green

# Check if required environment variables are set
if (-not $env:DOMAIN_USERNAME -or -not $env:DOMAIN_PASSWORD) {
    Write-Host "❌ Error: DOMAIN_USERNAME and DOMAIN_PASSWORD must be set as environment variables" -ForegroundColor Red
    Write-Host "Example: `$env:DOMAIN_USERNAME='mbma\prfservice'" -ForegroundColor Yellow
    Write-Host "         `$env:DOMAIN_PASSWORD='YourSecurePassword123!'" -ForegroundColor Yellow
    exit 1
}

# Stop existing containers
Write-Host "🛑 Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.production.yml down

# Remove existing volumes (optional - uncomment if needed)
# Write-Host "🗑️ Removing existing volumes..." -ForegroundColor Yellow
# docker volume rm budget-pulse-watch_shared_storage 2>$null

# Build and start containers
Write-Host "🔨 Building and starting containers..." -ForegroundColor Blue
docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d --build

# Check container status
Write-Host "📊 Checking container status..." -ForegroundColor Cyan
docker-compose -f docker-compose.yml -f docker-compose.production.yml ps

# Show logs
Write-Host "📋 Showing recent logs..." -ForegroundColor Magenta
docker-compose -f docker-compose.yml -f docker-compose.production.yml logs --tail=20

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "🌐 Application should be available at: https://pomon.merdekabattery.com:9007" -ForegroundColor Cyan
Write-Host "🔍 To view logs: docker-compose -f docker-compose.yml -f docker-compose.production.yml logs -f" -ForegroundColor Yellow