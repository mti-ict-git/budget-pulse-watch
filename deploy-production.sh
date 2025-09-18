#!/bin/bash

# Production Deployment Script for Budget Pulse Watch
# This script deploys the application with CIFS network share mounting

echo "🚀 Starting production deployment..."

# Check if required environment variables are set
if [ -z "$DOMAIN_USERNAME" ] || [ -z "$DOMAIN_PASSWORD" ]; then
    echo "❌ Error: DOMAIN_USERNAME and DOMAIN_PASSWORD must be set as environment variables"
    echo "Example: export DOMAIN_USERNAME='mbma\\prfservice'"
    echo "         export DOMAIN_PASSWORD='YourSecurePassword123!'"
    exit 1
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.yml -f docker-compose.production.yml down

# Remove existing volumes (optional - uncomment if needed)
# echo "🗑️ Removing existing volumes..."
# docker volume rm budget-pulse-watch_shared_storage 2>/dev/null || true

# Build and start containers
echo "🔨 Building and starting containers..."
docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d --build

# Check container status
echo "📊 Checking container status..."
docker-compose -f docker-compose.yml -f docker-compose.production.yml ps

# Show logs
echo "📋 Showing recent logs..."
docker-compose -f docker-compose.yml -f docker-compose.production.yml logs --tail=20

echo "✅ Deployment complete!"
echo "🌐 Application should be available at: https://pomon.merdekabattery.com:9007"
echo "🔍 To view logs: docker-compose -f docker-compose.yml -f docker-compose.production.yml logs -f"