import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export interface NetworkAuthConfig {
  domain: string;
  username: string;
  password: string;
  sharePath: string;
}

/**
 * Check if running inside a Docker container
 * @returns boolean
 */
export function isRunningInDocker(): boolean {
  try {
    // Check for Docker-specific files/environment
    return process.env.DOCKER_CONTAINER === 'true' || 
           process.env.NODE_ENV === 'production' ||
           process.platform === 'linux'; // Most Docker containers run Linux
  } catch {
    return false;
  }
}

/**
 * Check if a path exists and is accessible
 * @param path - Path to check
 * @returns Promise<boolean>
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export interface NetworkAuthResult {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * Authenticate with a network share using platform-appropriate method
 * @param config Network authentication configuration
 * @returns Promise<NetworkAuthResult>
 */
export async function authenticateNetworkShare(config: NetworkAuthConfig): Promise<NetworkAuthResult> {
  const { sharePath, username, password, domain = 'mbma.com' } = config;
  
  try {
    // Check if running in Docker/Linux
    if (isRunningInDocker()) {
      console.log('🐳 [NetworkAuth] Running in Docker container - using CIFS mounting');
      return await authenticateLinuxCIFS(config);
    }
    
    // Windows host authentication (original logic)
    return await authenticateWindowsNetUse(config);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [NetworkAuth] Authentication error:`, errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      message: 'Failed to authenticate with network share'
    };
  }
}

/**
 * Authenticate with network share using Linux CIFS mounting
 * @param config Network authentication configuration
 * @returns Promise<NetworkAuthResult>
 */
async function authenticateLinuxCIFS(config: NetworkAuthConfig): Promise<NetworkAuthResult> {
  const { sharePath, username, password, domain = 'mbma.com' } = config;
  
  try {
    // Check if mount point exists
    const mountPoint = process.env.SHARED_FOLDER_PATH || '/app/shared-documents';
    const mountExists = await pathExists(mountPoint);
    
    if (!mountExists) {
      console.log(`📁 [NetworkAuth] Creating mount point: ${mountPoint}`);
      await execAsync(`mkdir -p "${mountPoint}"`);
    }
    
    // Check if already mounted
    const { stdout: mountCheck } = await execAsync('mount | grep cifs || echo "no cifs mounts"');
    if (mountCheck.includes(mountPoint)) {
      console.log(`✅ [NetworkAuth] CIFS share already mounted at: ${mountPoint}`);
      
      // Verify accessibility by listing directory
      try {
        await execAsync(`ls -la "${mountPoint}" | head -5`);
        return {
          success: true,
          message: 'CIFS share already mounted and accessible'
        };
      } catch (listError) {
        console.warn(`⚠️ [NetworkAuth] Mount exists but not accessible, attempting remount`);
        // Continue to remount
      }
    }
    
    // Prepare CIFS mount command
    const domainUser = domain ? `${domain}\\${username}` : username;
    const cifsOptions = [
      `username=${domainUser}`,
      `password=${password}`,
      'uid=1000',
      'gid=1000',
      'iocharset=utf8',
      'file_mode=0777',
      'dir_mode=0777',
      'vers=3.0'
    ].join(',');
    
    // Convert Windows UNC path to Linux format
    const linuxSharePath = sharePath.replace(/\\/g, '/');
    
    console.log(`🔐 [NetworkAuth] Mounting CIFS share: ${linuxSharePath} to ${mountPoint}`);
    console.log(`👤 [NetworkAuth] Using credentials for: ${domainUser}`);
    
    // Mount the CIFS share
    const mountCommand = `mount -t cifs "${linuxSharePath}" "${mountPoint}" -o "${cifsOptions}"`;
    const { stdout, stderr } = await execAsync(mountCommand);
    
    if (stderr && stderr.toLowerCase().includes('error')) {
      console.error(`❌ [NetworkAuth] CIFS mount failed:`, stderr);
      return {
        success: false,
        error: stderr,
        message: 'CIFS mount authentication failed'
      };
    }
    
    // Verify the mount was successful
    try {
      const { stdout: verifyOutput } = await execAsync(`ls -la "${mountPoint}" | head -5`);
      console.log(`✅ [NetworkAuth] CIFS mount successful. Directory contents:`, verifyOutput);
      
      return {
        success: true,
        message: 'CIFS network share mounted successfully'
      };
    } catch (verifyError) {
      console.error(`❌ [NetworkAuth] Mount verification failed:`, verifyError);
      return {
        success: false,
        error: 'Mount verification failed',
        message: 'CIFS mount completed but directory not accessible'
      };
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [NetworkAuth] CIFS authentication error:`, errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      message: 'Failed to authenticate with CIFS network share'
    };
  }
}

/**
 * Authenticate with network share using Windows net use command
 * @param config Network authentication configuration
 * @returns Promise<NetworkAuthResult>
 */
async function authenticateWindowsNetUse(config: NetworkAuthConfig): Promise<NetworkAuthResult> {
  const { sharePath, username, password, domain = 'mbma.com' } = config;
  
  try {
    // Format username with domain
    const domainUser = domain ? `${domain}\\${username}` : username;
    
    // Escape special characters in password
    const escapedPassword = password.replace(/"/g, '\\"');
    
    // Build net use command
    const command = `net use "${sharePath}" /user:"${domainUser}" "${escapedPassword}"`;
    
    console.log(`🔐 [NetworkAuth] Authenticating to share: ${sharePath} with user: ${domainUser}`);
    
    // Execute net use command
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && stderr.includes('error')) {
      console.error(`❌ [NetworkAuth] Authentication failed:`, stderr);
      return {
        success: false,
        error: stderr,
        message: 'Network authentication failed'
      };
    }
    
    console.log(`✅ [NetworkAuth] Successfully authenticated to: ${sharePath}`);
    return {
      success: true,
      message: 'Network authentication successful'
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [NetworkAuth] Windows authentication error:`, errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      message: 'Failed to authenticate with Windows network share'
    };
  }
}

/**
 * Disconnect from a network share
 * @param sharePath The network share path to disconnect from
 * @returns Promise<NetworkAuthResult>
 */
export async function disconnectNetworkShare(sharePath: string): Promise<NetworkAuthResult> {
  try {
    if (isRunningInDocker()) {
      // Linux CIFS unmount
      const mountPoint = process.env.SHARED_FOLDER_PATH || '/app/shared-documents';
      console.log(`🔌 [NetworkAuth] Unmounting CIFS share from: ${mountPoint}`);
      
      try {
        await execAsync(`umount "${mountPoint}"`);
        console.log(`✅ [NetworkAuth] CIFS share unmounted from: ${mountPoint}`);
      } catch (umountError) {
        console.warn(`⚠️ [NetworkAuth] Unmount warning (non-critical):`, umountError);
      }
      
      return {
        success: true,
        message: 'CIFS share disconnected'
      };
    } else {
      // Windows net use disconnect
      const command = `net use "${sharePath}" /delete`;
      
      console.log(`🔌 [NetworkAuth] Disconnecting from share: ${sharePath}`);
      
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && stderr.includes('error')) {
        console.warn(`⚠️ [NetworkAuth] Disconnect warning:`, stderr);
      }
      
      console.log(`✅ [NetworkAuth] Disconnected from: ${sharePath}`);
      return {
        success: true,
        message: 'Network share disconnected'
      };
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`⚠️ [NetworkAuth] Disconnect error (non-critical):`, errorMessage);
    
    // Disconnect errors are often non-critical (share might not be connected)
    return {
      success: true,
      message: 'Disconnect completed (may not have been connected)'
    };
  }
}

/**
 * Check if a network share is already authenticated
 * @param sharePath The network share path to check
 * @returns Promise<boolean>
 */
export async function isNetworkShareAuthenticated(sharePath: string): Promise<boolean> {
  try {
    if (isRunningInDocker()) {
      // Linux CIFS mount check
      const mountPoint = process.env.SHARED_FOLDER_PATH || '/app/shared-documents';
      
      // Check if mount point exists and is mounted
      const { stdout } = await execAsync('mount | grep cifs || echo "no cifs mounts"');
      const isMounted = stdout.includes(mountPoint);
      
      if (isMounted) {
        // Verify accessibility
        try {
          await execAsync(`ls "${mountPoint}" > /dev/null 2>&1`);
          return true;
        } catch {
          return false;
        }
      }
      
      return false;
    } else {
      // Windows net use check
      const command = `net use`;
      const { stdout } = await execAsync(command);
      
      // Check if the share path is in the list of connected drives
      return stdout.includes(sharePath);
    }
    
  } catch (error) {
    console.warn(`⚠️ [NetworkAuth] Could not check share status:`, error);
    return false;
  }
}

/**
 * Ensure network share is authenticated before accessing files
 * This function checks if already authenticated, and if not, authenticates
 * @param config Network authentication configuration
 * @returns Promise<NetworkAuthResult>
 */
export async function ensureNetworkShareAccess(config: NetworkAuthConfig): Promise<NetworkAuthResult> {
  const { sharePath } = config;
  
  try {
    // Check if already authenticated
    const isAuthenticated = await isNetworkShareAuthenticated(sharePath);
    
    if (isAuthenticated) {
      console.log(`✅ [NetworkAuth] Share already authenticated: ${sharePath}`);
      return {
        success: true,
        message: 'Network share already authenticated'
      };
    }
    
    // Not authenticated, attempt authentication
    return await authenticateNetworkShare(config);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ [NetworkAuth] Ensure access error:`, errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      message: 'Failed to ensure network share access'
    };
  }
}

/**
 * Get network authentication configuration from environment variables
 * @returns NetworkAuthConfig | null
 */
export function getNetworkAuthConfig(): NetworkAuthConfig | null {
  const sharedFolderPath = process.env.SHARED_FOLDER_PATH;
  const cifsSharePath = process.env.CIFS_SHARE_PATH;
  const username = process.env.DOMAIN_USERNAME;
  const password = process.env.DOMAIN_PASSWORD;
  
  if (!sharedFolderPath || !username || !password) {
    console.warn(`⚠️ [NetworkAuth] Missing environment variables:`, {
      sharedFolderPath: !!sharedFolderPath,
      username: !!username,
      password: !!password
    });
    return null;
  }
  
  // If SHARED_FOLDER_PATH is a Docker mount point, skip authentication
  if (sharedFolderPath.startsWith('/mnt/') || sharedFolderPath.startsWith('/app/')) {
    console.log(`🐳 [NetworkAuth] Using Docker mount point: ${sharedFolderPath} - skipping CIFS authentication`);
    return null;
  }
  
  // Use CIFS_SHARE_PATH for mounting if available, otherwise use SHARED_FOLDER_PATH
  const sharePath = cifsSharePath || sharedFolderPath;
  
  return {
    sharePath,
    username,
    password,
    domain: 'mbma.com'
  };
}