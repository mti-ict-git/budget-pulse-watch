#!/bin/sh

# Network Share Mounting Script for Docker Container
# This script mounts the Windows network share to match the database file paths

set -e

echo "🔗 Starting network share mounting..."

# Parse SHARED_FOLDER_PATH environment variable
SHARED_FOLDER_PATH="${SHARED_FOLDER_PATH:-//10.60.10.44/pr_document/PT Merdeka Tsingshan Indonesia}"
DOMAIN_USER="${DOMAIN_USERNAME:-}"
DOMAIN_PASS="${DOMAIN_PASSWORD:-}"

# Extract components from SHARED_FOLDER_PATH (format: //host/share/path)
# Remove leading //
CLEAN_PATH=$(echo "$SHARED_FOLDER_PATH" | sed 's|^//||')
# Extract host (everything before first /)
SHARE_HOST=$(echo "$CLEAN_PATH" | cut -d'/' -f1)
# Extract base share name (second component)
BASE_SHARE=$(echo "$CLEAN_PATH" | cut -d'/' -f2)
# Extract subfolder path (everything after second /)
SUBFOLDER_PATH=$(echo "$CLEAN_PATH" | cut -d'/' -f3-)

# Mount only the base share, not the full path
SHARE_PATH="$BASE_SHARE"
# Create mount point for the base share
MOUNT_POINT="/mnt/network-share"
# Full path to the target folder within the mounted share
TARGET_PATH="$MOUNT_POINT/$SUBFOLDER_PATH"

echo "📋 Configuration:"
echo "   SHARED_FOLDER_PATH: $SHARED_FOLDER_PATH"
echo "   SHARE_HOST: $SHARE_HOST"
echo "   BASE_SHARE: $BASE_SHARE"
echo "   SUBFOLDER_PATH: $SUBFOLDER_PATH"
echo "   MOUNT_POINT: $MOUNT_POINT"
echo "   TARGET_PATH: $TARGET_PATH"

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
echo "   Final Target Folder: $TARGET_PATH"

# Extract username without domain prefix if present
CLEAN_USER=$(echo "$DOMAIN_USER" | sed 's/.*\\//')

# Mount with CIFS - try different approaches
echo "🔐 Attempting mount with cleaned username: $CLEAN_USER"

# Try different authentication methods
echo "🔐 Trying multiple authentication approaches..."

# Attempt 1: NTLM with domain
if mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
    -o username="$CLEAN_USER",password="$DOMAIN_PASS",domain=mbma,uid=1000,gid=1000,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=3.0,sec=ntlm 2>/dev/null; then
    echo "✅ Mount successful with NTLM authentication"
# Attempt 2: NTLMSSP with domain
elif mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
    -o username="$CLEAN_USER",password="$DOMAIN_PASS",domain=mbma,uid=1000,gid=1000,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=3.0,sec=ntlmssp 2>/dev/null; then
    echo "✅ Mount successful with NTLMSSP authentication"
# Attempt 3: No security (for older systems)
elif mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
    -o username="$CLEAN_USER",password="$DOMAIN_PASS",domain=mbma,uid=1000,gid=1000,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=2.0,sec=none 2>/dev/null; then
    echo "✅ Mount successful with no security (SMB 2.0)"
# Attempt 4: Full domain\username format
elif mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
    -o username="$DOMAIN_USER",password="$DOMAIN_PASS",uid=1000,gid=1000,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=3.0,sec=ntlm 2>/dev/null; then
    echo "✅ Mount successful with full domain\\username"
# Attempt 5: SMB 1.0 (legacy)
elif mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
    -o username="$CLEAN_USER",password="$DOMAIN_PASS",domain=mbma,uid=1000,gid=1000,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=1.0,sec=ntlm 2>/dev/null; then
    echo "✅ Mount successful with SMB 1.0"
else
    echo "❌ All mount attempts failed. Trying final attempt with verbose output..."
    if ! mount -t cifs "//$SHARE_HOST/$SHARE_PATH" "$MOUNT_POINT" \
        -o username="$CLEAN_USER",password="$DOMAIN_PASS",domain=mbma,uid=1000,gid=1000,iocharset=utf8,file_mode=0644,dir_mode=0755,vers=3.0,sec=ntlm; then
        echo "❌ Final mount attempt also failed"
    fi
fi

# Verify mount
if mountpoint -q "$MOUNT_POINT"; then
    echo "✅ Network share mounted successfully!"
    echo "📂 Testing access to base share..."
    
    # Test directory listing of base share
    if ls "$MOUNT_POINT" > /dev/null 2>&1; then
        echo "✅ Base network share is accessible"
        echo "📊 Found $(ls -1 "$MOUNT_POINT" | wc -l) items in base share"
        
        # Test access to target subfolder
        echo "📂 Testing access to target folder: $TARGET_PATH"
        if [ -d "$TARGET_PATH" ]; then
            echo "✅ Target folder exists and is accessible"
            if ls "$TARGET_PATH" > /dev/null 2>&1; then
                echo "📊 Found $(ls -1 "$TARGET_PATH" | wc -l) items in target folder"
            else
                echo "⚠️  Target folder exists but listing failed"
            fi
        else
            echo "⚠️  Target folder does not exist: $TARGET_PATH"
            echo "📋 Available folders in base share:"
            ls -la "$MOUNT_POINT" | head -10
        fi
    else
        echo "⚠️  Network share mounted but not accessible"
        echo "⚠️  Continuing without mount for troubleshooting..."
    fi
else
    echo "❌ Failed to mount network share"
    echo "⚠️  Continuing without mount for troubleshooting..."
fi

echo "🎉 Network share setup completed!"