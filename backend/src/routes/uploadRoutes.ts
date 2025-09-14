import express from 'express';
import multer from 'multer';
import { ocrService } from '../services/ocrService';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    const allowedMimes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp',
      'application/pdf'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF, BMP, WebP) and PDF files are allowed.'));
    }
  }
});

// Upload and process PRF document
router.post('/prf-document', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Check if OCR service is enabled
    const isOCREnabled = await ocrService.isEnabled();
    if (!isOCREnabled) {
      return res.status(503).json({
        success: false,
        message: 'OCR service is not configured. Please set up Gemini API key in settings.'
      });
    }

    const { buffer, mimetype, originalname } = req.file;
    
    // Generate unique ID for this upload session
    const uploadId = uuidv4();
    
    try {
      // Extract PRF data using OCR
      const extractedData = await ocrService.extractPRFData(buffer, mimetype);
      
      // Save the uploaded file temporarily (optional, for debugging/review)
      const tempDir = path.join(process.cwd(), 'temp', 'uploads');
      await fs.mkdir(tempDir, { recursive: true });
      
      const fileExtension = path.extname(originalname);
      const tempFilePath = path.join(tempDir, `${uploadId}${fileExtension}`);
      await fs.writeFile(tempFilePath, buffer);
      
      return res.json({
        success: true,
        uploadId,
        originalFilename: originalname,
        extractedData,
        tempFilePath: tempFilePath,
        message: 'Document processed successfully'
      });
      
    } catch (ocrError) {
      console.error('OCR processing failed:', ocrError);
      return res.status(500).json({
        success: false,
        message: `OCR processing failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`,
        uploadId
      });
    }
    
  } catch (error) {
    console.error('Upload processing failed:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Upload processing failed'
    });
  }
});

// Test OCR service endpoint
router.get('/ocr/test', async (req, res) => {
  try {
    const testResult = await ocrService.testConnection();
    res.json(testResult);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'OCR test failed'
    });
  }
});

// Get OCR service status
router.get('/ocr/status', async (req, res) => {
  try {
    const isEnabled = await ocrService.isEnabled();
    res.json({
      enabled: isEnabled,
      message: isEnabled ? 'OCR service is ready' : 'OCR service is not configured'
    });
  } catch (error) {
    res.status(500).json({
      enabled: false,
      message: error instanceof Error ? error.message : 'Failed to check OCR status'
    });
  }
});

// Clean up temporary files (optional endpoint for maintenance)
router.delete('/cleanup/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const tempDir = path.join(process.cwd(), 'temp', 'uploads');
    
    // Find and delete files with this uploadId
    const files = await fs.readdir(tempDir).catch(() => []);
    const filesToDelete = files.filter(file => file.startsWith(uploadId));
    
    for (const file of filesToDelete) {
      await fs.unlink(path.join(tempDir, file)).catch(console.error);
    }
    
    res.json({
      success: true,
      message: `Cleaned up ${filesToDelete.length} files`,
      deletedFiles: filesToDelete
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Cleanup failed'
    });
  }
});

export default router;