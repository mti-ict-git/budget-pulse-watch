#!/bin/sh

# Network Share Mounting Script for Docker Container
# This script mounts the Windows network share using CIFS environment variables

set -e

echo "🔗 Starting network share mounting..."

# Use new CIFS environment variables
SHARE_HOST="${NETWORK_SHARE_SERVER:-${CIFS_SERVER:-}}"
SHARE_PATH="${NETWORK_SHARE_PATH:-${CIFS_SHARE:-}}"
DOMAIN_USER="${CIFS_USERNAME:-${DOMAIN_USERNAME:-}}"
DOMAIN_PASS="${CIFS_PASSWORD:-${DOMAIN_PASSWORD:-}}"

# Create mount point for the share
MOUNT_POINT="/app/shared-documents"
# Full path to the target folder within the mounted share
TARGET_PATH="$MOUNT_POINT"

echo "📋 Configuration:"
echo "   SHARE_HOST: $SHARE_HOST"
echo "   SHARE_PATH: $SHARE_PATH"
echo "   MOUNT_POINT: $MOUNT_POINT"
echo "   TARGET_PATH: $TARGET_PATH"
echo "   DOMAIN_USER: $DOMAIN_USER"

# Check if required environment variables are set
if [ -z "$DOMAIN_USER" ] || [ -z "$DOMAIN_PASS" ]; then
    echo "❌ Error: CIFS_USERNAME/CIFS_PASSWORD or DOMAIN_USERNAME/DOMAIN_PASSWORD must be set"
    exit 1
fi

if [ -z "$SHARE_HOST" ] || [ -z "$SHARE_PATH" ]; then
    echo "❌ Error: CIFS_SERVER and CIFS_SHARE must be set"
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

# Extract username without domain prefix if present
CLEAN_USER=$(echo "$DOMAIN_USER" | sed 's/.*\\//')

# Mount with CIFS - try different approaches
echo "🔐 Attempting mount with cleaned username: $CLEAN_USER"

# Try different authentication methods
echo "🔐 Trying multiple authentication approaches..."

# Attempt 1: NTLM with domain
if mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
    -o username="$CLEAN_USER",password="$DOMAIN_PASS",domain=mbma,uid=1001,gid=65533,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=3.0,sec=ntlm 2>/dev/null; then
    echo "✅ Mount successful with NTLM authentication"
# Attempt 2: NTLMSSP with domain
elif mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
    -o username="$CLEAN_USER",password="$DOMAIN_PASS",domain=mbma,uid=1001,gid=65533,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=3.0,sec=ntlmssp 2>/dev/null; then
    echo "✅ Mount successful with NTLMSSP authentication"
# Attempt 3: No security (for older systems)
elif mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
    -o username="$CLEAN_USER",password="$DOMAIN_PASS",domain=mbma,uid=1001,gid=65533,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=2.0,sec=none 2>/dev/null; then
    echo "✅ Mount successful with no security (SMB 2.0)"
# Attempt 4: Full domain\username format
elif mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
    -o username="$DOMAIN_USER",password="$DOMAIN_PASS",uid=1001,gid=65533,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=3.0,sec=ntlm 2>/dev/null; then
    echo "✅ Mount successful with full domain\\username"
# Attempt 5: SMB 1.0 (legacy)
elif mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
    -o username="$CLEAN_USER",password="$DOMAIN_PASS",domain=mbma,uid=1001,gid=65533,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=1.0,sec=ntlm 2>/dev/null; then
    echo "✅ Mount successful with SMB 1.0"
else
    echo "❌ All mount attempts failed. Trying final attempt with verbose output..."
    if ! mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
        -o username="$CLEAN_USER",password="$DOMAIN_PASS",domain=mbma,uid=1001,gid=65533,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=3.0,sec=ntlm; then
        echo "❌ Final mount attempt also failed"
    fi
fi

# Verify mount
if mountpoint -q "$MOUNT_POINT"; then
    echo "✅ Network share mounted successfully!"
    echo "📂 Testing access to mounted share..."
    
    # Test directory listing of mounted share
    if ls "$MOUNT_POINT" > /dev/null 2>&1; then
        echo "✅ Network share is accessible"
        echo "📊 Found $(ls -1 "$MOUNT_POINT" | wc -l) items in mounted share"
        echo "📋 Sample contents:"
        ls -la "$MOUNT_POINT" | head -5
    else
        echo "⚠️  Network share mounted but not accessible"
        echo "⚠️  Continuing without mount for troubleshooting..."
    fi
else
    echo "❌ Failed to mount network share"
    echo "⚠️  Continuing without mount for troubleshooting..."
fi

echo "🎉 Network share setup completed!"