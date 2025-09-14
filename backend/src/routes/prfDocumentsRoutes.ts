import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { Request, Response } from 'express';
import { getPool } from '../config/database';

const router = express.Router();

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

// Get shared folder path from settings
async function getSharedFolderPath(): Promise<string> {
  try {
    const settingsPath = path.join(__dirname, '../../data/settings.json');
    const settingsData = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(settingsData);
    return settings.sharedFolderPath || '';
  } catch (error) {
    console.error('Error reading settings:', error);
    return '';
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
  const folderPath = path.join(sharedFolderPath, prfNo);
  const result: FolderScanResult = {
    prfNo,
    folderPath,
    documents: [],
    totalFiles: 0,
    totalSize: 0
  };

  try {
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
router.post('/sync-folder/:prfNo', async (req: Request, res: Response) => {
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

// API endpoint: Bulk sync all PRF folders
router.post('/sync-all-folders', async (req: Request, res: Response) => {
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

export default router;