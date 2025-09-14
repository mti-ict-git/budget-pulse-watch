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
  static parseExcelFile(buffer: Buffer): { prfData: ExcelPRFData[], budgetData: ExcelBudgetData[] } {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    console.log('📋 Excel workbook sheets:', workbook.SheetNames);
    
    // Extract PRF data from first sheet
    const prfSheetName = workbook.SheetNames[0];
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

    // Extract Budget data from second sheet (if exists)
    let budgetData: unknown[][] = [];
    if (workbook.SheetNames.length > 1) {
      const budgetSheetName = workbook.SheetNames[1];
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

      // Debug log for first few records
      if (index < 3) {
        console.log(`📝 Record ${index + 1}:`, {
          No: record['No'],
          Amount: record['Amount'],
          'PRF No': record['PRF No'],
          'Submit By': record['Submit By']
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
    const filteredRecords = processedRecords.filter(record => {
      const hasNo = record['No'] && record['No'] !== null && record['No'] !== undefined && !isNaN(record['No'] as number) && record['No'] > 0;
      const hasValidAmount = record['Amount'] !== null && record['Amount'] !== undefined && !isNaN(record['Amount'] as number);
      
      if (!hasNo || !hasValidAmount) {
        console.log(`🚫 Filtered out record:`, {
          No: record['No'],
          Amount: record['Amount'],
          hasNo,
          hasValidAmount,
          NoType: typeof record['No'],
          AmountType: typeof record['Amount']
        });
      }
      
      return hasNo && hasValidAmount;
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
    const errors: Array<{ row: number; field: string; message: string; data?: unknown }> = [];
    const warnings: Array<{ row: number; message: string; data?: unknown }> = [];
    let validRecords = 0;

    prfData.forEach((record, index) => {
      const rowNumber = index + 2; // +2 because Excel rows start at 1 and we skip header

      // Required field validations
      if (!record['No'] || record['No'] <= 0) {
        errors.push({
          row: rowNumber,
          field: 'No',
          message: 'Row number is required and must be positive',
          data: record['No']
        });
      }

      if (!record['Budget'] || record['Budget'] < 2020 || record['Budget'] > 2030) {
        errors.push({
          row: rowNumber,
          field: 'Budget',
          message: 'Budget year is required and must be between 2020-2030',
          data: record['Budget']
        });
      }

      if (!record['Date Submit']) {
        errors.push({
          row: rowNumber,
          field: 'Date Submit',
          message: 'Submit date is required',
          data: record['Date Submit']
        });
      }

      if (!record['Submit By'] || record['Submit By'].trim().length === 0) {
        errors.push({
          row: rowNumber,
          field: 'Submit By',
          message: 'Submitter name is required',
          data: record['Submit By']
        });
      }

      if (!record['PRF No']) {
        errors.push({
          row: rowNumber,
          field: 'PRF No',
          message: 'PRF number is required',
          data: record['PRF No']
        });
      }

      if (!record['Amount'] || record['Amount'] <= 0) {
        errors.push({
          row: rowNumber,
          field: 'Amount',
          message: 'Amount is required and must be positive',
          data: record['Amount']
        });
      }

      if (!record['Description'] || record['Description'].trim().length === 0) {
        errors.push({
          row: rowNumber,
          field: 'Description',
          message: 'Description is required',
          data: record['Description']
        });
      }

      // Warnings for optional but recommended fields
      if (!record['Sum Description Requested']) {
        warnings.push({
          row: rowNumber,
          message: 'Sum Description Requested is missing',
          data: record
        });
      }

      if (!record['Purchase Cost Code']) {
        warnings.push({
          row: rowNumber,
          message: 'Purchase Cost Code is missing',
          data: record
        });
      }

      if (!record['Required for']) {
        warnings.push({
          row: rowNumber,
          message: 'Required for field is missing',
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