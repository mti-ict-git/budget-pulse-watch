import fs from 'fs/promises';
import path from 'path';
import { ensureNetworkShareAccess, getNetworkAuthConfig, isRunningInDocker } from '../utils/networkAuth';

export interface SharedStorageConfig {
  basePath: string; // \\mbma.com\shared\PR_Document\PT Merdeka Tsingshan Indonesia
  enabled: boolean;
}

export interface FileStorageResult {
  success: boolean;
  sharedPath?: string;
  error?: string;
}

export class SharedStorageService {
  private config: SharedStorageConfig;

  constructor(config: SharedStorageConfig) {
    this.config = config;
  }

  /**
   * Convert Windows network path to Docker mount path
   * @param windowsPath - Windows UNC path
   * @returns Docker mount path
   */
  private convertToDockerPath(windowsPath: string): string {
    if (!isRunningInDocker()) {
      return windowsPath;
    }

    // Convert Windows UNC path to Docker mount path
    // Database paths: \\mbma.com\shared\PR_Document\PT Merdeka Tsingshan Indonesia\...
    // Mount point: /app/shared-documents (where CIFS share is actually mounted)
    // Target: /app/shared-documents/PT Merdeka Tsingshan Indonesia/...
    
    const dockerMountPath = '/app/shared-documents';
    
    // Remove the server and shared folder prefix, keep only the relative path
    let relativePath = windowsPath
      .replace(/^\\\\[^\\]+\\shared\\PR_Document\\?/, '') // Remove \\server\shared\PR_Document\
      .replace(/^\\\\[^\\]+\\shared\\?/, '') // Fallback: Remove \\server\shared\
      .replace(/\\/g, '/'); // Convert backslashes to forward slashes
    
    // If the path starts with "PT Merdeka Tsingshan Indonesia", we're good
    // Otherwise, we might need to add it
    if (!relativePath.startsWith('PT Merdeka Tsingshan Indonesia')) {
      // Check if this is already a relative path within the company folder
      if (relativePath && !relativePath.startsWith('/')) {
        relativePath = 'PT Merdeka Tsingshan Indonesia/' + relativePath;
      }
    }
    
    return path.posix.join(dockerMountPath, relativePath);
  }

  /**
   * Ensure network authentication before accessing shared storage
   * @returns Promise<void>
   * @throws Error if authentication fails
   */
  private async ensureAuthentication(): Promise<void> {
    const authConfig = getNetworkAuthConfig();
    if (authConfig) {
      console.log('🔐 [SharedStorage] Authenticating with network share...');
      const authResult = await ensureNetworkShareAccess(authConfig);
      if (!authResult.success) {
        throw new Error(`Network authentication failed: ${authResult.error}`);
      }
      console.log('✅ [SharedStorage] Network authentication successful');
    } else {
      console.warn('⚠️ [SharedStorage] No network authentication credentials found');
    }
  }

  /**
   * Copy file to shared storage folder organized by PRF number
   * @param sourceFilePath - Path to the source file
   * @param prfNumber - PRF number for folder organization
   * @param originalFileName - Original filename to preserve
   * @returns Promise with storage result
   */
  async copyFileToSharedStorage(
    sourceFilePath: string,
    prfNumber: string,
    originalFileName: string
  ): Promise<FileStorageResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        error: 'Shared storage is disabled'
      };
    }

    try {
      // Ensure network authentication
      await this.ensureAuthentication();

      // Create PRF-specific folder path
      const basePath = this.config.basePath.startsWith('/app/') || this.config.basePath.startsWith('/mnt/')
        ? this.config.basePath
        : this.convertToDockerPath(this.config.basePath);
      const prfFolderPath = path.join(basePath, prfNumber);
      const destinationPath = path.join(prfFolderPath, originalFileName);

      console.log(`📁 [SharedStorage] Creating folder: ${prfFolderPath}`);
      console.log(`📄 [SharedStorage] Destination: ${destinationPath}`);

      // Ensure PRF folder exists
      await fs.mkdir(prfFolderPath, { recursive: true });

      // Copy file to shared storage
      await fs.copyFile(sourceFilePath, destinationPath);

      return {
        success: true,
        sharedPath: destinationPath
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle specific network errors
      if (errorMessage.includes('ENOENT') || errorMessage.includes('network')) {
        return {
          success: false,
          error: `Network path not accessible: ${errorMessage}`
        };
      }
      
      if (errorMessage.includes('EACCES') || errorMessage.includes('permission')) {
        return {
          success: false,
          error: `Permission denied: ${errorMessage}`
        };
      }

      return {
        success: false,
        error: `Failed to copy file to shared storage: ${errorMessage}`
      };
    }
  }

  /**
   * Check if shared storage is accessible
   * @returns Promise<boolean>
   */
  async isAccessible(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      // Ensure network authentication
      await this.ensureAuthentication();
      
      const basePath = this.config.basePath.startsWith('/app/') || this.config.basePath.startsWith('/mnt/')
        ? this.config.basePath
        : this.convertToDockerPath(this.config.basePath);
      console.log(`🔍 [SharedStorage] Checking accessibility of: ${basePath}`);
      
      await fs.access(basePath);
      console.log(`✅ [SharedStorage] Path accessible: ${basePath}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ [SharedStorage] Path not accessible: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Get the full path for a PRF folder
   * @param prfNumber - PRF number
   * @returns Full path to PRF folder
   */
  getPrfFolderPath(prfNumber: string): string {
    const basePath = this.config.basePath.startsWith('/app/') || this.config.basePath.startsWith('/mnt/')
      ? this.config.basePath
      : this.convertToDockerPath(this.config.basePath);
    return path.join(basePath, prfNumber);
  }

  /**
   * Update configuration
   * @param config - New configuration
   */
  updateConfig(config: SharedStorageConfig): void {
    this.config = config;
  }
}

// Default configuration
export const defaultSharedStorageConfig: SharedStorageConfig = {
  basePath: '\\\\mbma.com\\shared\\PR_Document\\PT Merdeka Tsingshan Indonesia',
  enabled: false // Disabled by default until configured
};

// Singleton instance
let sharedStorageInstance: SharedStorageService | null = null;

export function getSharedStorageService(config?: SharedStorageConfig): SharedStorageService {
  if (!sharedStorageInstance) {
    sharedStorageInstance = new SharedStorageService(config || defaultSharedStorageConfig);
  } else if (config) {
    sharedStorageInstance.updateConfig(config);
  }
  return sharedStorageInstance;
}