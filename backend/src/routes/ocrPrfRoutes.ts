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
  matchReason: 'item-code' | 'name-quantity' | 'position' | 'new';
  existingItemId?: number;
  existing?: ExistingRescanItem;
  scanned: NonNullable<ExtractedPRFData['items']>[number];
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

    if (matchIndex < 0 && index < existingItems.length && !used.has(index)) {
      matchIndex = index;
      matchReason = 'position';
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
      return await fs.readFile(candidate);
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

    const buffer = await readStoredPRFFile(file);
    const extractedData = await ocrService.extractPRFData(buffer, ocrMimeType);
    const { proposals, preservedItems } = buildRescanProposals(
      existingItems as ExistingRescanItem[],
      extractedData.items || []
    );
    const totals = calculateRescanTotals(extractedData);
    const cancelledCount = (extractedData.items || []).filter(isScannedCancelled).length;

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
    const extractedData = req.body?.extractedData as ExtractedPRFData | undefined;
    const selectedIndexes = Array.isArray(req.body?.selectedIndexes)
      ? req.body.selectedIndexes.filter((value: unknown): value is number => Number.isInteger(value))
      : [];
    const updateHeader = req.body?.updateHeader === true;

    if (!Number.isInteger(prfId) || !Number.isInteger(fileId) || !extractedData || !Array.isArray(extractedData.items)) {
      return res.status(400).json({ success: false, message: 'Invalid rescan approval payload' });
    }
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });

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
      extractedData.items
    );
    const selected = proposals.filter((proposal) => selectedIndexes.includes(proposal.index));
    await transaction.begin();
    transactionStarted = true;

    if (updateHeader) {
      const totals = calculateRescanTotals(extractedData);
      const hasCancelledItems = extractedData.items.some(isScannedCancelled);
      const requestedAmount = hasCancelledItems
        ? totals.activeItemsTotal
        : extractedData.totalAmount ?? prf.RequestedAmount ?? 0;
      const headerRequest = new sql.Request(transaction);
      await headerRequest
        .input('PRFID', sql.Int, prfId)
        .input('Title', sql.NVarChar(200), extractedData.projectDescription || prf.Title)
        .input('Description', sql.NVarChar(sql.MAX), extractedData.projectDescription || prf.Description || '')
        .input('Department', sql.NVarChar(100), extractedData.department || prf.Department)
        .input('RequestedAmount', sql.Decimal(18, 2), requestedAmount)
        .input('VendorName', sql.NVarChar(200), extractedData.proposedSupplier || prf.VendorName || '')
        .input('RequiredFor', sql.NVarChar(500), extractedData.requestFor || extractedData.projectId || prf.RequiredFor || '')
        .query(`
          UPDATE dbo.PRF
          SET Title = @Title,
              Description = @Description,
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
    for (const proposal of selected) {
      const scanned = proposal.scanned;
      const costCode = typeof scanned.purchaseCostCode === 'string' && scanned.purchaseCostCode.trim()
        ? scanned.purchaseCostCode.trim()
        : null;
      const coaRequest = new sql.Request(transaction);
      const coaResult = costCode
        ? await coaRequest.input('COACode', sql.NVarChar(50), costCode).query<{ COAID: number }>(
            `SELECT TOP 1 COAID FROM dbo.ChartOfAccounts
             WHERE UPPER(LTRIM(RTRIM(COACode))) = UPPER(LTRIM(RTRIM(@COACode)))`
          )
        : null;
      const coaId = coaResult?.recordset[0]?.COAID ?? null;

      if (proposal.action === 'update' && proposal.existingItemId) {
        const applyCancelledStatus = isScannedCancelled(scanned);
        const request = new sql.Request(transaction);
        await request
          .input('PRFItemID', sql.Int, proposal.existingItemId)
          .input('ItemName', sql.NVarChar(200), scanned.description || proposal.existing?.ItemName || 'Unknown Item')
          .input('Description', sql.NVarChar(1000), scanned.partNumber ? `Part: ${scanned.partNumber}` : proposal.existing?.Description || '')
          .input('ItemCode', sql.NVarChar(64), scanned.partNumber || proposal.existing?.ItemCode || null)
          .input('Quantity', sql.Int, Number(scanned.quantity || proposal.existing?.Quantity || 1))
          .input('UnitPrice', sql.Decimal(15, 2), Number(scanned.unitPrice ?? proposal.existing?.UnitPrice ?? 0))
          .input('PurchaseCostCode', sql.NVarChar(50), costCode)
          .input('COAID', sql.Int, coaId)
          .input('BudgetYear', sql.Int, Number(scanned.budgetYear || prf.BudgetYear || new Date().getFullYear()))
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
      } else if (proposal.action === 'add') {
        const applyCancelledStatus = isScannedCancelled(scanned);
        const request = new sql.Request(transaction);
        await request
          .input('PRFID', sql.Int, prfId)
          .input('ItemName', sql.NVarChar(200), scanned.description || 'Unknown Item')
          .input('Description', sql.NVarChar(1000), scanned.partNumber ? `Part: ${scanned.partNumber}` : '')
          .input('ItemCode', sql.NVarChar(64), scanned.partNumber || null)
          .input('Quantity', sql.Int, Number(scanned.quantity || 1))
          .input('UnitPrice', sql.Decimal(15, 2), Number(scanned.unitPrice || 0))
          .input('PurchaseCostCode', sql.NVarChar(50), costCode)
          .input('COAID', sql.Int, coaId)
          .input('BudgetYear', sql.Int, Number(scanned.budgetYear || prf.BudgetYear || new Date().getFullYear()))
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
      }
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
        cancelledItemCount: selected.filter((proposal) => isScannedCancelled(proposal.scanned)).length,
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
