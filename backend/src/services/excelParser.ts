import * as XLSX from 'xlsx';
import { ExcelPRFData, ExcelBudgetData, PRFImportResult } from '../models/types';

/**
 * Excel Parser Service for PRF Data Import
 * Handles reading, parsing, and validating Excel files containing PRF and Budget data
 */
export class ExcelParserService {
  /**
   * Parse Excel file and extract PRF data
   */
  static parseExcelFile(buffer: Buffer, prfSheetNameInput?: string | null, budgetSheetNameInput?: string | null): { prfData: ExcelPRFData[], budgetData: ExcelBudgetData[] } {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;
    console.log('📋 Excel workbook sheets:', sheetNames);

    const prfSheetName = this.resolveSheetName(sheetNames, prfSheetNameInput, ['prf detail']);

    console.log('📄 Using PRF sheet:', prfSheetName);
    const prfWorksheet = workbook.Sheets[prfSheetName];
    const prfData = XLSX.utils.sheet_to_json(prfWorksheet, {
      header: 1,
      defval: null
    }) as unknown[][];
    
    console.log('📊 Raw PRF data rows:', prfData.length);
    if (prfData.length > 0) {
      console.log('📋 Headers:', prfData[0]);
      console.log('📄 First data row:', prfData[1]);
    }

    let budgetData: unknown[][] = [];
    const budgetSheetName = this.resolveSheetName(sheetNames, budgetSheetNameInput, ['budget detail']);

    if (budgetSheetName) {
      console.log('📄 Using Budget sheet:', budgetSheetName);
      const budgetWorksheet = workbook.Sheets[budgetSheetName];
      budgetData = XLSX.utils.sheet_to_json(budgetWorksheet, {
        header: 1,
        defval: null
      }) as unknown[][];
    }

    return {
      prfData: this.processPRFData(prfData),
      budgetData: this.processBudgetData(budgetData)
    };
  }

  static listSheetNames(buffer: Buffer): string[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return workbook.SheetNames;
  }

  private static resolveSheetName(sheetNames: string[], input?: string | null, hints?: string[]): string {
    if (input) {
      const target = input.toLowerCase();
      const matched = sheetNames.find(n => n.toLowerCase() === target) ?? sheetNames.find(n => n.toLowerCase().includes(target));
      if (matched) return matched;
    }
    if (hints && hints.length > 0) {
      for (const hint of hints) {
        const m = sheetNames.find(n => n.toLowerCase() === hint) ?? sheetNames.find(n => n.toLowerCase().includes(hint));
        if (m) return m;
      }
    }
    return sheetNames[0];
  }

  /**
   * Process raw PRF data from Excel
   */
  private static processPRFData(rawData: unknown[][]): ExcelPRFData[] {
    if (rawData.length === 0) {
      console.log('⚠️ No raw data to process');
      return [];
    }

    // Headers are in row 2 (index 1), not row 1 (index 0)
    const headers = rawData[1] as string[];
    const dataRows = rawData.slice(2); // Data starts from row 3 (index 2)
    console.log(`🔄 Processing ${dataRows.length} data rows`);
    console.log(`📋 Headers found:`, headers);
    console.log(`📋 First data row sample:`, dataRows[0]);

    const processedRecords = dataRows.map((row: unknown[], index: number) => {
      const record: Record<string, unknown> = {};
      headers.forEach((header: string, colIndex: number) => {
        record[header] = row[colIndex];
      });

      // Normalize PRF number column: support legacy "PR/PO No" header
      if (!record['PRF No'] && record['PR/PO No']) {
        record['PRF No'] = record['PR/PO No'];
      }

      // Convert Excel date serial numbers to Date objects
      if (record['Date Submit'] && typeof record['Date Submit'] === 'number') {
        record['Date Submit'] = this.excelDateToJSDate(record['Date Submit']);
      }

      // Ensure numeric fields are properly typed
      if (record['No']) record['No'] = Number(record['No']);
      if (record['Budget']) record['Budget'] = Number(record['Budget']);
      // Handle Amount field - convert empty string to 0, otherwise convert to number
      if (record['Amount'] === '' || record['Amount'] === null || record['Amount'] === undefined) {
        record['Amount'] = 0;
      } else {
        record['Amount'] = Number(record['Amount']);
      }
      if (record['PRF No']) {
        // Handle both string and numeric PRF numbers
        record['PRF No'] = record['PRF No'].toString();
      }

      // Handle Status in Pronto field
      if (record['Status in Pronto']) {
        record['Status in Pronto'] = record['Status in Pronto'].toString().trim();
      }

      // Debug log for first few records
      if (index < 3) {
        console.log(`📝 Record ${index + 1}:`, {
          No: record['No'],
          Amount: record['Amount'],
          'PRF No': record['PRF No'],
          'Submit By': record['Submit By'],
          'Status in Pronto': record['Status in Pronto']
        });
      }

      return record as unknown as ExcelPRFData;
    });

    // Log sample records before filtering
    console.log(`🔍 Sample records before filtering:`);
    processedRecords.slice(0, 3).forEach((record, index) => {
      console.log(`Record ${index + 1}:`, {
        'No': record['No'],
        'Amount': record['Amount'],
        'PRF No': record['PRF No'],
        'Submit By': record['Submit By'],
        'All Keys': Object.keys(record)
      });
    });

    // Apply filter and log results
    // Note: Ignore 'No' column as per user requirements
    const filteredRecords = processedRecords.filter(record => {
      // Only filter out completely empty rows
      const hasAnyData = Object.values(record).some(value => 
        value !== null && value !== undefined && value !== '' && value !== 0
      );
      
      if (!hasAnyData) {
        console.log(`🚫 Filtered out empty record:`, record);
      }
      
      return hasAnyData;
    });

    console.log(`✅ Processed: ${processedRecords.length} total, ${filteredRecords.length} valid records`);
    return filteredRecords;
  }

  /**
   * Process raw Budget data from Excel
   */
  private static processBudgetData(rawData: unknown[][]): ExcelBudgetData[] {
    if (rawData.length === 0) return [];

    // First row contains headers
    const headers = rawData[0] as string[];
    const dataRows = rawData.slice(1);

    return dataRows.map((row: unknown[]) => {
      const record: Record<string, unknown> = {};
      headers.forEach((header: string, index: number) => {
        record[header] = row[index];
      });

      // Ensure numeric fields are properly typed
      if (record['Initial Budget']) record['Initial Budget'] = Number(record['Initial Budget']);
      if (record['Remaining Budget']) record['Remaining Budget'] = Number(record['Remaining Budget']);

      return record as unknown as ExcelBudgetData;
    }).filter(record => record['COA'] && record['Category']); // Filter out empty rows
  }

  /**
   * Convert Excel date serial number to JavaScript Date
   */
  private static excelDateToJSDate(excelDate: number): Date {
    // Excel date serial number starts from 1900-01-01
    const excelEpoch = new Date(1900, 0, 1);
    const jsDate = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000);
    return jsDate;
  }

  /**
   * Validate PRF data before import
   */
  static validatePRFData(prfData: ExcelPRFData[]): PRFImportResult {
    const errors: Array<{ row: number; field: string; message: string; data?: unknown; prfNo?: string }> = [];
    const warnings: Array<{ row: number; message: string; data?: unknown; prfNo?: string }> = [];
    let validRecords = 0;

    prfData.forEach((record, index) => {
      const rowNumber = index + 2; // +2 because Excel rows start at 1 and we skip header
      
      // Get PRF number for error context (if available and valid)
      const prfNo = record['PRF No'] && record['PRF No'].toString().trim().length > 0 
        ? record['PRF No'].toString().trim() 
        : undefined;

      // Required field validations
      // Note: 'No' column is ignored as per new requirements

      // Budget year validation - required and must be in valid range
      if (!record['Budget']) {
        errors.push({
          row: rowNumber,
          field: 'Budget',
          message: 'Budget year is required',
          data: record['Budget'],
          prfNo
        });
      } else {
        const budgetYear = parseInt(record['Budget'].toString());
        if (isNaN(budgetYear) || budgetYear < 2020 || budgetYear > 2030) {
          errors.push({
            row: rowNumber,
            field: 'Budget',
            message: 'Budget year must be between 2020-2030',
            data: record['Budget'],
            prfNo
          });
        }
      }

      // Date submitted validation - required and must be valid
      if (!record['Date Submit']) {
        errors.push({
          row: rowNumber,
          field: 'Date Submit',
          message: 'Date submitted is required',
          data: record['Date Submit'],
          prfNo
        });
      } else {
        const dateValue = record['Date Submit'];
        let isValidDate = false;
        
        if (dateValue instanceof Date) {
          isValidDate = !isNaN(dateValue.getTime());
        } else if (typeof dateValue === 'number') {
          // Excel date serial number
          isValidDate = dateValue > 0 && dateValue < 100000; // reasonable range
        } else if (typeof dateValue === 'string') {
          const parsedDate = new Date(dateValue);
          isValidDate = !isNaN(parsedDate.getTime());
        }
        
        if (!isValidDate) {
          errors.push({
            row: rowNumber,
            field: 'Date Submit',
            message: 'Date submitted is not a valid date',
            data: record['Date Submit'],
            prfNo
          });
        }
      }

      // Submitter existence validation
      if (!record['Submit By'] || record['Submit By'].toString().trim().length === 0) {
        errors.push({
          row: rowNumber,
          field: 'Submit By',
          message: 'Submitter name is required and cannot be empty',
          data: record['Submit By'],
          prfNo
        });
      }

      // PRF No validation - MANDATORY field, must contain digits
      if (!record['PRF No'] || record['PRF No'].toString().trim().length === 0) {
        errors.push({
          row: rowNumber,
          field: 'PRF No',
          message: 'PRF number is MANDATORY and cannot be empty',
          data: record['PRF No'],
          prfNo: undefined // PRF No is empty, so we can't include it
        });
      } else {
        const currentPrfNo = record['PRF No'].toString().trim();
        if (!/\d/.test(currentPrfNo)) {
          errors.push({
            row: rowNumber,
            field: 'PRF No',
            message: 'PRF number must contain at least one digit',
            data: record['PRF No'],
            prfNo: currentPrfNo // Include the invalid PRF number for context
          });
        }
      }
      // Note: Duplicate PRF numbers are allowed as per requirements

      if (!record['Amount'] || record['Amount'] <= 0) {
        errors.push({
          row: rowNumber,
          field: 'Amount',
          message: 'Amount is required and must be positive',
          data: record['Amount'],
          prfNo
        });
      }

      if (!record['Description'] || record['Description'].trim().length === 0) {
        errors.push({
          row: rowNumber,
          field: 'Description',
          message: 'Description is required',
          data: record['Description'],
          prfNo
        });
      }

      // Warnings for optional but recommended fields
      if (!record['Sum Description Requested']) {
        warnings.push({
          row: rowNumber,
          message: 'Sum Description Requested is missing',
          data: record,
          prfNo
        });
      }

      if (!record['Purchase Cost Code']) {
        warnings.push({
          row: rowNumber,
          message: 'Purchase Cost Code is missing',
          data: record,
          prfNo
        });
      }

      if (!record['Required for']) {
        warnings.push({
          row: rowNumber,
          message: 'Required for field is missing',
          data: record,
          prfNo
        });
      }

      // Count valid records (no errors for this record)
      const recordErrors = errors.filter(e => e.row === rowNumber);
      if (recordErrors.length === 0) {
        validRecords++;
      }
    });

    return {
      success: errors.length === 0,
      totalRecords: prfData.length,
      importedRecords: validRecords,
      skippedRecords: prfData.length - validRecords,
      errors,
      warnings
    };
  }

  /**
   * Validate Budget data before import
   */
  static validateBudgetData(budgetData: ExcelBudgetData[]): PRFImportResult {
    const errors: Array<{ row: number; field: string; message: string; data?: unknown }> = [];
    const warnings: Array<{ row: number; message: string; data?: unknown }> = [];
    let validRecords = 0;

    budgetData.forEach((record, index) => {
      const rowNumber = index + 2; // +2 because Excel rows start at 1 and we skip header

      // Required field validations
      if (!record['COA'] || record['COA'].trim().length === 0) {
        errors.push({
          row: rowNumber,
          field: 'COA',
          message: 'COA code is required',
          data: record['COA']
        });
      }

      if (!record['Category'] || record['Category'].trim().length === 0) {
        errors.push({
          row: rowNumber,
          field: 'Category',
          message: 'Category is required',
          data: record['Category']
        });
      }

      if (!record['Initial Budget'] || record['Initial Budget'] <= 0) {
        errors.push({
          row: rowNumber,
          field: 'Initial Budget',
          message: 'Initial Budget is required and must be positive',
          data: record['Initial Budget']
        });
      }

      if (record['Remaining Budget'] < 0) {
        errors.push({
          row: rowNumber,
          field: 'Remaining Budget',
          message: 'Remaining Budget cannot be negative',
          data: record['Remaining Budget']
        });
      }

      // Warning if remaining budget is greater than initial budget
      if (record['Remaining Budget'] > record['Initial Budget']) {
        warnings.push({
          row: rowNumber,
          message: 'Remaining Budget is greater than Initial Budget',
          data: record
        });
      }

      // Count valid records (no errors for this record)
      const recordErrors = errors.filter(e => e.row === rowNumber);
      if (recordErrors.length === 0) {
        validRecords++;
      }
    });

    return {
      success: errors.length === 0,
      totalRecords: budgetData.length,
      importedRecords: validRecords,
      skippedRecords: budgetData.length - validRecords,
      errors,
      warnings
    };
  }

  /**
   * Get supported file extensions
   */
  static getSupportedExtensions(): string[] {
    return ['.xlsx', '.xls', '.csv'];
  }

  /**
   * Check if file extension is supported
   */
  static isSupportedFile(filename: string): boolean {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return this.getSupportedExtensions().includes(ext);
  }
}
