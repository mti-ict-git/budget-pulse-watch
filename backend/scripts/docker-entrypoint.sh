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

# Support both the newer CIFS_* variables and the existing legacy DOMAIN_* / CIFS_SHARE_PATH variables.
if [ -n "$CIFS_USERNAME" ] && [ -n "$CIFS_PASSWORD" ]; then
    export DOMAIN_USERNAME="$CIFS_USERNAME"
    export DOMAIN_PASSWORD="$CIFS_PASSWORD"
fi

if [ -n "$CIFS_SHARE_PATH" ] && { [ -z "$CIFS_SERVER" ] || [ -z "$CIFS_SHARE" ]; }; then
    share_without_prefix="${CIFS_SHARE_PATH#//}"
    export CIFS_SERVER="${CIFS_SERVER:-${share_without_prefix%%/*}}"
    share_remainder="${share_without_prefix#*/}"
    export CIFS_SHARE="${CIFS_SHARE:-${share_remainder%%/*}}"
fi

# Mount network share if either env style is present
if { [ -n "$CIFS_USERNAME" ] && [ -n "$CIFS_PASSWORD" ]; } || { [ -n "$DOMAIN_USERNAME" ] && [ -n "$DOMAIN_PASSWORD" ]; }; then
    echo "🔗 Network share credentials found, mounting shared folder..."

    # Only set SHARED_FOLDER_PATH if it's not already set to a Docker mount point
    if [ -z "$SHARED_FOLDER_PATH" ] || [ "${SHARED_FOLDER_PATH#/app/}" = "$SHARED_FOLDER_PATH" ] && [ "${SHARED_FOLDER_PATH#/mnt/}" = "$SHARED_FOLDER_PATH" ]; then
        if [ -n "$CIFS_SERVER" ] && [ -n "$CIFS_SHARE" ]; then
            export SHARED_FOLDER_PATH="//$CIFS_SERVER/$CIFS_SHARE"
            echo "📁 Setting SHARED_FOLDER_PATH to: $SHARED_FOLDER_PATH"
        else
            echo "⚠️  Share host/path is not fully defined, mount may be skipped by mount-network-share.sh"
        fi
    else
        echo "📁 Using existing Docker mount point: $SHARED_FOLDER_PATH"
    fi

    # Make the mount script executable
    chmod +x /app/scripts/mount-network-share.sh

    # Run the mount script
    /app/scripts/mount-network-share.sh

    echo "✅ Network share setup completed"
else
    echo "⚠️  No network share credentials provided, skipping network share mounting"
    echo "   Supported env styles: CIFS_USERNAME/CIFS_PASSWORD or DOMAIN_USERNAME/DOMAIN_PASSWORD"
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
