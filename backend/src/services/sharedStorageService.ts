import fs from 'fs/promises';
import path from 'path';

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
      // Create PRF-specific folder path
      const prfFolderPath = path.join(this.config.basePath, prfNumber);
      const destinationPath = path.join(prfFolderPath, originalFileName);

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
      await fs.access(this.config.basePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the full path for a PRF folder
   * @param prfNumber - PRF number
   * @returns Full path to PRF folder
   */
  getPrfFolderPath(prfNumber: string): string {
    return path.join(this.config.basePath, prfNumber);
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