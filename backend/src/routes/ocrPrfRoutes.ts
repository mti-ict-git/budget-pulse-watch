import express from 'express';
import multer from 'multer';
import { ocrService } from '../services/ocrService';
import { PRFModel } from '../models/PRF';
import { CreatePRFRequest, CreatePRFItemRequest } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { getSharedStorageService } from '../services/sharedStorageService';
import type { FileStorageResult, SharedStorageConfig } from '../services/sharedStorageService';
import { PRFFilesModel } from '../models/PRFFiles';
import type { PRFFile } from '../models/PRFFiles';
import { loadSettings } from './settingsRoutes';
import { authenticateToken, requireContentManager } from '../middleware/auth';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
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
router.post('/create-from-document', authenticateToken, requireContentManager, upload.single('document'), async (req, res) => {
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

      // Get authenticated user information
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userDisplayName = req.user.FirstName && req.user.LastName 
        ? `${req.user.FirstName} ${req.user.LastName}` 
        : req.user.Username;

      const itemCostCodes = (extractedData.items || [])
        .map((item) => item.purchaseCostCode)
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim());
      const uniqueItemCostCodes = Array.from(new Set<string>(itemCostCodes));
      const prfCostCode =
        (typeof extractedData.generalLedgerCode === 'string' && extractedData.generalLedgerCode.trim().length > 0
          ? extractedData.generalLedgerCode.trim()
          : uniqueItemCostCodes.length === 1
            ? uniqueItemCostCodes[0]
            : '');

      // Prepare PRF data for creation
      const prfData: CreatePRFRequest = {
        PRFNo: extractedData.prfNo || `OCR-${uploadId.substring(0, 8)}`,
        Title: extractedData.projectDescription || 'OCR Generated PRF',
        Description: extractedData.projectDescription || '',
        Department: extractedData.department || req.user.Department || 'Unknown',
        COAID: 1, // Default COA ID
        RequestedAmount: extractedData.totalAmount || 0,
        Priority: 'Medium',
        RequiredDate: extractedData.dateRequired ? new Date(extractedData.dateRequired) : undefined,
        VendorName: extractedData.proposedSupplier || '',
        Notes: `OCR extracted from ${originalname}`,
        DateSubmit: extractedData.dateRaised ? new Date(extractedData.dateRaised) : new Date(),
        SubmitBy: userDisplayName, // Always use authenticated user, not OCR extracted data
        SumDescriptionRequested: extractedData.projectDescription || '',
        PurchaseCostCode: prfCostCode,
        RequiredFor: extractedData.requestFor || extractedData.projectId || '',
        BudgetYear: new Date().getFullYear()
      };

      // Create the PRF
      console.log(`📝 Creating PRF with data:`, prfData);
      const createdPRF = await PRFModel.create(prfData, req.user.UserID);
      
      // Create PRF items if extracted
      const createdItems = [];
      if (extractedData.items && extractedData.items.length > 0) {
        console.log(`📦 Creating ${extractedData.items.length} PRF items`);
        
        const prfItems: CreatePRFItemRequest[] = extractedData.items.map((item) => {
          const coaidRaw = item.coaid;
          const coaidParsed =
            typeof coaidRaw === 'number'
              ? coaidRaw
              : typeof coaidRaw === 'string'
                ? Number.parseInt(coaidRaw.trim(), 10)
                : Number.NaN;
          const coaid = Number.isInteger(coaidParsed) && coaidParsed > 0 ? coaidParsed : undefined;

          const budgetYearRaw = item.budgetYear;
          const budgetYearParsed =
            typeof budgetYearRaw === 'number'
              ? budgetYearRaw
              : typeof budgetYearRaw === 'string'
                ? Number.parseInt(budgetYearRaw.trim(), 10)
                : Number.NaN;
          const budgetYear =
            Number.isInteger(budgetYearParsed) && budgetYearParsed >= 2000 && budgetYearParsed <= 2100
              ? budgetYearParsed
              : undefined;

          return {
            ItemName: item.description || 'Unknown Item',
            Description: item.partNumber ? `Part: ${item.partNumber}` : '',
            Quantity: item.quantity || 1,
            UnitPrice: item.unitPrice || 0,
            Specifications: '',
            PurchaseCostCode: item.purchaseCostCode || prfCostCode || undefined,
            COAID: coaid,
            BudgetYear: budgetYear
          };
        });
        
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
      let sharedStorageResult: FileStorageResult | null = null;
      let fileRecord: PRFFile | null = null;
      try {
        const settings = await loadSettings();
        const envSharedFolderPath = typeof process.env.SHARED_FOLDER_PATH === 'string' ? process.env.SHARED_FOLDER_PATH.trim() : '';
        const settingsSharedFolderPath = settings.general?.sharedFolderPath?.trim() || '';
        const basePath = envSharedFolderPath || settingsSharedFolderPath;

        const sharedStorageConfig: SharedStorageConfig = {
          basePath,
          enabled: basePath.length > 0
        };
        
        const sharedStorageService = getSharedStorageService(sharedStorageConfig);
        sharedStorageResult = await sharedStorageService.copyFileToSharedStorage(
          savedFilePath,
          createdPRF.PRFNo,
          originalname
        );
        
        if (!sharedStorageResult.success) {
          console.warn(`⚠️ Shared storage copy failed: ${sharedStorageResult.error}`);
        }

        if (sharedStorageResult.success) {
          console.log(`📁 File copied to shared storage: ${sharedStorageResult.sharedPath}`);
        }

        const fileStats = await fs.stat(savedFilePath);
        fileRecord = await PRFFilesModel.create({
          PRFID: createdPRF.PRFID,
          OriginalFileName: originalname,
          FilePath: savedFilePath,
          SharedPath: sharedStorageResult.success ? sharedStorageResult.sharedPath : undefined,
          FileSize: fileStats.size,
          FileType: fileExtension.toLowerCase().replace('.', ''),
          MimeType: mimetype || 'application/octet-stream',
          UploadedBy: req.user.UserID,
          IsOriginalDocument: true,
          Description: 'OCR source document'
        });

        console.log(`💾 File metadata saved to database with ID: ${fileRecord.FileID}`);
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
router.post('/preview-extraction', authenticateToken, requireContentManager, upload.single('document'), async (req, res) => {
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
    const debugEnabledRaw = req.query.debug;
    const debugEnabled =
      debugEnabledRaw === '1' ||
      debugEnabledRaw === 'true' ||
      debugEnabledRaw === 'yes';
    
    try {
      // Extract PRF data using OCR
      console.log(`🔍 Starting OCR preview extraction for file: ${originalname}`);
      const extractionResult = debugEnabled
        ? await ocrService.extractPRFDataWithDebug(buffer, mimetype)
        : { extractedData: await ocrService.extractPRFData(buffer, mimetype), debug: undefined };
      const extractedData = extractionResult.extractedData;
      
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
          },
          debug: debugEnabled ? extractionResult.debug : undefined
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
