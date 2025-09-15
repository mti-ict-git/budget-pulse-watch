import express from 'express';
import multer from 'multer';
import { ocrService } from '../services/ocrService';
import { PRFModel } from '../models/PRF';
import { CreatePRFRequest, CreatePRFItemRequest } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { getSharedStorageService, SharedStorageConfig } from '../services/sharedStorageService';
import { PRFFilesModel } from '../models/PRFFiles';
import { loadSettings } from './settingsRoutes';

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

// Create PRF from uploaded document using OCR
router.post('/create-from-document', upload.single('document'), async (req, res) => {
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
    const uploadId = uuidv4();
    
    try {
      // Extract PRF data using OCR
      console.log(`🔍 Starting OCR extraction for file: ${originalname}`);
      const extractedData = await ocrService.extractPRFData(buffer, mimetype);
      
      console.log(`✅ OCR extraction completed with confidence: ${extractedData.confidence}`);
      
      // Validate extracted data has minimum required fields
      if (!extractedData.prfNo && !extractedData.requestedBy && !extractedData.department) {
        return res.status(400).json({
          success: false,
          message: 'OCR extraction failed to identify key PRF information. Please ensure the document is clear and contains PRF data.',
          extractedData,
          uploadId
        });
      }

      // Check if PRF already exists
      if (extractedData.prfNo) {
        try {
          const existingPRF = await PRFModel.findByPRFNo(extractedData.prfNo);
          if (existingPRF) {
            return res.status(409).json({
              success: false,
              message: `PRF ${extractedData.prfNo} already exists in the system`,
              existingPRF,
              extractedData,
              uploadId
            });
          }
        } catch (error) {
          // If findByPRFNo doesn't exist, continue with creation
          console.log('PRF lookup method not available, proceeding with creation');
        }
      }

      // Prepare PRF data for creation
      const prfData: CreatePRFRequest = {
        PRFNo: extractedData.prfNo || `OCR-${uploadId.substring(0, 8)}`,
        Title: extractedData.projectDescription || 'OCR Generated PRF',
        Description: extractedData.projectDescription || '',
        Department: extractedData.department || 'Unknown',
        COAID: 1, // Default COA ID
        RequestedAmount: extractedData.totalAmount || 0,
        Priority: 'Medium',
        RequiredDate: extractedData.dateRequired ? new Date(extractedData.dateRequired) : undefined,
        VendorName: extractedData.proposedSupplier || '',
        Notes: `OCR extracted from ${originalname}`,
        DateSubmit: extractedData.dateRaised ? new Date(extractedData.dateRaised) : new Date(),
        SubmitBy: extractedData.requestedBy || 'Unknown',
        SumDescriptionRequested: extractedData.projectDescription || '',
        PurchaseCostCode: extractedData.generalLedgerCode || '',
        RequiredFor: extractedData.requestFor || extractedData.projectId || '',
        BudgetYear: new Date().getFullYear()
      };

      // Create the PRF
      console.log(`📝 Creating PRF with data:`, prfData);
      const createdPRF = await PRFModel.create(prfData, 1); // Default requestor ID
      
      // Create PRF items if extracted
      const createdItems = [];
      if (extractedData.items && extractedData.items.length > 0) {
        console.log(`📦 Creating ${extractedData.items.length} PRF items`);
        
        const prfItems: CreatePRFItemRequest[] = extractedData.items.map(item => ({
          ItemName: item.description || 'Unknown Item',
          Description: item.partNumber ? `Part: ${item.partNumber}` : '',
          Quantity: item.quantity || 1,
          UnitPrice: item.unitPrice || 0,
          Specifications: ''
        }));
        
        try {
          await PRFModel.addItems(createdPRF.PRFID, prfItems);
          createdItems.push(...prfItems);
        } catch (itemError) {
          console.error('Failed to create PRF items:', itemError);
        }
      }

      // Save the uploaded file for reference
      const tempDir = path.join(process.cwd(), 'temp', 'ocr-uploads');
      await fs.mkdir(tempDir, { recursive: true });
      
      const fileExtension = path.extname(originalname);
      const savedFilePath = path.join(tempDir, `${createdPRF.PRFID}-${uploadId}${fileExtension}`);
      await fs.writeFile(savedFilePath, buffer);
      
      // Copy file to shared storage and save metadata
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
        sharedStorageResult = await sharedStorageService.copyFileToSharedStorage(
          savedFilePath,
          createdPRF.PRFNo,
          originalname
        );
        
        if (sharedStorageResult.success) {
          console.log(`📁 File copied to shared storage: ${sharedStorageResult.sharedPath}`);
          
          // Save file metadata to database
          const fileStats = await fs.stat(savedFilePath);
          fileRecord = await PRFFilesModel.create({
            PRFID: createdPRF.PRFID,
            OriginalFileName: originalname,
            FilePath: savedFilePath,
            SharedPath: sharedStorageResult.sharedPath,
            FileSize: fileStats.size,
            FileType: fileExtension.toLowerCase().replace('.', ''),
            MimeType: mimetype || 'application/octet-stream',
            UploadedBy: 1, // TODO: Get from authenticated user
            IsOriginalDocument: true,
            Description: 'OCR source document'
          });
          
          console.log(`💾 File metadata saved to database with ID: ${fileRecord.FileID}`);
        } else {
          console.warn(`⚠️ Shared storage copy failed: ${sharedStorageResult.error}`);
        }
      } catch (sharedStorageError) {
        console.error('Shared storage operation failed:', sharedStorageError);
      }
      
      console.log(`✅ PRF created successfully with ID: ${createdPRF.PRFID}`);
      
      return res.status(201).json({
        success: true,
        message: 'PRF created successfully from OCR extraction',
        data: {
          prf: createdPRF,
          items: createdItems,
          extractedData,
          ocrConfidence: extractedData.confidence,
          uploadId,
          originalFilename: originalname,
          savedFilePath,
          sharedStorage: sharedStorageResult,
          fileRecord: fileRecord
        }
      });
      
    } catch (ocrError) {
      console.error('OCR processing failed:', ocrError);
      return res.status(500).json({
        success: false,
        message: `OCR processing failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`,
        uploadId,
        originalFilename: originalname
      });
    }
    
  } catch (error) {
    console.error('PRF creation from OCR failed:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'PRF creation failed'
    });
  }
});

// Preview OCR extraction without creating PRF
router.post('/preview-extraction', upload.single('document'), async (req, res) => {
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
    const uploadId = uuidv4();
    
    try {
      // Extract PRF data using OCR
      console.log(`🔍 Starting OCR preview extraction for file: ${originalname}`);
      const extractedData = await ocrService.extractPRFData(buffer, mimetype);
      
      console.log(`✅ OCR preview extraction completed with confidence: ${extractedData.confidence}`);
      
      return res.json({
        success: true,
        message: 'OCR extraction preview completed',
        data: {
          extractedData,
          uploadId,
          originalFilename: originalname,
          suggestions: {
            prfNoGenerated: !extractedData.prfNo,
            missingFields: [
              !extractedData.requestedBy && 'Requested By',
              !extractedData.department && 'Department',
              !extractedData.totalAmount && 'Total Amount',
              !extractedData.items?.length && 'Items'
            ].filter(Boolean),
            confidence: extractedData.confidence || 0
          }
        }
      });
      
    } catch (ocrError) {
      console.error('OCR preview extraction failed:', ocrError);
      return res.status(500).json({
        success: false,
        message: `OCR extraction failed: ${ocrError instanceof Error ? ocrError.message : 'Unknown error'}`,
        uploadId,
        originalFilename: originalname
      });
    }
    
  } catch (error) {
    console.error('OCR preview failed:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'OCR preview failed'
    });
  }
});

export default router;