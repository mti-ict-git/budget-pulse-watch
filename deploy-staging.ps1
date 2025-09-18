# Staging Deployment Script for Budget Pulse Watch
# This script deploys the application in staging mode with CIFS network share

Write-Host "=== Budget Pulse Watch - Staging Deployment ===" -ForegroundColor Green

# Check for required environment variables
$requiredVars = @("DOMAIN_USERNAME", "DOMAIN_PASSWORD")
foreach ($var in $requiredVars) {
    if (-not (Get-Content "./backend/.env.staging" | Select-String "^$var=")) {
        Write-Error "Required environment variable $var not found in .env.staging"
        exit 1
    }
}

# Stop existing containers
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.staging.yml down

# Build and start containers
Write-Host "Building and starting staging containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up --build -d

# Check container status
Write-Host "Checking container status..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.staging.yml ps

# Test network share access
Write-Host "Testing network share access..." -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.staging.yml exec backend ls -la /app/shared

# Show logs
Write-Host "Recent logs:" -ForegroundColor Yellow
docker-compose -f docker-compose.yml -f docker-compose.staging.yml logs --tail=20

Write-Host "=== Staging deployment completed ===" -ForegroundColor Green
Write-Host "Frontend: http://localhost:9007" -ForegroundColor Cyan
Write-Host "Backend: http://localhost:5004" -ForegroundColor Cyan
Write-Host "Network share: mounted at /app/shared" -ForegroundColor Cyan