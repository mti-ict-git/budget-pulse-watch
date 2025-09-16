# Production Deployment Script for Budget Pulse Watch (PowerShell)
# This script handles building and deploying the application to production on Windows

param(
    [string]$Version = "latest",
    [string]$Environment = "production",
    [string]$Registry = "your-registry.com",
    [switch]$Help
)

# Configuration
$AppName = "budget-pulse-watch"
$ErrorActionPreference = "Stop"

# Colors for output
function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param($Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

function Show-Usage {
    Write-Host "Usage: .\deploy.ps1 [-Version <version>] [-Environment <env>] [-Registry <registry>] [-Help]"
    Write-Host "  -Version: Docker image version tag (default: latest)"
    Write-Host "  -Environment: Deployment environment (default: production)"
    Write-Host "  -Registry: Docker registry URL (default: your-registry.com)"
    Write-Host "  -Help: Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\deploy.ps1                                    # Deploy latest version to production"
    Write-Host "  .\deploy.ps1 -Version v1.2.3                   # Deploy specific version to production"
    Write-Host "  .\deploy.ps1 -Version latest -Environment staging # Deploy latest version to staging"
}

function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    try {
        $null = Get-Command docker -ErrorAction Stop
        $null = docker info 2>$null
    }
    catch {
        Write-Error "Docker is not installed or not running"
        exit 1
    }
    
    # Check if docker-compose is available
    try {
        $null = Get-Command docker-compose -ErrorAction Stop
    }
    catch {
        Write-Error "docker-compose is not installed or not in PATH"
        exit 1
    }
    
    # Check if environment file exists
    $envFile = ".env.$Environment"
    if (-not (Test-Path $envFile)) {
        Write-Error "Environment file $envFile not found"
        Write-Info "Please copy backend/.env.production.template to backend/.env.production and configure it"
        exit 1
    }
    
    Write-Success "Prerequisites check passed"
}

function Build-Images {
    Write-Info "Building Docker images..."
    
    try {
        # Build frontend image
        Write-Info "Building frontend image..."
        docker build -t "$AppName-frontend:$Version" .
        
        # Build backend image
        Write-Info "Building backend image..."
        docker build -t "$AppName-backend:$Version" .\backend
        
        Write-Success "Docker images built successfully"
    }
    catch {
        Write-Error "Failed to build Docker images: $_"
        exit 1
    }
}

function Push-Images {
    if ($Registry -ne "your-registry.com") {
        Write-Info "Tagging and pushing images to registry..."
        
        try {
            # Tag images
            docker tag "$AppName-frontend:$Version" "$Registry/$AppName-frontend:$Version"
            docker tag "$AppName-backend:$Version" "$Registry/$AppName-backend:$Version"
            
            # Push images
            docker push "$Registry/$AppName-frontend:$Version"
            docker push "$Registry/$AppName-backend:$Version"
            
            Write-Success "Images pushed to registry"
        }
        catch {
            Write-Error "Failed to push images: $_"
            exit 1
        }
    }
    else {
        Write-Warning "Docker registry not configured, skipping push"
    }
}

function Deploy-Application {
    Write-Info "Deploying application..."
    
    try {
        # Copy environment file
        Copy-Item ".env.$Environment" ".env" -Force
        
        # Stop existing containers
        Write-Info "Stopping existing containers..."
        docker-compose down --remove-orphans 2>$null
        
        # Start new containers
        Write-Info "Starting new containers..."
        docker-compose up -d
        
        # Wait for services to be healthy
        Write-Info "Waiting for services to be healthy..."
        Start-Sleep -Seconds 30
        
        # Check service health
        Test-ServiceHealth
        
        Write-Success "Application deployed successfully"
    }
    catch {
        Write-Error "Failed to deploy application: $_"
        exit 1
    }
}

function Test-ServiceHealth {
    Write-Info "Checking service health..."
    
    # Check frontend health
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Success "Frontend is healthy"
        }
        else {
            throw "Frontend returned status code $($response.StatusCode)"
        }
    }
    catch {
        Write-Error "Frontend health check failed: $_"
        return $false
    }
    
    # Check backend health
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Success "Backend is healthy"
        }
        else {
            throw "Backend returned status code $($response.StatusCode)"
        }
    }
    catch {
        Write-Error "Backend health check failed: $_"
        return $false
    }
    
    return $true
}

function Invoke-Cleanup {
    Write-Info "Cleaning up unused Docker resources..."
    try {
        docker system prune -f
        docker volume prune -f
        Write-Success "Cleanup completed"
    }
    catch {
        Write-Warning "Cleanup failed: $_"
    }
}

# Main execution
if ($Help) {
    Show-Usage
    exit 0
}

Write-Info "Starting deployment of $AppName version $Version to $Environment"

Test-Prerequisites
Build-Images
Push-Images
Deploy-Application
Invoke-Cleanup

Write-Success "Deployment completed successfully!"
Write-Info "Application is available at:"
Write-Info "  Frontend: http://localhost:8080"
Write-Info "  Backend API: http://localhost:3000"
Write-Info "  Health checks: http://localhost:8080/health and http://localhost:3000/health"