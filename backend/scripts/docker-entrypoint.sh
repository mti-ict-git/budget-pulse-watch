#!/bin/sh

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
if [ -n "$CIFS_USERNAME" ] && [ -n "$CIFS_PASSWORD" ]; then
    echo "🔗 CIFS credentials found, mounting shared folder..."
    
    # Set environment variables for the mount script
    export DOMAIN_USERNAME="$CIFS_USERNAME"
    export DOMAIN_PASSWORD="$CIFS_PASSWORD"
    
    # Only set SHARED_FOLDER_PATH if it's not already set to a Docker mount point
    if [ -z "$SHARED_FOLDER_PATH" ] || [ "${SHARED_FOLDER_PATH#/app/}" = "$SHARED_FOLDER_PATH" ] && [ "${SHARED_FOLDER_PATH#/mnt/}" = "$SHARED_FOLDER_PATH" ]; then
        export SHARED_FOLDER_PATH="//$CIFS_SERVER/$CIFS_SHARE"
        echo "📁 Setting SHARED_FOLDER_PATH to: $SHARED_FOLDER_PATH"
    else
        echo "📁 Using existing Docker mount point: $SHARED_FOLDER_PATH"
    fi
    
    # Make the mount script executable
    chmod +x /app/scripts/mount-network-share.sh
    
    # Run the mount script
    /app/scripts/mount-network-share.sh
    
    echo "✅ Network share setup completed"
else
    echo "⚠️  No CIFS credentials provided, skipping network share mounting"
    echo "   Set CIFS_USERNAME and CIFS_PASSWORD to enable network share access"
fi

mkdir -p /app/data /app/temp

if chown -R nodejs:nodejs /app/data /app/temp 2>/dev/null; then
    echo "✅ Set write permissions for /app/data and /app/temp"
else
    echo "⚠️  Could not change ownership for /app/data and /app/temp"
fi

# Switch to nodejs user for running the application
echo "👤 Switching to nodejs user..."
exec su-exec nodejs "$@"
