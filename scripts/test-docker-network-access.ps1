# Docker Network Access Test Script
# This script tests the direct network share access in Docker containers

Write-Host "=== Docker Network Access Test ===" -ForegroundColor Green

# Check if Docker is available
try {
    $dockerVersion = docker --version
    Write-Host "Docker found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Docker is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Build the backend container
Write-Host "`nBuilding backend container..." -ForegroundColor Yellow
try {
    docker compose build backend
    Write-Host "Backend container built successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to build backend container" -ForegroundColor Red
    exit 1
}

# Test network access by running a temporary container
Write-Host "`nTesting network share access..." -ForegroundColor Yellow
$testCommand = @"
import fs from 'fs/promises';
import path from 'path';

async function testNetworkAccess() {
    const sharedPath = process.env.SHARED_FOLDER_PATH;
    console.log('Testing access to:', sharedPath);
    
    try {
        const stats = await fs.stat(sharedPath);
        console.log('✓ Network path accessible');
        console.log('Path type:', stats.isDirectory() ? 'Directory' : 'File');
        
        if (stats.isDirectory()) {
            const files = await fs.readdir(sharedPath);
            console.log('✓ Directory listing successful');
            console.log('Found', files.length, 'items');
            
            // Test reading a few folders (PRF numbers)
            const prfFolders = files.filter(f => /^\d+$/.test(f)).slice(0, 3);
            for (const folder of prfFolders) {
                try {
                    const folderPath = path.join(sharedPath, folder);
                    const folderStats = await fs.stat(folderPath);
                    if (folderStats.isDirectory()) {
                        const folderFiles = await fs.readdir(folderPath);
                        console.log('✓ PRF folder', folder, 'contains', folderFiles.length, 'files');
                    }
                } catch (err) {
                    console.log('⚠ Could not read PRF folder', folder, ':', err.message);
                }
            }
        }
        
        console.log('✓ Network access test completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('✗ Network access failed:', error.message);
        process.exit(1);
    }
}

testNetworkAccess();
"@

# Create temporary test file
$testFile = "test-network-access.mjs"
$testCommand | Out-File -FilePath $testFile -Encoding UTF8

try {
    # Run test in container
    docker compose run --rm -e SHARED_FOLDER_PATH="\\mbma.com\shared\PR_Document\PT Merdeka Tsingshan Indonesia" backend node $testFile
    
    Write-Host "`n✓ Network access test completed" -ForegroundColor Green
} catch {
    Write-Host "`n✗ Network access test failed" -ForegroundColor Red
} finally {
    # Clean up test file
    if (Test-Path $testFile) {
        Remove-Item $testFile
    }
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Green