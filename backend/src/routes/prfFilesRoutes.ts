import express from 'express';
import multer from 'multer';
import { PRFFilesModel } from '../models/PRFFiles';
import type { PRFFile } from '../models/PRFFiles';
import { getSharedStorageService } from '../services/sharedStorageService';
import type { FileStorageResult, SharedStorageConfig } from '../services/sharedStorageService';
import { loadSettings } from './settingsRoutes';
import path from 'path';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireContentManager } from '../middleware/auth';
import { getPool } from '../config/database';

const router = express.Router();

type UploadMultipleResponseItem = {
  file: PRFFile;
  sharedStorage: FileStorageResult;
  originalName: string;
};

type UploadMultipleErrorItem = {
  fileName: string;
  error: string;
};

const tempUploadsDir = path.join(process.cwd(), 'temp', 'prf-uploads');
fsSync.mkdirSync(tempUploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempUploadsDir);
  },
  filename: (req, file, cb) => {
    const prfId = typeof req.params.prfId === 'string' ? req.params.prfId : 'unknown';
    const uploadId = uuidv4();
    const fileExtension = path.extname(file.originalname);
    cb(null, `${prfId}-${uploadId}${fileExtension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|txt)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only documents and images are allowed.'));
    }
  }
});

/**
 * GET /api/prf-files/:prfId
 * Get all files for a specific PRF
 */
router.get('/:prfId', async (req, res) => {
  try {
    const prfId = parseInt(req.params.prfId);
    
    if (isNaN(prfId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PRF ID'
      });
    }
    
    const files = await PRFFilesModel.getByPRFID(prfId);
    
    return res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('Error fetching PRF files:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch PRF files'
    });
  }
});

/**
 * POST /api/prf-files/:prfId/upload-multiple
 * Upload multiple additional files to a PRF
 */
router.post('/:prfId/upload-multiple', authenticateToken, requireContentManager, upload.array('files', 10), async (req, res) => {
  try {
    const prfId = parseInt(req.params.prfId);
    const description = typeof req.body?.description === 'string' ? req.body.description : undefined;
    
    if (isNaN(prfId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PRF ID'
      });
    }
    
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }
    
    const uploadResults: UploadMultipleResponseItem[] = [];
    const errors: UploadMultipleErrorItem[] = [];
    
    const settings = await loadSettings();
    const envSharedFolderPath = typeof process.env.SHARED_FOLDER_PATH === 'string' ? process.env.SHARED_FOLDER_PATH.trim() : '';
    const settingsSharedFolderPath = settings.general?.sharedFolderPath?.trim() || '';
    const basePath = envSharedFolderPath || settingsSharedFolderPath;
    const sharedStorageConfig: SharedStorageConfig = {
      basePath,
      enabled: basePath.length > 0
    };

    if (!sharedStorageConfig.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Shared folder path not configured. Please set it in Settings before uploading documents.'
      });
    }
    
    const sharedStorageService = getSharedStorageService(sharedStorageConfig);
    
    // Get PRF number for shared storage path
    const pool = getPool();
    const prfResult = await pool.request()
      .input('prfId', prfId)
      .query('SELECT PRFNo FROM PRF WHERE PRFID = @prfId');
    
    if (prfResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'PRF not found'
      });
    }
    
    const prfNo = prfResult.recordset[0].PRFNo;

    const files = req.files as Express.Multer.File[];

    for (const file of files) {
      try {
        const { originalname, mimetype, path: tempFilePath, size } = file;
        const fileExtension = path.extname(originalname);
        
        // Copy to shared storage
        const sharedStorageResult = await sharedStorageService.copyFileToSharedStorage(
          tempFilePath,
          prfNo,
          originalname
        );
        
        if (sharedStorageResult.success) {
          // Save file metadata to database
          const fileRecord = await PRFFilesModel.create({
            PRFID: prfId,
            OriginalFileName: originalname,
            FilePath: sharedStorageResult.sharedPath || tempFilePath,
            SharedPath: sharedStorageResult.sharedPath,
            FileSize: size,
            FileType: fileExtension.toLowerCase().replace('.', ''),
            MimeType: mimetype || 'application/octet-stream',
            UploadedBy: 1, // TODO: Get from authenticated user
            IsOriginalDocument: false,
            Description: description || 'Additional document'
          });
          
          uploadResults.push({
            file: fileRecord,
            sharedStorage: sharedStorageResult,
            originalName: originalname
          });
          
          console.log(`📁 File uploaded and saved: ${originalname}`);

          try {
            await fs.unlink(tempFilePath);
          } catch (cleanupError) {
            console.error('Failed to clean up temp file:', cleanupError);
          }
        } else {
          errors.push({
            fileName: originalname,
            error: sharedStorageResult.error || 'Failed to save to shared storage'
          });
          
          // Clean up temp file
          try {
            await fs.unlink(tempFilePath);
          } catch (cleanupError) {
            console.error('Failed to clean up temp file:', cleanupError);
          }
        }
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);
        const errorMessage = fileError instanceof Error ? fileError.message : 'Unknown error';
        errors.push({
          fileName: file.originalname,
          error: errorMessage
        });

        const tempFilePath = typeof file.path === 'string' ? file.path : '';
        if (tempFilePath) {
          try {
            await fs.unlink(tempFilePath);
          } catch {
            // ignore cleanup errors
          }
        }
      }
    }

    const allFailed = uploadResults.length === 0 && errors.length === files.length;
    const isStorageIssue = errors.some(e => /shared storage|network path|permission denied/i.test(e.error));
    const statusCode = uploadResults.length > 0 ? 201 : (allFailed && isStorageIssue ? 503 : 500);

    return res.status(statusCode).json({
      success: uploadResults.length > 0,
      message: `Uploaded ${uploadResults.length} of ${files.length} files successfully`,
      data: {
        uploaded: uploadResults,
        errors: errors
      }
    });
  } catch (error) {
    console.error('Error uploading multiple files:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload files'
    });
  }
});

/**
 * POST /api/prf-files/:prfId/upload
 * Upload additional files to a PRF
 */
router.post('/:prfId/upload', authenticateToken, requireContentManager, upload.single('file'), async (req, res) => {
  try {
    const prfId = parseInt(req.params.prfId);
    const description = typeof req.body?.description === 'string' ? req.body.description : undefined;
    
    if (isNaN(prfId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PRF ID'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const { originalname, mimetype, path: tempFilePath, size } = req.file;
    const fileExtension = path.extname(originalname);
    
    // Copy to shared storage
    let sharedStorageResult = null;
    let fileRecord = null;
    
    try {
      const settings = await loadSettings();
      const envSharedFolderPath = typeof process.env.SHARED_FOLDER_PATH === 'string' ? process.env.SHARED_FOLDER_PATH.trim() : '';
      const settingsSharedFolderPath = settings.general?.sharedFolderPath?.trim() || '';
      const basePath = envSharedFolderPath || settingsSharedFolderPath;
      const sharedStorageConfig: SharedStorageConfig = {
        basePath,
        enabled: basePath.length > 0
      };

      if (!sharedStorageConfig.enabled) {
        return res.status(400).json({
          success: false,
          message: 'Shared folder path not configured. Please set it in Settings before uploading documents.'
        });
      }
      
      const sharedStorageService = getSharedStorageService(sharedStorageConfig);
      
      // Get PRF number for shared storage path
      const pool = getPool();
      const prfResult = await pool.request()
        .input('prfId', prfId)
        .query('SELECT PRFNo FROM PRF WHERE PRFID = @prfId');
      
      if (prfResult.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'PRF not found'
        });
      }
      
      const prfNo = prfResult.recordset[0].PRFNo;
      
      sharedStorageResult = await sharedStorageService.copyFileToSharedStorage(
        tempFilePath,
        prfNo,
        originalname
      );
      
      if (sharedStorageResult.success) {
        // Save file metadata to database
        fileRecord = await PRFFilesModel.create({
          PRFID: prfId,
          OriginalFileName: originalname,
          FilePath: sharedStorageResult.sharedPath || tempFilePath,
          SharedPath: sharedStorageResult.sharedPath,
          FileSize: size,
          FileType: fileExtension.toLowerCase().replace('.', ''),
          MimeType: mimetype || 'application/octet-stream',
          UploadedBy: 1, // TODO: Get from authenticated user
          IsOriginalDocument: false,
          Description: description || 'Additional document'
        });
        
        console.log(`📁 File uploaded and saved: ${originalname}`);

        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.error('Failed to clean up temp file:', cleanupError);
        }
      } else {
        // Clean up temp file if shared storage failed
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.error('Failed to clean up temp file:', cleanupError);
        }
        
        return res.status(500).json({
          success: false,
          message: sharedStorageResult.error || 'Failed to save file to shared storage'
        });
      }
    } catch (storageError) {
      console.error('Storage operation failed:', storageError);
      // Clean up temp file
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', cleanupError);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to save file to storage'
      });
    }
    
    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        file: fileRecord,
        sharedStorage: sharedStorageResult
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload file'
    });
  }
});

/**
 * GET /api/prf-files/file/:fileId
 * Get specific file details
 */
router.get('/file/:fileId', async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    
    if (isNaN(fileId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file ID'
      });
    }
    
    const file = await PRFFilesModel.getById(fileId);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    return res.json({
      success: true,
      data: file
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch file'
    });
  }
});

/**
 * DELETE /api/prf-files/file/:fileId
 * Delete a file (removes from database and shared storage)
 */
router.delete('/file/:fileId', authenticateToken, requireContentManager, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId);
    
    if (isNaN(fileId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file ID'
      });
    }
    
    // Get file details first
    const file = await PRFFilesModel.getById(fileId);
    
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    
    // Don't allow deletion of original OCR documents
    if (file.IsOriginalDocument) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete original OCR document'
      });
    }
    
    // Delete from database
    const deleted = await PRFFilesModel.delete(fileId);
    
    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete file from database'
      });
    }
    
    // TODO: Optionally delete from shared storage
    // This might require additional permissions and careful consideration
    
    return res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

/**
 * GET /api/prf-files/stats
 * Get file statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await PRFFilesModel.getFileStats();
    
    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching file stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch file statistics'
    });
  }
});

/**
 * GET /api/prf-files/original-documents
 * Get all original OCR documents
 */
router.get('/original-documents', async (req, res) => {
  try {
    const { prfId } = req.query;
    const prfIdNum = prfId ? parseInt(prfId as string) : undefined;
    
    const files = await PRFFilesModel.getOriginalDocuments(prfIdNum);
    
    return res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('Error fetching original documents:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch original documents'
    });
  }
});

export default router;
