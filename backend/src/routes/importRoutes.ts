import express from 'express';
import multer from 'multer';
import { ExcelParserService } from '../services/excelParser';
import { PRFModel } from '../models/PRF';
import { BulkPRFImportRequest, PRFImportResult, ExcelPRFData, User, ChartOfAccounts, PRF } from '../models/types';
import { executeQuery } from '../config/database';
import { authenticateToken, requireContentManager } from '../middleware/auth';

// Interface for count query results
interface CountResult {
  Total: number;
}

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (ExcelParserService.isSupportedFile(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload .xlsx, .xls, or .csv files.'));
    }
  },
});

/**
 * POST /api/import/prf/validate
 * Validate Excel file without importing
 */
router.post('/prf/validate', authenticateToken, requireContentManager, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Parse Excel file
    const { prfData, budgetData } = ExcelParserService.parseExcelFile(req.file.buffer);

    // Validate PRF data
    const prfValidation = ExcelParserService.validatePRFData(prfData);
    const budgetValidation = budgetData.length > 0 
      ? ExcelParserService.validateBudgetData(budgetData)
      : null;

    return res.json({
      success: true,
      message: 'File validation completed',
      data: {
        filename: req.file.originalname,
        fileSize: req.file.size,
        prfValidation,
        budgetValidation,
        summary: {
          totalPRFRecords: prfData.length,
          validPRFRecords: prfValidation.importedRecords,
          totalBudgetRecords: budgetData.length,
          validBudgetRecords: budgetValidation?.importedRecords || 0,
          totalErrors: prfValidation.errors.length + (budgetValidation?.errors.length || 0),
          totalWarnings: prfValidation.warnings.length + (budgetValidation?.warnings.length || 0)
        }
      }
    });
  } catch (error) {
    console.error('Excel validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate Excel file',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/import/prf/bulk
 * Import PRF data from Excel file
 */
router.post('/prf/bulk', authenticateToken, requireContentManager, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const options = {
      validateOnly: req.body.validateOnly === 'true',
      skipDuplicates: req.body.skipDuplicates === 'true',
      updateExisting: req.body.updateExisting === 'true'
    };

    // Parse Excel file
    const { prfData, budgetData } = ExcelParserService.parseExcelFile(req.file.buffer);

    // Validate data first
    const validation = ExcelParserService.validatePRFData(prfData);
    
    // If validation only, return validation results
    if (options.validateOnly) {
      return res.json({
        success: true,
        message: 'Validation completed',
        validation
      });
    }

    // Only import VALID records - reject records with validation errors
    const validRecords = prfData.filter((record, index) => {
      const rowNumber = index + 2;
      const recordErrors = validation.errors.filter(e => e.row === rowNumber);
      return recordErrors.length === 0;
    });
    
    console.log('🔄 Starting import process with options:', options);
    console.log('📊 Total records in file:', prfData.length);
    console.log('✅ Valid records to import:', validRecords.length);
    console.log('❌ Invalid records rejected:', prfData.length - validRecords.length);
    
    if (validation.errors.length > 0) {
      console.log('⚠️ Validation errors found - invalid records will be rejected:');
      validation.errors.slice(0, 10).forEach(error => {
        console.log(`   Row ${error.row}: ${error.field} - ${error.message}`);
      });
    }
    
    const importResult = await importPRFData(validRecords, options, validation);
    
    console.log('✅ Import result:', importResult);

    return res.json({
      success: importResult.success,
      message: `Import completed. ${importResult.importedRecords} records imported successfully.`,
      data: importResult
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import Excel file',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/import/prf/template
 * Download Excel template for PRF import
 */
router.get('/prf/template', (req, res) => {
  try {
    // Create a sample Excel template
    const templateData = [
      {
        'No': 1,
        'Budget': 2024,
        'Date Submit': new Date(),
        'Submit By': 'John Doe',
        'PRF No': 'PRF-2024-0001',
        'Sum Description Requested': 'IT Equipment Purchase',
        'Description': 'Laptop for development team',
        'Purchase Cost Code': 'MTIRMRAD496001',
        'Amount': 15000000,
        'Required for': 'Development Team'
      }
    ];

    res.json({
      success: true,
      message: 'Template data generated',
      data: {
        headers: Object.keys(templateData[0]),
        sampleData: templateData,
        instructions: {
          'No': 'Sequential row number',
          'Budget': 'Budget year (e.g., 2024, 2025)',
          'Date Submit': 'Date when PRF was submitted (YYYY-MM-DD)',
          'Submit By': 'Name of person who submitted the PRF',
          'PRF No': 'Unique PRF number',
          'Sum Description Requested': 'Brief summary of what is being requested',
          'Description': 'Detailed description of the request',
          'Purchase Cost Code': 'Budget cost code for tracking',
          'Amount': 'Requested amount in IDR',
          'Required for': 'Purpose or department requiring the purchase'
        }
      }
    });
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate template',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/import/prf/history
 * Get import history
 */
router.get('/prf/history', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get import history from audit log
    const query = `
      SELECT 
        AuditID,
        Action,
        ChangedBy,
        ChangedAt,
        NewValues,
        u.FirstName + ' ' + u.LastName as ChangedByName
      FROM AuditLog a
      LEFT JOIN Users u ON a.ChangedBy = u.UserID
      WHERE a.TableName = 'PRF' 
        AND a.Action = 'INSERT'
        AND a.NewValues LIKE '%Excel Import%'
      ORDER BY a.ChangedAt DESC
      OFFSET @Offset ROWS
      FETCH NEXT @Limit ROWS ONLY
    `;

    const countQuery = `
      SELECT COUNT(*) as Total
      FROM AuditLog
      WHERE TableName = 'PRF' 
        AND Action = 'INSERT'
        AND NewValues LIKE '%Excel Import%'
    `;

    const [historyResult, countResult] = await Promise.all([
      executeQuery(query, { Offset: offset, Limit: limit }),
      executeQuery(countQuery)
    ]);

    const total = (countResult.recordset[0] as CountResult).Total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        imports: historyResult.recordset,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Import history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch import history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Helper function to import PRF data with PRF-Items relationship
 */
async function importPRFData(
  prfData: ExcelPRFData[], 
  options: { skipDuplicates: boolean; updateExisting: boolean },
  validation?: PRFImportResult
): Promise<PRFImportResult> {
  console.log('🚀 importPRFData called with:', prfData.length, 'records');
  console.log('⚙️ Import options:', options);
  
  const errors: Array<{ row: number; field: string; message: string; data?: unknown }> = [];
  const warnings: Array<{ row: number; message: string; data?: unknown }> = [];
  let importedRecords = 0;
  let skippedRecords = 0;

  // Get default user ID for imports (admin user)
  const adminQuery = `SELECT UserID FROM Users WHERE Role = 'admin' ORDER BY UserID`;
  const adminResult = await executeQuery(adminQuery);
  const defaultUserId = (adminResult.recordset[0] as User)?.UserID || 1;

  // Get default COA ID
  const coaQuery = `SELECT COAID FROM ChartOfAccounts WHERE IsActive = 1 ORDER BY COAID`;
  const coaResult = await executeQuery(coaQuery);
  const defaultCoaId = (coaResult.recordset[0] as ChartOfAccounts)?.COAID || 1;

  // Group records by PRF No
  const prfGroups = new Map<string, ExcelPRFData[]>();
  const rowNumbers = new Map<string, number[]>();
  
  prfData.forEach((record, index) => {
    const prfNo = record['PRF No']?.toString().trim();
    if (!prfNo) {
      errors.push({
        row: index + 2,
        field: 'PRF No',
        message: 'PRF No is mandatory and cannot be empty'
      });
      return;
    }
    
    if (!prfGroups.has(prfNo)) {
      prfGroups.set(prfNo, []);
      rowNumbers.set(prfNo, []);
    }
    prfGroups.get(prfNo)!.push(record);
    rowNumbers.get(prfNo)!.push(index + 2);
  });

  console.log(`📊 Grouped ${prfData.length} records into ${prfGroups.size} PRFs`);

  // Process each PRF group
  for (const [prfNo, records] of prfGroups) {
    try {
      // Use the first record for PRF header information
      const headerRecord = records[0];
      const firstRowNumber = rowNumbers.get(prfNo)![0];
      
      // Check if PRF already exists
      const existingPrfQuery = `SELECT PRFID FROM PRF WHERE PRFNo = @PRFNo`;
      const existingResult = await executeQuery(existingPrfQuery, { PRFNo: prfNo });
      
      let prfId: number;
      
      if (existingResult.recordset.length > 0) {
        // PRF exists
        prfId = (existingResult.recordset[0] as PRF).PRFID;
        
        if (options.skipDuplicates) {
          warnings.push({
            row: firstRowNumber,
            message: `PRF ${prfNo} already exists - skipped`
          });
          skippedRecords += records.length;
          continue;
        } else if (options.updateExisting) {
          // Update existing PRF with header info from first record
          await updateExistingPRF(prfId, headerRecord);
          warnings.push({
            row: firstRowNumber,
            message: `PRF ${prfNo} updated with new header information`
          });
        }
      } else {
        // Create new PRF
        prfId = await createNewPRF(headerRecord, defaultUserId, defaultCoaId, records);
      }
      
      // Add all records as PRF items
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const rowNumber = rowNumbers.get(prfNo)![i];
        
        try {
          await createPRFItem(prfId, record, rowNumber);
          importedRecords++;
        } catch (itemError) {
          errors.push({
            row: rowNumber,
            field: 'PRF Item',
            message: itemError instanceof Error ? itemError.message : 'Failed to create PRF item'
          });
        }
      }
      
    } catch (prfError) {
      const firstRowNumber = rowNumbers.get(prfNo)![0];
      errors.push({
        row: firstRowNumber,
        field: 'PRF',
        message: prfError instanceof Error ? prfError.message : 'Failed to create PRF'
      });
      skippedRecords += records.length;
    }
  }

  console.log(`📊 Import summary: ${importedRecords} imported, ${skippedRecords} skipped, ${errors.length} errors`);

  return {
    success: errors.length === 0,
    totalRecords: prfData.length,
    importedRecords,
    skippedRecords,
    errors,
    warnings
  };
}

/**
 * Create a new PRF from Excel data
 */
async function createNewPRF(
  headerRecord: ExcelPRFData, 
  defaultUserId: number, 
  defaultCoaId: number,
  allRecords: ExcelPRFData[]
): Promise<number> {
  const prfNo = headerRecord['PRF No'].toString().trim();
  const submitBy = headerRecord['Submit By'] || 'Unknown User';
  const dateSubmit = headerRecord['Date Submit'] || new Date();
  const budgetYear = headerRecord['Budget'];
  const sumDescription = headerRecord['Sum Description Requested'] || 'Imported from Excel';
  
  // Calculate total amount from all items
  const totalAmount = allRecords.reduce((sum, record) => sum + (record['Amount'] || 0), 0);
  
  const insertQuery = `
    INSERT INTO PRF (
      PRFNo, Title, Description, RequestorID, Department, COAID,
      RequestedAmount, Priority, Status, RequestDate,
      DateSubmit, SubmitBy, SumDescriptionRequested,
      PurchaseCostCode, RequiredFor, BudgetYear, Notes
    )
    OUTPUT INSERTED.PRFID
    VALUES (
      @PRFNo, @Title, @Description, @RequestorID, @Department, @COAID,
      @RequestedAmount, @Priority, @Status, @RequestDate,
      @DateSubmit, @SubmitBy, @SumDescriptionRequested,
      @PurchaseCostCode, @RequiredFor, @BudgetYear, @Notes
    )
  `;
  
  const params = {
    PRFNo: prfNo,
    Title: sumDescription,
    Description: headerRecord['Description'] || 'Imported from Excel',
    RequestorID: defaultUserId,
    Department: 'IT',
    COAID: defaultCoaId,
    RequestedAmount: totalAmount,
    Priority: 'Medium',
    Status: headerRecord['Status in Pronto'] || 'Completed',
    RequestDate: dateSubmit,
    DateSubmit: dateSubmit,
    SubmitBy: submitBy,
    SumDescriptionRequested: sumDescription,
    PurchaseCostCode: headerRecord['Purchase Cost Code'] || null,
    RequiredFor: headerRecord['Required for'] || null,
    BudgetYear: budgetYear,
    Notes: `Imported from Excel with ${allRecords.length} items`
  };
  
  const result = await executeQuery(insertQuery, params);
  const prfId = (result.recordset[0] as PRF).PRFID;
  
  console.log(`✅ Created PRF ${prfNo} with ID ${prfId}`);
  return prfId;
}

/**
 * Create a PRF item from Excel record
 */
async function createPRFItem(
  prfId: number, 
  record: ExcelPRFData, 
  rowNumber: number
): Promise<void> {
  const insertQuery = `
    INSERT INTO PRFItems (
      PRFID, ItemName, Description, Quantity, UnitPrice, Specifications
    ) VALUES (
      @PRFID, @ItemName, @Description, @Quantity, @UnitPrice, @Specifications
    )
  `;
  
  const itemName = record['Sum Description Requested'] || record['Description'] || `Item from row ${rowNumber}`;
  const description = record['Description'] || record['Sum Description Requested'] || '';
  const amount = record['Amount'] || 0;
  
  const params = {
    PRFID: prfId,
    ItemName: itemName.substring(0, 200), // Limit to field length
    Description: description.substring(0, 1000), // Limit to field length
    Quantity: 1,
    UnitPrice: amount,
    Specifications: JSON.stringify({
      originalRow: rowNumber,
      purchaseCostCode: record['Purchase Cost Code'],
      requiredFor: record['Required for'],
      statusInPronto: record['Status in Pronto']
    })
  };
  
  await executeQuery(insertQuery, params);
   console.log(`✅ Created PRF item for row ${rowNumber}`);
 }

 /**
  * Helper function to update existing PRF
  */
async function updateExistingPRF(prfId: number, record: ExcelPRFData): Promise<void> {
  const updateQuery = `
    UPDATE PRF SET
      DateSubmit = @DateSubmit,
      SubmitBy = @SubmitBy,
      SumDescriptionRequested = @SumDescriptionRequested,
      PurchaseCostCode = @PurchaseCostCode,
      RequiredFor = @RequiredFor,
      BudgetYear = @BudgetYear,
      UpdatedAt = GETDATE()
    WHERE PRFID = @PRFID
  `;

  const params = {
    PRFID: prfId,
    DateSubmit: record['Date Submit'],
    SubmitBy: record['Submit By'],
    SumDescriptionRequested: record['Sum Description Requested'],
    PurchaseCostCode: record['Purchase Cost Code'],
    RequiredFor: record['Required for'],
    BudgetYear: record['Budget']
  };

  await executeQuery(updateQuery, params);
}

export default router;