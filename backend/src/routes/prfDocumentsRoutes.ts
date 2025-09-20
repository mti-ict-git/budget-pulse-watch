import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { Request, Response } from 'express';
import { getPool } from '../config/database';
import { authenticateToken, requireContentManager } from '../middleware/auth';
import { ensureNetworkShareAccess, getNetworkAuthConfig, isRunningInDocker } from '../utils/networkAuth';

const router = express.Router();

/**
 * Convert Windows network path to Docker mount path
 * @param windowsPath - Windows UNC path
 * @returns Docker mount path or original path if not in Docker
 */
function convertToDockerPath(windowsPath: string): string {
  if (!isRunningInDocker()) {
    return windowsPath;
  }

  // Convert Windows UNC path to Docker mount path
  // Database paths: \\mbma.com\shared\PR_Document\PT Merdeka Tsingshan Indonesia\...
  // Mount point: /app/shared-documents (from //10.60.10.44/pr_document)
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

interface PRFDocument {
  FileID: number;
  PRFID: number;
  OriginalFileName: string;
  FilePath: string;
  SharedPath: string | null;
  FileSize: number;
  FileType: string;
  MimeType: string;
  UploadDate: Date;
  UploadedBy: number;
  IsOriginalDocument: boolean;
  Description: string | null;
}

interface FolderScanResult {
  prfNo: string;
  folderPath: string;
  documents: {
    fileName: string;
    filePath: string;
    fileSize: number;
    fileType: string;
    mimeType: string;
    lastModified: Date;
  }[];
  totalFiles: number;
  totalSize: number;
}

// Get shared folder path from settings or environment with network authentication
async function getSharedFolderPath(): Promise<string> {
  try {
    // First check environment variable (for Docker production)
    const envPath = process.env.SHARED_FOLDER_PATH;
    if (envPath) {
      console.log('Using shared folder path from environment:', envPath);
      
      // Authenticate with network share if credentials are available
      const authConfig = getNetworkAuthConfig();
      if (authConfig) {
        console.log('🔐 Authenticating with network share...');
        const authResult = await ensureNetworkShareAccess(authConfig);
        if (!authResult.success) {
          console.error('❌ Network authentication failed:', authResult.error);
          throw new Error(`Network authentication failed: ${authResult.error}`);
        }
        console.log('✅ Network authentication successful');
      } else {
        console.warn('⚠️ No network authentication credentials found - attempting direct access');
      }
      
      return envPath;
    }

    // Fallback to settings file (for development)
    const settingsFilePath = path.join(__dirname, '../../data/settings.json');
    const settingsData = await fs.readFile(settingsFilePath, 'utf-8');
    const settings = JSON.parse(settingsData);
    const settingsSharedPath = settings.general?.sharedFolderPath || '';
    console.log('Using shared folder path from settings:', settingsSharedPath);
    return settingsSharedPath;
  } catch (error) {
    console.error('Error reading settings or authenticating:', error);
    throw error;
  }
}

// Get MIME type based on file extension
function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Scan a specific PRF folder for documents
async function scanPRFFolder(prfNo: string, sharedFolderPath: string): Promise<FolderScanResult> {
  // Only convert to Docker path if it's not already a Docker mount point
  const dockerPath = sharedFolderPath.startsWith('/app/') || sharedFolderPath.startsWith('/mnt/') 
    ? sharedFolderPath 
    : convertToDockerPath(sharedFolderPath);
  const folderPath = path.join(dockerPath, prfNo);
  const result: FolderScanResult = {
    prfNo,
    folderPath,
    documents: [],
    totalFiles: 0,
    totalSize: 0
  };

  try {
    console.log(`📁 [PRFDocuments] Scanning folder: ${folderPath}`);
    // Check if folder exists
    await fs.access(folderPath);
    
    // Read folder contents recursively
    const scanDirectory = async (dirPath: string): Promise<void> => {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          // Recursively scan subdirectories
          await scanDirectory(itemPath);
        } else if (item.isFile()) {
          try {
            const stats = await fs.stat(itemPath);
            const fileType = path.extname(item.name).toLowerCase().substring(1);
            
            result.documents.push({
              fileName: item.name,
              filePath: itemPath,
              fileSize: stats.size,
              fileType: fileType || 'unknown',
              mimeType: getMimeType(item.name),
              lastModified: stats.mtime
            });
            
            result.totalFiles++;
            result.totalSize += stats.size;
          } catch (fileError) {
            console.error(`Error reading file ${itemPath}:`, fileError);
          }
        }
      }
    };
    
    await scanDirectory(folderPath);
  } catch (error) {
    console.error(`Error scanning folder ${folderPath}:`, error);
    // Folder doesn't exist or access denied - return empty result
  }
  
  return result;
}

// API endpoint: Scan specific PRF folder
router.get('/scan-folder/:prfNo', async (req: Request, res: Response) => {
  try {
    const { prfNo } = req.params;
    
    if (!prfNo) {
      return res.status(400).json({
        success: false,
        message: 'PRF number is required'
      });
    }
    
    const sharedFolderPath = await getSharedFolderPath();
    if (!sharedFolderPath) {
      return res.status(400).json({
        success: false,
        message: 'Shared folder path not configured. Please configure it in Settings.'
      });
    }
    
    const scanResult = await scanPRFFolder(prfNo, sharedFolderPath);
    
    return res.json({
      success: true,
      data: scanResult
    });
  } catch (error) {
    console.error('Error scanning PRF folder:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to scan PRF folder',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API endpoint: Sync PRF folder to database
router.post('/sync-folder/:prfNo', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const { prfNo } = req.params;
    const { userId = 1 } = req.body; // Default user ID, should come from auth
    
    if (!prfNo) {
      return res.status(400).json({
        success: false,
        message: 'PRF number is required'
      });
    }
    
    // Get PRF ID from database
    const prfQuery = 'SELECT PRFID FROM PRF WHERE PRFNo = ?';
    const pool = getPool();
    const prfResult = await pool.request()
      .input('prfNo', prfNo)
      .query('SELECT PRFID FROM PRF WHERE PRFNo = @prfNo');
    
    if (prfResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `PRF ${prfNo} not found in database`
      });
    }
    
    const prfId = prfResult.recordset[0].PRFID;
    
    // Scan folder for documents
    const sharedFolderPath = await getSharedFolderPath();
    if (!sharedFolderPath) {
      return res.status(400).json({
        success: false,
        message: 'Shared folder path not configured'
      });
    }
    
    const scanResult = await scanPRFFolder(prfNo, sharedFolderPath);
    
    // Clear existing files for this PRF (optional - or update existing)
    await pool.request()
      .input('prfId', prfId)
      .query('DELETE FROM PRFFiles WHERE PRFID = @prfId AND IsOriginalDocument = 0');
    
    // Insert new files
    let insertedCount = 0;
    for (const doc of scanResult.documents) {
      try {
        await pool.request()
          .input('prfId', prfId)
          .input('originalFileName', doc.fileName)
          .input('filePath', doc.filePath)
          .input('sharedPath', doc.filePath)
          .input('fileSize', doc.fileSize)
          .input('fileType', doc.fileType)
          .input('mimeType', doc.mimeType)
          .input('uploadedBy', userId)
          .input('isOriginalDocument', false)
          .input('description', `Auto-synced from folder ${prfNo}`)
          .query(`
            INSERT INTO PRFFiles (
              PRFID, OriginalFileName, FilePath, SharedPath, FileSize, 
              FileType, MimeType, UploadedBy, IsOriginalDocument, Description
            ) VALUES (
              @prfId, @originalFileName, @filePath, @sharedPath, @fileSize,
              @fileType, @mimeType, @uploadedBy, @isOriginalDocument, @description
            )
          `);
        insertedCount++;
      } catch (insertError) {
        console.error(`Error inserting file ${doc.fileName}:`, insertError);
      }
    }
    
    return res.json({
      success: true,
      data: {
        prfNo,
        prfId,
        folderPath: scanResult.folderPath,
        totalFiles: scanResult.totalFiles,
        insertedFiles: insertedCount,
        totalSize: scanResult.totalSize
      }
    });
  } catch (error) {
    console.error('Error syncing PRF folder:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync PRF folder',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API endpoint: Get documents for a PRF
router.get('/documents/:prfId', async (req: Request, res: Response) => {
  try {
    const { prfId } = req.params;
    
    const pool = getPool();
    const result = await pool.request()
      .input('prfId', prfId)
      .query(`
        SELECT 
          FileID, PRFID, OriginalFileName, FilePath, SharedPath,
          FileSize, FileType, MimeType, UploadDate, UploadedBy,
          IsOriginalDocument, Description
        FROM PRFFiles 
        WHERE PRFID = @prfId
        ORDER BY UploadDate DESC
      `);
    
    return res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error getting PRF documents:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get PRF documents',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API endpoint: Download a specific document
router.get('/download/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    
    const pool = getPool();
    const result = await pool.request()
      .input('fileId', fileId)
      .query(`
        SELECT 
          FileID, PRFID, OriginalFileName, FilePath, SharedPath,
          FileSize, FileType, MimeType, UploadDate, UploadedBy,
          IsOriginalDocument, Description
        FROM PRFFiles 
        WHERE FileID = @fileId
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    const file = result.recordset[0];
    const filePath = file.SharedPath || file.FilePath;
    
    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: 'File path not available'
      });
    }
    
    try {
      // Convert to Docker path if running in container and not already a Docker mount point
      const actualFilePath = filePath.startsWith('/app/') || filePath.startsWith('/mnt/')
        ? filePath
        : convertToDockerPath(filePath);
      console.log(`📥 [PRFDocuments] Downloading file: ${actualFilePath}`);
      
      // Check if file exists
      await fs.access(actualFilePath);
      
      // Set appropriate headers
      res.setHeader('Content-Disposition', `attachment; filename="${file.OriginalFileName}"`);
      res.setHeader('Content-Type', file.MimeType);
      res.setHeader('Content-Length', file.FileSize);
      
      // Stream the file
      const fileBuffer = await fs.readFile(actualFilePath);
      return res.send(fileBuffer);
    } catch (fileError) {
      console.error('Error reading file:', fileError);
      return res.status(404).json({
        success: false,
        message: 'File not found on disk'
      });
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download file',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API endpoint: Serve a file for viewing (inline)
router.get('/view/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    
    const pool = getPool();
    const result = await pool.request()
      .input('fileId', fileId)
      .query(`
        SELECT 
          FileID, PRFID, OriginalFileName, FilePath, SharedPath,
          FileSize, FileType, MimeType, UploadDate, UploadedBy,
          IsOriginalDocument, Description
        FROM PRFFiles 
        WHERE FileID = @fileId
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    const file = result.recordset[0];
    const filePath = file.SharedPath || file.FilePath;
    
    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: 'File path not available'
      });
    }
    
    try {
      // Convert to Docker path if running in container and not already a Docker mount point
      const actualFilePath = filePath.startsWith('/app/') || filePath.startsWith('/mnt/')
        ? filePath
        : convertToDockerPath(filePath);
      console.log(`📄 [PRFDocuments] Accessing file: ${actualFilePath}`);
      
      // Check if file exists
      await fs.access(actualFilePath);
      
      // Set appropriate headers for inline viewing
      res.setHeader('Content-Type', file.MimeType);
      res.setHeader('Content-Length', file.FileSize);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Stream the file
      const fileBuffer = await fs.readFile(actualFilePath);
      return res.send(fileBuffer);
    } catch (fileError) {
      console.error('Error reading file:', fileError);
      return res.status(404).json({
        success: false,
        message: 'File not found on disk'
      });
    }
  } catch (error) {
    console.error('Error serving file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to serve file',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API endpoint: Bulk sync all PRF folders
router.post('/sync-all-folders', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const { userId = 1 } = req.body;
    
    // Get all PRF numbers from database
    const pool = getPool();
    const prfResult = await pool.request()
      .query('SELECT PRFID, PRFNo FROM PRF WHERE PRFNo IS NOT NULL');
    
    const sharedFolderPath = await getSharedFolderPath();
    if (!sharedFolderPath) {
      return res.status(400).json({
        success: false,
        message: 'Shared folder path not configured'
      });
    }
    
    const results = [];
    let totalSynced = 0;
    
    for (const prf of prfResult.recordset) {
      try {
        const scanResult = await scanPRFFolder(prf.PRFNo, sharedFolderPath);
        
        if (scanResult.totalFiles > 0) {
          // Clear existing auto-synced files
          await pool.request()
            .input('prfId', prf.PRFID)
            .query('DELETE FROM PRFFiles WHERE PRFID = @prfId AND IsOriginalDocument = 0');
          
          // Insert new files
          let insertedCount = 0;
          for (const doc of scanResult.documents) {
            try {
              await pool.request()
                .input('prfId', prf.PRFID)
                .input('originalFileName', doc.fileName)
                .input('filePath', doc.filePath)
                .input('sharedPath', doc.filePath)
                .input('fileSize', doc.fileSize)
                .input('fileType', doc.fileType)
                .input('mimeType', doc.mimeType)
                .input('uploadedBy', userId)
                .input('isOriginalDocument', false)
                .input('description', `Auto-synced from folder ${prf.PRFNo}`)
                .query(`
                  INSERT INTO PRFFiles (
                    PRFID, OriginalFileName, FilePath, SharedPath, FileSize, 
                    FileType, MimeType, UploadedBy, IsOriginalDocument, Description
                  ) VALUES (
                    @prfId, @originalFileName, @filePath, @sharedPath, @fileSize,
                    @fileType, @mimeType, @uploadedBy, @isOriginalDocument, @description
                  )
                `);
              insertedCount++;
            } catch (insertError) {
              console.error(`Error inserting file ${doc.fileName} for PRF ${prf.PRFNo}:`, insertError);
            }
          }
          
          results.push({
            prfNo: prf.PRFNo,
            prfId: prf.PRFID,
            totalFiles: scanResult.totalFiles,
            insertedFiles: insertedCount,
            folderPath: scanResult.folderPath
          });
          
          totalSynced += insertedCount;
        }
      } catch (error) {
        console.error(`Error syncing PRF ${prf.PRFNo}:`, error);
        results.push({
          prfNo: prf.PRFNo,
          prfId: prf.PRFID,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return res.json({
      success: true,
      data: {
        totalPRFs: prfResult.recordset.length,
        syncedPRFs: results.filter(r => !r.error).length,
        totalFilesSynced: totalSynced,
        results
      }
    });
  } catch (error) {
    console.error('Error bulk syncing folders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk sync folders',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API endpoint: Bulk sync (alias for sync-all-folders with frontend-compatible response)
router.post('/bulk-sync', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const { userId = 1 } = req.body;
    
    // Get all PRF numbers from database
    const pool = getPool();
    const prfResult = await pool.request()
      .query('SELECT PRFID, PRFNo FROM PRF WHERE PRFNo IS NOT NULL');
    
    const sharedFolderPath = await getSharedFolderPath();
    if (!sharedFolderPath) {
      return res.status(400).json({
        success: false,
        message: 'Shared folder path not configured'
      });
    }
    
    const results = [];
    let totalSynced = 0;
    let foldersProcessed = 0;
    
    for (const prf of prfResult.recordset) {
      try {
        const scanResult = await scanPRFFolder(prf.PRFNo, sharedFolderPath);
        
        if (scanResult.totalFiles > 0) {
          // Clear existing auto-synced files
          await pool.request()
            .input('prfId', prf.PRFID)
            .query('DELETE FROM PRFFiles WHERE PRFID = @prfId AND IsOriginalDocument = 0');
          
          // Insert new files
          let insertedCount = 0;
          for (const doc of scanResult.documents) {
            try {
              await pool.request()
                .input('prfId', prf.PRFID)
                .input('originalFileName', doc.fileName)
                .input('filePath', doc.filePath)
                .input('sharedPath', doc.filePath)
                .input('fileSize', doc.fileSize)
                .input('fileType', doc.fileType)
                .input('mimeType', doc.mimeType)
                .input('uploadedBy', userId)
                .input('isOriginalDocument', false)
                .input('description', `Auto-synced from folder ${prf.PRFNo}`)
                .query(`
                  INSERT INTO PRFFiles (
                    PRFID, OriginalFileName, FilePath, SharedPath, FileSize, 
                    FileType, MimeType, UploadedBy, IsOriginalDocument, Description
                  ) VALUES (
                    @prfId, @originalFileName, @filePath, @sharedPath, @fileSize,
                    @fileType, @mimeType, @uploadedBy, @isOriginalDocument, @description
                  )
                `);
              insertedCount++;
            } catch (insertError) {
              console.error(`Error inserting file ${doc.fileName} for PRF ${prf.PRFNo}:`, insertError);
            }
          }
          
          if (insertedCount > 0) {
            foldersProcessed++;
            totalSynced += insertedCount;
          }
          
          results.push({
            prfNo: prf.PRFNo,
            prfId: prf.PRFID,
            totalFiles: scanResult.totalFiles,
            insertedFiles: insertedCount,
            folderPath: scanResult.folderPath
          });
        }
      } catch (error) {
        console.error(`Error syncing PRF ${prf.PRFNo}:`, error);
        results.push({
          prfNo: prf.PRFNo,
          prfId: prf.PRFID,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return res.json({
      success: true,
      data: {
        totalSynced,
        foldersProcessed,
        totalPRFs: prfResult.recordset.length,
        results
      }
    });
  } catch (error) {
    console.error('Error bulk syncing folders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk sync folders',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;