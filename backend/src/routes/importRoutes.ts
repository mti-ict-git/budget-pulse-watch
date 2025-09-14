import express from 'express';
import multer from 'multer';
import { ExcelParserService } from '../services/excelParser';
import { PRFModel } from '../models/PRF';
import { BulkPRFImportRequest, PRFImportResult, ExcelPRFData } from '../models/types';
import { executeQuery } from '../config/database';

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
router.post('/prf/validate', upload.single('file'), async (req, res) => {
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
router.post('/prf/bulk', upload.single('file'), async (req, res) => {
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

    const total = countResult.recordset[0].Total;
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
 * Helper function to import PRF data
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
  const adminQuery = `SELECT UserID FROM Users WHERE Role = 'Admin' ORDER BY UserID`;
  const adminResult = await executeQuery(adminQuery);
  const defaultUserId = adminResult.recordset[0]?.UserID || 1;

  // Get default COA ID
  const coaQuery = `SELECT COAID FROM ChartOfAccounts WHERE IsActive = 1 ORDER BY COAID`;
  const coaResult = await executeQuery(coaQuery);
  const defaultCoaId = coaResult.recordset[0]?.COAID || 1;

  for (let i = 0; i < prfData.length; i++) {
    const record = prfData[i];
    const rowNumber = i + 2; // Excel row number

    try {
      // Note: Duplicate PRF numbers are now allowed as per new requirements
      // Skip duplicate checking logic

      // Since we only import valid records, no need for error handling
      // All data should be valid at this point
      const notesParts = ['Imported from Excel'];
      
      // Use validated data directly
      const amount = record['Amount'];
      const budgetYear = record['Budget'];
      
      let submitBy = record['Submit By'];
      if (!submitBy || submitBy.trim().length === 0) {
        submitBy = 'Unknown User';
        notesParts.push('Submit By was missing - set to Unknown User');
      }
      
      // PRESERVE ORIGINAL PRF NUMBER FROM EXCEL - DO NOT AUTO-GENERATE!
      let prfNo = record['PRF No'];
      if (!prfNo || prfNo.toString().trim().length === 0) {
        // Only generate if completely missing
        const generatedNumber = await PRFModel.generatePRFNumber();
        prfNo = generatedNumber;
        notesParts.push('PRF No was missing - auto-generated');
      } else {
        // Use the original PRF number from Excel (trimmed)
        prfNo = prfNo.toString().trim();
        notesParts.push('PRF No preserved from Excel');
      }
      
      let description = record['Description'];
      if (!description || description.trim().length === 0) {
        description = 'No description provided';
        notesParts.push('Description was missing - set default');
      }
      
      let dateSubmit = record['Date Submit'];
      if (!dateSubmit) {
        dateSubmit = new Date();
        notesParts.push('Date Submit was missing - set to current date');
      }
      
      // No validation errors since we only import valid records
      
      // Insert new PRF record
      const insertQuery = `
        INSERT INTO PRF (
          PRFNumber, Title, Description, RequestorID, Department, COAID,
          RequestedAmount, Priority, Status, RequestDate,
          DateSubmit, SubmitBy, PRFNo, SumDescriptionRequested,
          PurchaseCostCode, RequiredFor, BudgetYear, Notes
        ) VALUES (
          @PRFNumber, @Title, @Description, @RequestorID, @Department, @COAID,
          @RequestedAmount, @Priority, @Status, @RequestDate,
          @DateSubmit, @SubmitBy, @PRFNo, @SumDescriptionRequested,
          @PurchaseCostCode, @RequiredFor, @BudgetYear, @Notes
        )
      `;

      const params = {
        PRFNumber: prfNo,
        Title: record['Sum Description Requested'] || description || 'Imported from Excel',
        Description: description,
        RequestorID: defaultUserId,
        Department: 'IT', // Default department
        COAID: defaultCoaId,
        RequestedAmount: amount,
        Priority: 'Medium',
        Status: 'Completed', // Historical data is typically completed
        RequestDate: dateSubmit,
        DateSubmit: dateSubmit,
        SubmitBy: submitBy,
        PRFNo: prfNo,
        SumDescriptionRequested: record['Sum Description Requested'] || null,
        PurchaseCostCode: record['Purchase Cost Code'] || null,
        RequiredFor: record['Required for'] || null,
        BudgetYear: budgetYear,
        Notes: notesParts.join('; ')
      };

      await executeQuery(insertQuery, params);
      importedRecords++;
      console.log(`✅ Imported record ${rowNumber}: PRF ${record['PRF No']}`);

    } catch (error) {
      console.error(`❌ Error importing record ${rowNumber}:`, error);
      errors.push({
        row: rowNumber,
        field: 'general',
        message: error instanceof Error ? error.message : 'Unknown error during import',
        data: record
      });
      skippedRecords++;
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