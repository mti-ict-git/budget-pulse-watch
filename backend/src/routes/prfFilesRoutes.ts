import express from 'express';
import multer from 'multer';
import { PRFFilesModel } from '../models/PRFFiles';
import { getSharedStorageService, SharedStorageConfig } from '../services/sharedStorageService';
import { loadSettings } from './settingsRoutes';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
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
 * POST /api/prf-files/:prfId/upload
 * Upload additional files to a PRF
 */
router.post('/:prfId/upload', upload.single('file'), async (req, res) => {
  try {
    const prfId = parseInt(req.params.prfId);
    const { description } = req.body;
    
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
    
    const { originalname, buffer, mimetype } = req.file;
    const uploadId = uuidv4();
    
    // Save to temp directory first
    const tempDir = path.join(process.cwd(), 'temp', 'prf-uploads');
    await fs.mkdir(tempDir, { recursive: true });
    
    const fileExtension = path.extname(originalname);
    const tempFilePath = path.join(tempDir, `${prfId}-${uploadId}${fileExtension}`);
    await fs.writeFile(tempFilePath, buffer);
    
    // Copy to shared storage
    let sharedStorageResult = null;
    let fileRecord = null;
    
    try {
      // Load settings to configure shared storage
      const settings = await loadSettings();
      const sharedStorageConfig: SharedStorageConfig = {
        basePath: settings.general?.sharedFolderPath || '',
        enabled: !!(settings.general?.sharedFolderPath?.trim())
      };
      
      const sharedStorageService = getSharedStorageService(sharedStorageConfig);
      
      // Get PRF number for shared storage path
      // TODO: Fetch actual PRF number from database
      const prfNo = `PRF-${prfId.toString().padStart(6, '0')}`;
      
      sharedStorageResult = await sharedStorageService.copyFileToSharedStorage(
        tempFilePath,
        prfNo,
        originalname
      );
      
      if (sharedStorageResult.success) {
        // Save file metadata to database
        const fileStats = await fs.stat(tempFilePath);
        fileRecord = await PRFFilesModel.create({
          PRFID: prfId,
          OriginalFileName: originalname,
          FilePath: tempFilePath,
          SharedPath: sharedStorageResult.sharedPath,
          FileSize: fileStats.size,
          FileType: fileExtension.toLowerCase().replace('.', ''),
          MimeType: mimetype || 'application/octet-stream',
          UploadedBy: 1, // TODO: Get from authenticated user
          IsOriginalDocument: false,
          Description: description || 'Additional document'
        });
        
        console.log(`📁 File uploaded and saved: ${originalname}`);
      } else {
        // Clean up temp file if shared storage failed
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.error('Failed to clean up temp file:', cleanupError);
        }
        
        return res.status(500).json({
          success: false,
          message: 'Failed to save file to shared storage'
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
router.delete('/file/:fileId', async (req, res) => {
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