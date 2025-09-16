#!/bin/bash

# Production Deployment Script for Budget Pulse Watch
# This script handles building and deploying the application to production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="budget-pulse-watch"
DOCKER_REGISTRY="your-registry.com"  # Update with your registry
VERSION=${1:-latest}
ENVIRONMENT=${2:-production}

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose is not installed or not in PATH"
        exit 1
    fi
    
    # Check if environment file exists
    if [ ! -f ".env.${ENVIRONMENT}" ]; then
        log_error "Environment file .env.${ENVIRONMENT} not found"
        log_info "Please copy backend/.env.production.template to backend/.env.production and configure it"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

build_images() {
    log_info "Building Docker images..."
    
    # Build frontend image
    log_info "Building frontend image..."
    docker build -t ${APP_NAME}-frontend:${VERSION} .
    
    # Build backend image
    log_info "Building backend image..."
    docker build -t ${APP_NAME}-backend:${VERSION} ./backend
    
    log_success "Docker images built successfully"
}

tag_and_push() {
    if [ "$DOCKER_REGISTRY" != "your-registry.com" ]; then
        log_info "Tagging and pushing images to registry..."
        
        # Tag images
        docker tag ${APP_NAME}-frontend:${VERSION} ${DOCKER_REGISTRY}/${APP_NAME}-frontend:${VERSION}
        docker tag ${APP_NAME}-backend:${VERSION} ${DOCKER_REGISTRY}/${APP_NAME}-backend:${VERSION}
        
        # Push images
        docker push ${DOCKER_REGISTRY}/${APP_NAME}-frontend:${VERSION}
        docker push ${DOCKER_REGISTRY}/${APP_NAME}-backend:${VERSION}
        
        log_success "Images pushed to registry"
    else
        log_warning "Docker registry not configured, skipping push"
    fi
}

deploy_application() {
    log_info "Deploying application..."
    
    # Copy environment file
    cp .env.${ENVIRONMENT} .env
    
    # Stop existing containers
    log_info "Stopping existing containers..."
    docker-compose down --remove-orphans || true
    
    # Start new containers
    log_info "Starting new containers..."
    docker-compose up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    check_health
    
    log_success "Application deployed successfully"
}

check_health() {
    log_info "Checking service health..."
    
    # Check frontend health
    if curl -f http://localhost:8080/health &> /dev/null; then
        log_success "Frontend is healthy"
    else
        log_error "Frontend health check failed"
        return 1
    fi
    
    # Check backend health
    if curl -f http://localhost:3000/health &> /dev/null; then
        log_success "Backend is healthy"
    else
        log_error "Backend health check failed"
        return 1
    fi
}

cleanup() {
    log_info "Cleaning up unused Docker resources..."
    docker system prune -f
    docker volume prune -f
    log_success "Cleanup completed"
}

show_usage() {
    echo "Usage: $0 [VERSION] [ENVIRONMENT]"
    echo "  VERSION: Docker image version tag (default: latest)"
    echo "  ENVIRONMENT: Deployment environment (default: production)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Deploy latest version to production"
    echo "  $0 v1.2.3            # Deploy specific version to production"
    echo "  $0 latest staging     # Deploy latest version to staging"
}

# Main execution
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_usage
    exit 0
fi

log_info "Starting deployment of ${APP_NAME} version ${VERSION} to ${ENVIRONMENT}"

check_prerequisites
build_images
tag_and_push
deploy_application
cleanup

log_success "Deployment completed successfully!"
log_info "Application is available at:"
log_info "  Frontend: http://localhost:8080"
log_info "  Backend API: http://localhost:3000"
log_info "  Health checks: http://localhost:8080/health and http://localhost:3000/health"