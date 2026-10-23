import express from 'express';
import multer from 'multer';
import { ocrService, ExtractedPRFData } from '../services/ocrService';
import { PRFModel } from '../models/PRF';
import { CreatePRFRequest, CreatePRFItemRequest } from '../models/types';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { storedFileCandidates } from '../services/storagePathResolver';
import fs from 'fs/promises';
import { getSharedStorageService } from '../services/sharedStorageService';
import type { FileStorageResult, SharedStorageConfig } from '../services/sharedStorageService';
import { PRFFilesModel } from '../models/PRFFiles';
import type { PRFFile } from '../models/PRFFiles';
import { loadSettings } from './settingsRoutes';
import { authenticateToken, requireContentManager } from '../middleware/auth';
import { getPool } from '../config/database';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { validateRescanExtraction } from '../services/rescanValidation';

const rescanHash = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');

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

type ExistingRescanItem = {
  PRFItemID: number;
  ItemName: string;
  Description?: string | null;
  ItemCode?: string | null;
  Quantity: number;
  UnitPrice: number;
  PurchaseCostCode?: string | null;
  COAID?: number | null;
  BudgetYear?: number | null;
  Status?: string | null;
  StatusOverridden?: boolean | null;
};

type RescanProposal = {
  index: number;
  action: 'update' | 'add';
  matchReason: 'item-code' | 'name-quantity' | 'new';
  existingItemId?: number;
  existing?: ExistingRescanItem;
  scanned: NonNullable<ExtractedPRFData['items']>[number];
};

type RescanProposalDecision = {
  index: number;
  action: 'update' | 'keep' | 'add' | 'ignore';
};

type PreservedItemDecision = {
  prfItemId: number;
  action: 'keep' | 'cancel';
};

type RescanPreviewSnapshotPayload = {
  kind: 'ocr-rescan-preview';
  sourceHash: string;
  itemsHash: string;
  prfId: number;
  fileId: number;
  userId: number;
  extractedData: ExtractedPRFData;
};

const OCR_RESCAN_PREVIEW_SECRET =
  process.env.OCR_RESCAN_PREVIEW_SECRET ||
  process.env.JWT_SECRET ||
  'your-secret-key-change-in-production';

const signRescanPreviewToken = (payload: RescanPreviewSnapshotPayload): string =>
  jwt.sign(payload, OCR_RESCAN_PREVIEW_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m'
  });

const verifyRescanPreviewToken = (token: string): RescanPreviewSnapshotPayload => {
  const decoded = jwt.verify(token, OCR_RESCAN_PREVIEW_SECRET);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid rescan preview token');
  }

  const candidate = decoded as Partial<RescanPreviewSnapshotPayload>;
  if (
    candidate.kind !== 'ocr-rescan-preview' ||
    typeof candidate.sourceHash !== 'string' ||
    typeof candidate.itemsHash !== 'string' ||
    !Number.isInteger(candidate.prfId) ||
    !Number.isInteger(candidate.fileId) ||
    !Number.isInteger(candidate.userId) ||
    typeof candidate.extractedData !== 'object' ||
    candidate.extractedData === null ||
    !Array.isArray(candidate.extractedData.items)
  ) {
    throw new Error('Invalid rescan preview token');
  }

  return {
    kind: 'ocr-rescan-preview',
    sourceHash: candidate.sourceHash,
    itemsHash: candidate.itemsHash,
    prfId: Number(candidate.prfId),
    fileId: Number(candidate.fileId),
    userId: Number(candidate.userId),
    extractedData: candidate.extractedData as ExtractedPRFData
  };
};

const isScannedCancelled = (
  item: NonNullable<ExtractedPRFData['items']>[number]
): boolean =>
  (typeof item.status === 'string' && item.status.trim().toLowerCase().includes('cancel')) ||
  item.isStruckThrough === true;

const calculateRescanTotals = (extractedData: ExtractedPRFData) => {
  const items = extractedData.items || [];
  const itemTotal = (item: NonNullable<ExtractedPRFData['items']>[number]) =>
    Number(item.totalPrice ?? (Number(item.quantity || 0) * Number(item.unitPrice || 0)));
  const extractedItemsTotal = items.reduce((sum, item) => sum + itemTotal(item), 0);
  const cancelledItemsTotal = items
    .filter(isScannedCancelled)
    .reduce((sum, item) => sum + itemTotal(item), 0);
  const activeItemsTotal = extractedItemsTotal - cancelledItemsTotal;
  const documentTotal = Number(extractedData.totalAmount || 0);
  return {
    documentTotal,
    extractedItemsTotal,
    activeItemsTotal,
    cancelledItemsTotal,
    documentItemVariance: documentTotal - extractedItemsTotal
  };
};

const normalizeMatchText = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().toLowerCase() : '';

const normalizeOptionalText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizePositiveInt = (value: unknown, fallback: number): number => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value.trim()) : Number.NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.round(numeric));
};

const normalizeNonNegativeNumber = (value: unknown, fallback: number): number => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value.trim()) : Number.NaN;
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return numeric;
};

const mapScannedItemFields = (
  scanned: NonNullable<ExtractedPRFData['items']>[number],
  options?: {
    existing?: ExistingRescanItem;
    fallbackCostCode?: string | null;
    fallbackBudgetYear?: number | null;
  }
) => {
  const existing = options?.existing;
  const itemName =
    normalizeOptionalText(scanned.description) ||
    normalizeOptionalText(scanned.partNumber) ||
    normalizeOptionalText(existing?.ItemName) ||
    'Unknown Item';
  const description =
    normalizeOptionalText(scanned.description) ||
    normalizeOptionalText(existing?.Description) ||
    null;
  const itemCode =
    normalizeOptionalText(scanned.partNumber) ||
    normalizeOptionalText(existing?.ItemCode) ||
    null;
  const purchaseCostCode =
    normalizeOptionalText(scanned.purchaseCostCode) ||
    normalizeOptionalText(options?.fallbackCostCode) ||
    null;
  const budgetYear = (() => {
    const raw = scanned.budgetYear;
    const parsed =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number.parseInt(raw.trim(), 10)
          : Number.NaN;
    if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100) return parsed;
    return options?.fallbackBudgetYear ?? existing?.BudgetYear ?? new Date().getFullYear();
  })();

  return {
    itemName,
    description,
    itemCode,
    quantity: normalizePositiveInt(scanned.quantity, Math.max(1, Number(existing?.Quantity || 1))),
    unitPrice: normalizeNonNegativeNumber(scanned.unitPrice, Math.max(0, Number(existing?.UnitPrice || 0))),
    purchaseCostCode,
    budgetYear
  };
};

const buildRescanProposals = (
  existingItems: ExistingRescanItem[],
  scannedItems: NonNullable<ExtractedPRFData['items']>
): { proposals: RescanProposal[]; preservedItems: ExistingRescanItem[] } => {
  const used = new Set<number>();
  const proposals = scannedItems.map((scanned, index): RescanProposal => {
    const partNumber = normalizeMatchText(scanned.partNumber);
    const description = normalizeMatchText(scanned.description);
    let matchIndex = partNumber
      ? existingItems.findIndex((item, i) => !used.has(i) && normalizeMatchText(item.ItemCode) === partNumber)
      : -1;
    let matchReason: RescanProposal['matchReason'] = 'item-code';

    if (matchIndex < 0 && description) {
      matchIndex = existingItems.findIndex(
        (item, i) =>
          !used.has(i) &&
          normalizeMatchText(item.ItemName) === description &&
          Number(item.Quantity) === Number(scanned.quantity || 1)
      );
      matchReason = 'name-quantity';
    }

    if (matchIndex >= 0) {
      used.add(matchIndex);
      return {
        index,
        action: 'update',
        matchReason,
        existingItemId: existingItems[matchIndex].PRFItemID,
        existing: existingItems[matchIndex],
        scanned
      };
    }

    return { index, action: 'add', matchReason: 'new', scanned };
  });

  return {
    proposals,
    preservedItems: existingItems.filter((_item, index) => !used.has(index))
  };
};

const readStoredPRFFile = async (file: PRFFile): Promise<Buffer> => {
  const candidates = storedFileCandidates([file.SharedPath, file.FilePath], { fileName: file.OriginalFileName });
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const buffer = await fs.readFile(candidate);
      if (Number(file.FileSize) > 0 && buffer.length !== Number(file.FileSize)) throw new Error('Source file size differs from stored metadata');
      if ((file.MimeType === 'application/pdf' || file.FileType?.toLowerCase() === 'pdf') && !buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('Selected source is not a valid PDF');
      return buffer;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`OCR source file is not readable${lastError instanceof Error ? `: ${lastError.message}` : ''}`);
};

const supportedStoredOCRMimeType = (file: PRFFile): string | null => {
  const mimeType = (file.MimeType || '').trim().toLowerCase();
  if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) return mimeType;
  const extension = (file.FileType || path.extname(file.OriginalFileName).slice(1)).toLowerCase();
  const byExtension: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp'
  };
  return byExtension[extension] || null;
};

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
        Title: extractedData.semanticTitle || extractedData.projectDescription || 'OCR Generated PRF',
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
        ProjectArea: extractedData.projectArea || '',
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

          const mapped = mapScannedItemFields(item, {
            fallbackCostCode: prfCostCode || null,
            fallbackBudgetYear: budgetYear ?? new Date().getFullYear()
          });

          return {
            ItemName: mapped.itemName,
            Description: mapped.description || undefined,
            ItemCode: mapped.itemCode,
            Quantity: mapped.quantity,
            UnitPrice: mapped.unitPrice,
            Specifications: '',
            PurchaseCostCode: mapped.purchaseCostCode || undefined,
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

router.post('/rescan/:prfId/file/:fileId/preview', authenticateToken, requireContentManager, async (req, res) => {
  try {
    const prfId = Number.parseInt(req.params.prfId, 10);
    const fileId = Number.parseInt(req.params.fileId, 10);
    if (!Number.isInteger(prfId) || !Number.isInteger(fileId)) {
      return res.status(400).json({ success: false, message: 'Invalid PRF or file ID' });
    }

    const [prf, file, existingItems] = await Promise.all([
      PRFModel.findById(prfId),
      PRFFilesModel.getById(fileId),
      PRFModel.getItems(prfId)
    ]);
    if (!prf) return res.status(404).json({ success: false, message: 'PRF not found' });
    if (!file || file.PRFID !== prfId) {
      return res.status(404).json({ success: false, message: 'Selected document not found for this PRF' });
    }
    const ocrMimeType = supportedStoredOCRMimeType(file);
    if (!ocrMimeType) {
      return res.status(400).json({ success: false, message: 'Only PDF or supported image documents can be scanned with AI' });
    }
    if (!(await ocrService.isEnabled())) {
      return res.status(503).json({ success: false, message: 'OCR service is not configured' });
    }
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const buffer = await readStoredPRFFile(file);
    const extractedData = await ocrService.extractPRFData(buffer, ocrMimeType);
    const validationErrors = validateRescanExtraction(extractedData, String(prf.PRFNo), existingItems);
    if (validationErrors.length) {
      return res.status(422).json({ success: false,
        message: `Unsafe OCR result for ${file.OriginalFileName}: ${validationErrors.join(' ')}`,
        validationErrors, file: { FileID: file.FileID, OriginalFileName: file.OriginalFileName }
      });
    }
    const { proposals, preservedItems } = buildRescanProposals(
      existingItems as ExistingRescanItem[],
      extractedData.items || []
    );
    const totals = calculateRescanTotals(extractedData);
    const cancelledCount = (extractedData.items || []).filter(isScannedCancelled).length;
    const previewToken = signRescanPreviewToken({
      kind: 'ocr-rescan-preview',
      sourceHash: rescanHash(buffer),
      itemsHash: rescanHash(JSON.stringify(existingItems)),
      prfId,
      fileId,
      userId: req.user.UserID,
      extractedData
    });

    return res.json({
      success: true,
      message: 'OCR rescan preview completed',
      data: {
        prf: {
          PRFID: prf.PRFID,
          PRFNo: prf.PRFNo,
          Title: prf.Title,
          Department: prf.Department,
          RequestedAmount: prf.RequestedAmount,
          VendorName: prf.VendorName,
          RequiredFor: prf.RequiredFor
        },
        file: { FileID: file.FileID, OriginalFileName: file.OriginalFileName },
        previewToken,
        extractedData,
        proposals,
        preservedItems,
        totals,
        warnings: [
          !file.IsOriginalDocument
            ? `${file.OriginalFileName} is an alternative synced document, not the original OCR Source. Review every proposed change carefully.`
            : null,
          extractedData.prfNo && String(extractedData.prfNo).trim() !== String(prf.PRFNo).trim()
            ? `Scanned PRF number ${extractedData.prfNo} differs from existing PRF ${prf.PRFNo}`
            : null,
          cancelledCount > 0
            ? `${cancelledCount} item(s) appear struck through and are proposed as Cancelled. Confirm each status change before applying.`
            : null,
          Math.abs(totals.documentItemVariance) > 1
            ? `Document total differs from the sum of extracted item rows by ${totals.documentItemVariance.toLocaleString('en-US')}`
            : null,
          ...(extractedData.items || []).map((item, index) =>
            item.purchaseCostCode ? null : `Scanned item ${index + 1} has no cost code`
          )
        ].filter(Boolean)
      }
    });
  } catch (error) {
    console.error('OCR rescan preview failed:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'OCR rescan preview failed'
    });
  }
});

router.post('/rescan/:prfId/file/:fileId/apply', authenticateToken, requireContentManager, async (req, res) => {
  const transaction = new sql.Transaction(getPool());
  let transactionStarted = false;
  try {
    const prfId = Number.parseInt(req.params.prfId, 10);
    const fileId = Number.parseInt(req.params.fileId, 10);
    const previewToken = typeof req.body?.previewToken === 'string' ? req.body.previewToken : '';
    const proposalDecisions = Array.isArray(req.body?.proposalDecisions)
      ? req.body.proposalDecisions.filter((value: unknown): value is RescanProposalDecision => {
          if (typeof value !== 'object' || value === null) return false;
          const candidate = value as { index?: unknown; action?: unknown };
          return Number.isInteger(candidate.index)
            && typeof candidate.action === 'string'
            && ['update', 'keep', 'add', 'ignore'].includes(candidate.action);
        })
      : [];
    const selectedIndexes = Array.isArray(req.body?.selectedIndexes)
      ? req.body.selectedIndexes.filter((value: unknown): value is number => Number.isInteger(value))
      : [];
    const preservedItemDecisions = Array.isArray(req.body?.preservedItemDecisions)
      ? req.body.preservedItemDecisions.filter((value: unknown): value is PreservedItemDecision => {
          if (typeof value !== 'object' || value === null) return false;
          const candidate = value as { prfItemId?: unknown; action?: unknown };
          return Number.isInteger(candidate.prfItemId)
            && typeof candidate.action === 'string'
            && ['keep', 'cancel'].includes(candidate.action);
        })
      : [];
    const updateHeader = req.body?.updateHeader === true;

    if (!Number.isInteger(prfId) || !Number.isInteger(fileId) || previewToken.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid rescan approval payload' });
    }
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });

    let extractedData: ExtractedPRFData;
    let approvedSnapshot: RescanPreviewSnapshotPayload;
    try {
      const snapshot = verifyRescanPreviewToken(previewToken);
      if (snapshot.prfId !== prfId || snapshot.fileId !== fileId) {
        return res.status(400).json({ success: false, message: 'Rescan preview token does not match the selected PRF document' });
      }
      if (snapshot.userId !== req.user.UserID) {
        return res.status(403).json({ success: false, message: 'Rescan preview token belongs to a different user' });
      }
      extractedData = snapshot.extractedData;
      approvedSnapshot = snapshot;
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'TokenExpiredError'
          ? 'Rescan preview expired. Refresh preview and apply again.'
          : error instanceof Error
            ? error.message
            : 'Invalid rescan preview token';
      return res.status(400).json({
        success: false,
        message
      });
    }

    const extractedItems = extractedData.items || [];
    const [prf, file, existingItems] = await Promise.all([
      PRFModel.findById(prfId),
      PRFFilesModel.getById(fileId),
      PRFModel.getItems(prfId)
    ]);
    if (!prf) return res.status(404).json({ success: false, message: 'PRF not found' });
    if (!file || file.PRFID !== prfId) {
      return res.status(404).json({ success: false, message: 'Selected document not found for this PRF' });
    }
    if (!supportedStoredOCRMimeType(file)) {
      return res.status(400).json({ success: false, message: 'Only PDF or supported image documents can be applied as an AI scan source' });
    }

    const { proposals, preservedItems } = buildRescanProposals(
      existingItems as ExistingRescanItem[],
      extractedItems
    );
    const validationErrors = validateRescanExtraction(extractedData, String(prf.PRFNo), existingItems);
    if (validationErrors.length) {
      return res.status(422).json({ success: false, message: validationErrors.join(' '), validationErrors });
    }
    if (approvedSnapshot.sourceHash !== rescanHash(await readStoredPRFFile(file)) ||
        approvedSnapshot.itemsHash !== rescanHash(JSON.stringify(existingItems))) {
      return res.status(409).json({ success: false, message: 'Source document or PRF items changed. Refresh preview before applying.' });
    }
    const fallbackHeaderCostCode = normalizeOptionalText(prf.PurchaseCostCode);
    const fallbackBudgetYear = prf.BudgetYear ?? new Date().getFullYear();
    const decisionByIndex = new Map<number, RescanProposalDecision['action']>();
    proposalDecisions.forEach((decision: RescanProposalDecision) => {
      decisionByIndex.set(decision.index, decision.action);
    });
    if (decisionByIndex.size === 0 && selectedIndexes.length > 0) {
      proposals.forEach((proposal) => {
        if (!selectedIndexes.includes(proposal.index)) return;
        if (proposal.action === 'add') {
          decisionByIndex.set(proposal.index, 'add');
          return;
        }
        decisionByIndex.set(proposal.index, 'update');
      });
    }
    const preservedDecisionById = new Map<number, PreservedItemDecision['action']>();
    preservedItemDecisions.forEach((decision: PreservedItemDecision) => {
      preservedDecisionById.set(decision.prfItemId, decision.action);
    });
    await transaction.begin();
    transactionStarted = true;

    if (updateHeader) {
      const totals = calculateRescanTotals(extractedData);
      const hasCancelledItems = extractedItems.some(isScannedCancelled);
      const requestedAmount = hasCancelledItems
        ? totals.activeItemsTotal
        : extractedData.totalAmount ?? prf.RequestedAmount ?? 0;
      const headerRequest = new sql.Request(transaction);
      await headerRequest
        .input('PRFID', sql.Int, prfId)
        .input('Title', sql.NVarChar(200), extractedData.semanticTitle || extractedData.projectDescription || prf.Title)
        .input('Description', sql.NVarChar(sql.MAX), extractedData.projectDescription || prf.Description || '')
        .input('SumDescriptionRequested', sql.NVarChar(1000), extractedData.projectDescription || prf.SumDescriptionRequested || '')
        .input('ProjectArea', sql.NVarChar(100), extractedData.projectArea || prf.ProjectArea || '')
        .input('Department', sql.NVarChar(100), extractedData.department || prf.Department)
        .input('RequestedAmount', sql.Decimal(18, 2), requestedAmount)
        .input('VendorName', sql.NVarChar(200), extractedData.proposedSupplier || prf.VendorName || '')
        .input('RequiredFor', sql.NVarChar(500), extractedData.requestFor || extractedData.projectId || prf.RequiredFor || '')
        .query(`
          UPDATE dbo.PRF
          SET Title = @Title,
              Description = @Description,
              SumDescriptionRequested = @SumDescriptionRequested,
              ProjectArea = @ProjectArea,
              Department = @Department,
              RequestedAmount = @RequestedAmount,
              VendorName = @VendorName,
              RequiredFor = @RequiredFor,
              UpdatedAt = GETDATE()
          WHERE PRFID = @PRFID
        `);
    }

    let updatedItemCount = 0;
    let addedItemCount = 0;
    let cancelledItemCount = 0;
    for (const proposal of proposals) {
      const chosenAction = decisionByIndex.get(proposal.index);
      if (!chosenAction || chosenAction === 'keep' || chosenAction === 'ignore') {
        continue;
      }
      const scanned = proposal.scanned;
      const mapped = mapScannedItemFields(scanned, {
        existing: proposal.existing,
        fallbackCostCode: fallbackHeaderCostCode,
        fallbackBudgetYear
      });
      const costCode = mapped.purchaseCostCode;
      const coaRequest = new sql.Request(transaction);
      const coaResult = costCode
        ? await coaRequest.input('COACode', sql.NVarChar(50), costCode).query<{ COAID: number }>(
            `SELECT TOP 1 COAID FROM dbo.ChartOfAccounts
             WHERE UPPER(LTRIM(RTRIM(COACode))) = UPPER(LTRIM(RTRIM(@COACode)))`
          )
        : null;
      const coaId = coaResult?.recordset[0]?.COAID ?? null;

      if (chosenAction === 'update' && proposal.existingItemId) {
        const applyCancelledStatus = isScannedCancelled(scanned);
        const request = new sql.Request(transaction);
        await request
          .input('PRFItemID', sql.Int, proposal.existingItemId)
          .input('ItemName', sql.NVarChar(200), mapped.itemName)
          .input('Description', sql.NVarChar(1000), mapped.description)
          .input('ItemCode', sql.NVarChar(64), mapped.itemCode)
          .input('Quantity', sql.Int, mapped.quantity)
          .input('UnitPrice', sql.Decimal(15, 2), mapped.unitPrice)
          .input('PurchaseCostCode', sql.NVarChar(50), costCode)
          .input('COAID', sql.Int, coaId)
          .input('BudgetYear', sql.Int, mapped.budgetYear)
          .input('ApplyCancelledStatus', sql.Bit, applyCancelledStatus)
          .input('UpdatedBy', sql.Int, req.user.UserID)
          .query(`
            UPDATE dbo.PRFItems
            SET ItemName = @ItemName, Description = @Description, ItemCode = @ItemCode,
                Quantity = @Quantity, UnitPrice = @UnitPrice,
                PurchaseCostCode = @PurchaseCostCode, COAID = @COAID,
                BudgetYear = @BudgetYear,
                Status = CASE WHEN @ApplyCancelledStatus = 1 THEN 'Cancelled' ELSE Status END,
                StatusOverridden = CASE WHEN @ApplyCancelledStatus = 1 THEN 1 ELSE StatusOverridden END,
                UpdatedBy = @UpdatedBy, UpdatedAt = GETDATE()
            WHERE PRFItemID = @PRFItemID AND PRFID = ${prfId}
          `);
        updatedItemCount += 1;
        if (applyCancelledStatus) cancelledItemCount += 1;
      } else if (chosenAction === 'add') {
        const applyCancelledStatus = isScannedCancelled(scanned);
        const request = new sql.Request(transaction);
        await request
          .input('PRFID', sql.Int, prfId)
          .input('ItemName', sql.NVarChar(200), mapped.itemName)
          .input('Description', sql.NVarChar(1000), mapped.description)
          .input('ItemCode', sql.NVarChar(64), mapped.itemCode)
          .input('Quantity', sql.Int, mapped.quantity)
          .input('UnitPrice', sql.Decimal(15, 2), mapped.unitPrice)
          .input('PurchaseCostCode', sql.NVarChar(50), costCode)
          .input('COAID', sql.Int, coaId)
          .input('BudgetYear', sql.Int, mapped.budgetYear)
          .input('Status', sql.NVarChar(50), applyCancelledStatus ? 'Cancelled' : 'Pending')
          .input('StatusOverridden', sql.Bit, applyCancelledStatus)
          .input('UpdatedBy', sql.Int, req.user.UserID)
          .query(`
            INSERT INTO dbo.PRFItems
              (PRFID, ItemName, Description, ItemCode, Quantity, UnitPrice,
               PurchaseCostCode, COAID, BudgetYear, Status, StatusOverridden, UpdatedBy)
            VALUES
              (@PRFID, @ItemName, @Description, @ItemCode, @Quantity, @UnitPrice,
               @PurchaseCostCode, @COAID, @BudgetYear, @Status, @StatusOverridden, @UpdatedBy)
          `);
        addedItemCount += 1;
        if (applyCancelledStatus) cancelledItemCount += 1;
      }
    }

    for (const preservedItem of preservedItems) {
      if (preservedDecisionById.get(preservedItem.PRFItemID) !== 'cancel') continue;
      const request = new sql.Request(transaction);
      await request
        .input('PRFItemID', sql.Int, preservedItem.PRFItemID)
        .input('UpdatedBy', sql.Int, req.user.UserID)
        .query(`
          UPDATE dbo.PRFItems
          SET Status = 'Cancelled',
              StatusOverridden = 1,
              UpdatedBy = @UpdatedBy,
              UpdatedAt = GETDATE()
          WHERE PRFItemID = @PRFItemID AND PRFID = ${prfId}
        `);
      cancelledItemCount += 1;
    }

    const afterRequest = new sql.Request(transaction);
    const afterResult = await afterRequest
      .input('PRFID', sql.Int, prfId)
      .query('SELECT * FROM dbo.PRFItems WHERE PRFID = @PRFID ORDER BY PRFItemID');
    const auditRequest = new sql.Request(transaction);
    await auditRequest
      .input('PRFID', sql.Int, prfId)
      .input('FileID', sql.Int, fileId)
      .input('AppliedBy', sql.Int, req.user.UserID)
      .input('OCRConfidence', sql.Decimal(8, 6), extractedData.confidence ?? null)
      .input('UpdatedItemCount', sql.Int, updatedItemCount)
      .input('AddedItemCount', sql.Int, addedItemCount)
      .input('PreservedItemCount', sql.Int, preservedItems.length)
      .input('BeforeSnapshot', sql.NVarChar(sql.MAX), JSON.stringify({ prf, items: existingItems }))
      .input('AfterSnapshot', sql.NVarChar(sql.MAX), JSON.stringify({ items: afterResult.recordset }))
      .input('ExtractionSnapshot', sql.NVarChar(sql.MAX), JSON.stringify(extractedData))
      .query(`
        INSERT INTO dbo.PRFOCRRescanAudit
          (PRFID, FileID, AppliedBy, OCRConfidence, UpdatedItemCount, AddedItemCount,
           PreservedItemCount, BeforeSnapshot, AfterSnapshot, ExtractionSnapshot)
        VALUES
          (@PRFID, @FileID, @AppliedBy, @OCRConfidence, @UpdatedItemCount, @AddedItemCount,
           @PreservedItemCount, @BeforeSnapshot, @AfterSnapshot, @ExtractionSnapshot)
      `);

    await transaction.commit();
    transactionStarted = false;
    return res.json({
      success: true,
      message: 'OCR rescan changes applied successfully',
      data: {
        updatedItemCount,
        addedItemCount,
        cancelledItemCount,
        preservedItemCount: preservedItems.length,
        headerUpdated: updateHeader
      }
    });
  } catch (error) {
    if (transactionStarted) {
      try { await transaction.rollback(); } catch { /* transaction may not have started */ }
    }
    console.error('OCR rescan apply failed:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'OCR rescan apply failed'
    });
  }
});

export default router;
