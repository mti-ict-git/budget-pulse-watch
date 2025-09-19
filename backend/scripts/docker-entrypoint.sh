#!/bin/bash

# Docker Entrypoint Script
# This script runs before the main application to set up network share access

set -e

echo "🚀 Starting Budget Pulse Watch Backend..."

# Check if running as root (needed for mounting)
if [ "$(id -u)" != "0" ]; then
    echo "❌ Error: Container must run as root to mount network shares"
    echo "💡 Add 'user: root' to your docker-compose.yml backend service"
    exit 1
fi

# Mount network share if credentials are provided
if [ -n "$DOMAIN_USERNAME" ] && [ -n "$DOMAIN_PASSWORD" ]; then
    echo "🔗 Network credentials found, mounting shared folder..."
    
    # Make the mount script executable
    chmod +x /app/scripts/mount-network-share.sh
    
    # Run the mount script
    /app/scripts/mount-network-share.sh
    
    echo "✅ Network share setup completed"
else
    echo "⚠️  No network credentials provided, skipping network share mounting"
    echo "   Set DOMAIN_USERNAME and DOMAIN_PASSWORD to enable network share access"
fi

# Switch to nodejs user for running the application
echo "👤 Switching to nodejs user..."
exec su-exec nodejs "$@"