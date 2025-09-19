#!/bin/bash

# Network Share Mounting Script for Docker Container
# This script mounts the Windows network share to match the database file paths

set -e

echo "🔗 Starting network share mounting..."

# Environment variables (should be set in docker-compose or .env)
SHARE_HOST="${SHARE_HOST:-mbma.com}"
SHARE_PATH="${SHARE_PATH:-shared/PR_Document/PT Merdeka Tsingshan Indonesia}"
DOMAIN_USER="${DOMAIN_USERNAME:-}"
DOMAIN_PASS="${DOMAIN_PASSWORD:-}"
MOUNT_POINT="/mbma.com/shared/PR_Document/PT Merdeka Tsingshan Indonesia"

# Check if required environment variables are set
if [ -z "$DOMAIN_USER" ] || [ -z "$DOMAIN_PASS" ]; then
    echo "❌ Error: DOMAIN_USERNAME and DOMAIN_PASSWORD must be set"
    exit 1
fi

# Create mount point directory
echo "📁 Creating mount point: $MOUNT_POINT"
mkdir -p "$MOUNT_POINT"

# Check if already mounted
if mountpoint -q "$MOUNT_POINT"; then
    echo "✅ Network share already mounted at $MOUNT_POINT"
    exit 0
fi

# Mount the network share
echo "🔐 Mounting network share..."
echo "   Source: //$SHARE_HOST/$SHARE_PATH"
echo "   Target: $MOUNT_POINT"
echo "   User: $DOMAIN_USER"

# Mount with CIFS
mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
    -o username="$DOMAIN_USER",password="$DOMAIN_PASS",domain=mbma.com,uid=1000,gid=1000,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=3.0

# Verify mount
if mountpoint -q "$MOUNT_POINT"; then
    echo "✅ Network share mounted successfully!"
    echo "📂 Testing access..."
    
    # Test directory listing
    if ls "$MOUNT_POINT" > /dev/null 2>&1; then
        echo "✅ Network share is accessible"
        echo "📊 Found $(ls -1 "$MOUNT_POINT" | wc -l) items in shared folder"
    else
        echo "⚠️  Network share mounted but not accessible"
        exit 1
    fi
else
    echo "❌ Failed to mount network share"
    exit 1
fi

echo "🎉 Network share setup completed!"