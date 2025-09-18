import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface NetworkAuthConfig {
  sharePath: string;
  username: string;
  password: string;
  domain?: string;
}

export interface NetworkAuthResult {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * Authenticate with a Windows network share using net use command
 * @param config Network authentication configuration
 * @returns Promise<NetworkAuthResult>
 */
export async function authenticateNetworkShare(config: NetworkAuthConfig): Promise<NetworkAuthResult> {
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
    console.error(`❌ [NetworkAuth] Authentication error:`, errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      message: 'Failed to authenticate with network share'
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
    const command = `net use`;
    const { stdout } = await execAsync(command);
    
    // Check if the share path is in the list of connected drives
    return stdout.includes(sharePath);
    
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
  const sharePath = process.env.SHARED_FOLDER_PATH;
  const username = process.env.DOMAIN_USERNAME;
  const password = process.env.DOMAIN_PASSWORD;
  
  if (!sharePath || !username || !password) {
    console.warn(`⚠️ [NetworkAuth] Missing environment variables:`, {
      sharePath: !!sharePath,
      username: !!username,
      password: !!password
    });
    return null;
  }
  
  return {
    sharePath,
    username,
    password,
    domain: 'mbma.com'
  };
}