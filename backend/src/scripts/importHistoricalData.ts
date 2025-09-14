import * as fs from 'fs';
import * as path from 'path';
import { ExcelParserService } from '../services/excelParser';
import { executeQuery, connectDatabase } from '../config/database';
import { ExcelPRFData, ExcelBudgetData } from '../models/types';
import { PRFModel } from '../models/PRF';

/**
 * Historical Data Import Script
 * Imports 530 PRF records from the Excel file into the database
 */
class HistoricalDataImporter {
  private static readonly EXCEL_FILE_PATH = path.join(__dirname, '../../../PRF IT MONITORING - NEW UPDATED (1).xlsx');
  private static readonly BATCH_SIZE = 50; // Process records in batches

  /**
   * Main import function
   */
  static async importHistoricalData(): Promise<void> {
    console.log('🚀 Starting historical data import...');
    console.log(`📁 Excel file: ${this.EXCEL_FILE_PATH}`);

    try {
      // Connect to database
      await connectDatabase();
      console.log('✅ Database connected');

      // Check if Excel file exists
      if (!fs.existsSync(this.EXCEL_FILE_PATH)) {
        throw new Error(`Excel file not found: ${this.EXCEL_FILE_PATH}`);
      }

      // Read and parse Excel file
      const fileBuffer = fs.readFileSync(this.EXCEL_FILE_PATH);
      const { prfData, budgetData } = ExcelParserService.parseExcelFile(fileBuffer);
      
      console.log(`📊 Found ${prfData.length} PRF records and ${budgetData.length} budget records`);

      // Validate data
      const validation = ExcelParserService.validatePRFData(prfData);
      console.log(`✅ Validation: ${validation.importedRecords}/${validation.totalRecords} valid records`);
      
      if (validation.errors.length > 0) {
        console.log(`⚠️  ${validation.errors.length} validation errors found:`);
        validation.errors.slice(0, 5).forEach(error => {
          console.log(`   Row ${error.row}: ${error.field} - ${error.message}`);
        });
        if (validation.errors.length > 5) {
          console.log(`   ... and ${validation.errors.length - 5} more errors`);
        }
      }

      // Setup default data
      await this.setupDefaultData();

      // Import PRF data in batches
      await this.importPRFDataInBatches(prfData);

      // Import budget data if available
      if (budgetData.length > 0) {
        await this.importBudgetData(budgetData);
      }

      console.log('🎉 Historical data import completed successfully!');

    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  }

  /**
   * Setup default users and COA if they don't exist
   */
  private static async setupDefaultData(): Promise<void> {
    console.log('🔧 Setting up default data...');

    // Create default users for submitters found in Excel
    const submitters = [
      'Adriana', 'Indah', 'Hendra', 'Sari', 'Budi', 'Rina', 'Dedi', 'Maya',
      'Andi', 'Lina', 'Rudi', 'Tina', 'Joko', 'Nina', 'Agus'
    ];

    for (const submitter of submitters) {
      await this.createUserIfNotExists(submitter);
    }

    // Create default COA entries for cost codes
    const costCodes = [
      { code: 'MTIRMRAD496001', name: 'IT Infrastructure Equipment', category: 'Equipment' },
      { code: 'MTIRMRAD496002', name: 'Software Licenses', category: 'Software' },
      { code: 'MTIRMRAD496003', name: 'IT Services', category: 'Services' },
      { code: 'MTIRMRAD496004', name: 'Monthly Billing', category: 'Services' },
      { code: 'MTIRMRAD496005', name: 'Maintenance & Support', category: 'Maintenance' }
    ];

    for (const coa of costCodes) {
      await this.createCOAIfNotExists(coa.code, coa.name, coa.category);
    }

    console.log('✅ Default data setup completed');
  }

  /**
   * Create user if not exists
   */
  private static async createUserIfNotExists(name: string): Promise<number> {
    const checkQuery = `SELECT UserID FROM Users WHERE FirstName = @FirstName`;
    const result = await executeQuery(checkQuery, { FirstName: name });

    if (result.recordset.length > 0) {
      return result.recordset[0].UserID;
    }

    const insertQuery = `
      INSERT INTO Users (Username, Email, PasswordHash, FirstName, LastName, Role, Department)
      OUTPUT INSERTED.UserID
      VALUES (@Username, @Email, @PasswordHash, @FirstName, @LastName, @Role, @Department)
    `;

    const params = {
      Username: name.toLowerCase(),
      Email: `${name.toLowerCase()}@company.com`,
      PasswordHash: '$2b$10$rQZ8kHp.TB.It.NuiNvxaOZvBz4Lp8J8m8qfPXU5JtHfQy7TZjHNe', // default password
      FirstName: name,
      LastName: 'User',
      Role: 'User',
      Department: 'IT'
    };

    const insertResult = await executeQuery(insertQuery, params);
    return insertResult.recordset[0].UserID;
  }

  /**
   * Create COA if not exists
   */
  private static async createCOAIfNotExists(code: string, name: string, category: string): Promise<number> {
    const checkQuery = `SELECT COAID FROM ChartOfAccounts WHERE COACode = @COACode`;
    const result = await executeQuery(checkQuery, { COACode: code });

    if (result.recordset.length > 0) {
      return result.recordset[0].COAID;
    }

    const insertQuery = `
      INSERT INTO ChartOfAccounts (COACode, COAName, Description, Category)
      OUTPUT INSERTED.COAID
      VALUES (@COACode, @COAName, @Description, @Category)
    `;

    const params = {
      COACode: code,
      COAName: name,
      Description: `Imported from Excel - ${name}`,
      Category: category
    };

    const insertResult = await executeQuery(insertQuery, params);
    return insertResult.recordset[0].COAID;
  }

  /**
   * Import PRF data in batches
   */
  private static async importPRFDataInBatches(prfData: ExcelPRFData[]): Promise<void> {
    console.log(`📥 Importing ${prfData.length} PRF records in batches of ${this.BATCH_SIZE}...`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < prfData.length; i += this.BATCH_SIZE) {
      const batch = prfData.slice(i, i + this.BATCH_SIZE);
      console.log(`   Processing batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(prfData.length / this.BATCH_SIZE)} (${batch.length} records)`);

      for (const record of batch) {
        try {
          const result = await this.importSinglePRF(record);
          if (result.success) {
            imported++;
          } else {
            skipped++;
          }
        } catch (error) {
          errors++;
          console.error(`   ❌ Error importing record ${record['No']}: ${error}`);
        }
      }

      // Small delay between batches to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`📊 Import summary: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  }

  /**
   * Import single PRF record
   */
  private static async importSinglePRF(record: ExcelPRFData): Promise<{ success: boolean; message?: string }> {
    try {
      // Check for duplicates
      if (record['PRF No']) {
        const duplicateQuery = `SELECT PRFID FROM PRF WHERE PRFNo = @PRFNo`;
        const duplicateResult = await executeQuery(duplicateQuery, { PRFNo: record['PRF No'] });
        
        if (duplicateResult.recordset.length > 0) {
          return { success: false, message: 'Duplicate PRF No' };
        }
      }

      // Get user ID for submitter
      let requestorId = 1; // Default admin
      if (record['Submit By']) {
        const userQuery = `SELECT UserID FROM Users WHERE FirstName = @FirstName`;
        const userResult = await executeQuery(userQuery, { FirstName: record['Submit By'] });
        if (userResult.recordset.length > 0) {
          requestorId = userResult.recordset[0].UserID;
        }
      }

      // Get COA ID for cost code
      let coaId = 1; // Default COA
      if (record['Purchase Cost Code']) {
        const coaQuery = `SELECT COAID FROM ChartOfAccounts WHERE COACode = @COACode`;
        const coaResult = await executeQuery(coaQuery, { COACode: record['Purchase Cost Code'] });
        if (coaResult.recordset.length > 0) {
          coaId = coaResult.recordset[0].COAID;
        }
      }

      // Generate PRF number
      const prfNumber = await PRFModel.generatePRFNumber();

      // Insert PRF record
      const insertQuery = `
        INSERT INTO PRF (
          PRFNumber, Title, Description, RequestorID, Department, COAID,
          RequestedAmount, Priority, Status, RequestDate,
          DateSubmit, SubmitBy, PRFNo, SumDescriptionRequested,
          PurchaseCostCode, RequiredFor, BudgetYear, Notes,
          CreatedAt, UpdatedAt
        ) VALUES (
          @PRFNumber, @Title, @Description, @RequestorID, @Department, @COAID,
          @RequestedAmount, @Priority, @Status, @RequestDate,
          @DateSubmit, @SubmitBy, @PRFNo, @SumDescriptionRequested,
          @PurchaseCostCode, @RequiredFor, @BudgetYear, @Notes,
          GETDATE(), GETDATE()
        )
      `;

      const params = {
        PRFNumber: prfNumber,
        Title: record['Sum Description Requested'] || record['Description'] || 'Imported from Excel',
        Description: record['Description'] || '',
        RequestorID: requestorId,
        Department: 'IT',
        COAID: coaId,
        RequestedAmount: record['Amount'] || 0,
        Priority: 'Medium',
        Status: 'Completed', // Historical data is completed
        RequestDate: record['Date Submit'] || new Date(),
        DateSubmit: record['Date Submit'],
        SubmitBy: record['Submit By'],
        PRFNo: record['PRF No'],
        SumDescriptionRequested: record['Sum Description Requested'],
        PurchaseCostCode: record['Purchase Cost Code'],
        RequiredFor: record['Required for'],
        BudgetYear: record['Budget'],
        Notes: 'Imported from Excel - Historical Data'
      };

      await executeQuery(insertQuery, params);
      return { success: true };

    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Import budget data
   */
  private static async importBudgetData(budgetData: ExcelBudgetData[]): Promise<void> {
    console.log(`💰 Importing ${budgetData.length} budget records...`);

    for (const record of budgetData) {
      try {
        // Find or create COA for budget category
        const coaId = await this.createCOAIfNotExists(
          record['COA'] || 'BUDGET-001',
          record['Category'] || 'General Budget',
          'Budget'
        );

        // Check if budget already exists
        const checkQuery = `
          SELECT BudgetID FROM Budget 
          WHERE COAID = @COAID AND FiscalYear = @FiscalYear
        `;
        const checkResult = await executeQuery(checkQuery, {
          COAID: coaId,
          FiscalYear: new Date().getFullYear()
        });

        if (checkResult.recordset.length === 0) {
          // Insert new budget record
          const insertQuery = `
            INSERT INTO Budget (
              COAID, FiscalYear, AllocatedAmount, UtilizedAmount,
              Notes, CreatedBy, CreatedAt, UpdatedAt
            ) VALUES (
              @COAID, @FiscalYear, @AllocatedAmount, @UtilizedAmount,
              @Notes, @CreatedBy, GETDATE(), GETDATE()
            )
          `;

          const utilizedAmount = (record['Initial Budget'] || 0) - (record['Remaining Budget'] || 0);

          await executeQuery(insertQuery, {
            COAID: coaId,
            FiscalYear: new Date().getFullYear(),
            AllocatedAmount: record['Initial Budget'] || 0,
            UtilizedAmount: utilizedAmount,
            Notes: 'Imported from Excel',
            CreatedBy: 1 // Admin user
          });
        }
      } catch (error) {
        console.error(`❌ Error importing budget record: ${error}`);
      }
    }

    console.log('✅ Budget data import completed');
  }
}

// Run the import if this script is executed directly
if (require.main === module) {
  HistoricalDataImporter.importHistoricalData()
    .then(() => {
      console.log('✅ Import completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Import failed:', error);
      process.exit(1);
    });
}

export { HistoricalDataImporter };