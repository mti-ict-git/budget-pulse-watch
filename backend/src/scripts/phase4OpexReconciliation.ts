import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { connectDatabase, closeDatabase, executeQuery } from '../config/database';

dotenv.config();

interface Args {
  excelPath: string;
  fiscalYear: number;
}

interface ExcelBudgetRow {
  coaCode: string;
  allocatedAmount: number | null;
  category: string | null;
}

interface CoaRow {
  COAID: number;
  COACode: string;
  COAName: string;
  ExpenseType: string | null;
  IsActive: boolean;
}

interface ExistingBudgetRow {
  BudgetID: number;
  COAID: number;
  FiscalYear: number;
  AllocatedAmount: number;
}

type Decision = 'insert' | 'update' | 'rejected';

interface ReconcileRow {
  coaCode: string;
  allocatedAmount: number | null;
  decision: Decision;
  reason: string;
  coaId: number | null;
  budgetId: number | null;
}

interface ReconcileReport {
  generatedAt: string;
  fiscalYear: number;
  excelPath: string;
  summary: {
    totalRows: number;
    inserted: number;
    updated: number;
    rejected: number;
  };
  rows: ReconcileRow[];
}

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const excelArg = raw.find((arg) => arg.startsWith('--excel='));
  const yearArg = raw.find((arg) => arg.startsWith('--year='));
  const excelPath = excelArg ? excelArg.slice('--excel='.length) : path.resolve(process.cwd(), 'PRF IT MONITORING - NEW UPDATED.xlsx');
  const parsedYear = yearArg ? Number(yearArg.slice('--year='.length)) : 2026;
  return {
    excelPath,
    fiscalYear: Number.isFinite(parsedYear) ? parsedYear : 2026,
  };
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const numberValue = Number(value.trim().replace(/,/g, ''));
    return Number.isFinite(numberValue) ? numberValue : null;
  }
  return null;
}

function resolveSheetName(sheetNames: string[], hint: string): string {
  const target = normalizeText(hint);
  const exact = sheetNames.find((name) => normalizeText(name) === target);
  if (exact) return exact;
  const fuzzy = sheetNames.find((name) => normalizeText(name).includes(target));
  return fuzzy || sheetNames[0];
}

function findColumn(headers: string[], aliases: string[]): number | null {
  const aliasSet = new Set(aliases.map((alias) => normalizeText(alias)));
  for (let idx = 0; idx < headers.length; idx += 1) {
    if (aliasSet.has(normalizeText(headers[idx]))) return idx;
  }
  return null;
}

function parseBudgetRows(excelPath: string): ExcelBudgetRow[] {
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel source not found: ${excelPath}`);
  }
  const workbook = XLSX.readFile(excelPath);
  const sheetName = resolveSheetName(workbook.SheetNames, 'Budget Detail');
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  if (matrix.length === 0) {
    return [];
  }

  const headers = matrix[0].map((cell) => String(cell ?? ''));
  const rows = matrix.slice(1);
  const coaIdx = findColumn(headers, ['COA', 'COA Code', 'COACode']);
  const amountIdx = findColumn(headers, ['Initial Budget', 'Allocated Amount', 'Amount']);
  const categoryIdx = findColumn(headers, ['Category']);
  if (coaIdx === null || amountIdx === null) {
    throw new Error('Budget Detail requires COA and Initial Budget columns');
  }

  const output: ExcelBudgetRow[] = [];
  rows.forEach((row) => {
    const coaCode = String(row[coaIdx] ?? '').trim();
    if (!coaCode) return;
    output.push({
      coaCode,
      allocatedAmount: toNumber(row[amountIdx]),
      category: categoryIdx === null ? null : String(row[categoryIdx] ?? '').trim() || null,
    });
  });
  return output;
}

async function getCoaRows(): Promise<CoaRow[]> {
  const query = `
    SELECT COAID, COACode, COAName, ExpenseType, IsActive
    FROM ChartOfAccounts
  `;
  const result = await executeQuery<CoaRow>(query);
  return result.recordset;
}

async function getExistingBudgetRows(fiscalYear: number): Promise<ExistingBudgetRow[]> {
  const query = `
    SELECT BudgetID, COAID, FiscalYear, AllocatedAmount
    FROM Budget
    WHERE FiscalYear = @FiscalYear
  `;
  const result = await executeQuery<ExistingBudgetRow>(query, { FiscalYear: fiscalYear });
  return result.recordset;
}

function reportDirectory(): string {
  return path.resolve(__dirname, '../../../docs/reports');
}

function ensureReportDirectory(): void {
  const dir = reportDirectory();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function csvEscape(value: string | number | null): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function toCsv(rows: ReconcileRow[]): string {
  const header = 'COACode,AllocatedAmount,Decision,Reason,COAID,BudgetID';
  const lines = rows.map((row) =>
    [
      csvEscape(row.coaCode),
      csvEscape(row.allocatedAmount),
      csvEscape(row.decision),
      csvEscape(row.reason),
      csvEscape(row.coaId),
      csvEscape(row.budgetId),
    ].join(',')
  );
  return [header, ...lines].join('\n');
}

function writeReport(report: ReconcileReport): { jsonPath: string; csvPath: string } {
  ensureReportDirectory();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `phase4-opex-reconciliation-${stamp}`;
  const jsonPath = path.join(reportDirectory(), `${base}.json`);
  const csvPath = path.join(reportDirectory(), `${base}.csv`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  fs.writeFileSync(csvPath, toCsv(report.rows), 'utf-8');
  return { jsonPath, csvPath };
}

function reconcileRows(
  excelRows: ExcelBudgetRow[],
  coaRows: CoaRow[],
  existingBudgetRows: ExistingBudgetRow[]
): ReconcileRow[] {
  const coaByCode = new Map<string, CoaRow>();
  coaRows.forEach((row) => {
    const key = normalizeText(row.COACode);
    if (key && !coaByCode.has(key)) {
      coaByCode.set(key, row);
    }
  });
  const existingByCoaId = new Map<number, ExistingBudgetRow>();
  existingBudgetRows.forEach((row) => {
    if (!existingByCoaId.has(row.COAID)) {
      existingByCoaId.set(row.COAID, row);
    }
  });

  return excelRows.map((row) => {
    const coa = coaByCode.get(normalizeText(row.coaCode));
    if (!coa) {
      return {
        coaCode: row.coaCode,
        allocatedAmount: row.allocatedAmount,
        decision: 'rejected',
        reason: 'COA code not found in ChartOfAccounts',
        coaId: null,
        budgetId: null,
      };
    }
    if (!coa.IsActive) {
      return {
        coaCode: row.coaCode,
        allocatedAmount: row.allocatedAmount,
        decision: 'rejected',
        reason: 'COA is inactive',
        coaId: coa.COAID,
        budgetId: null,
      };
    }
    if (normalizeText(coa.ExpenseType) !== 'OPEX') {
      return {
        coaCode: row.coaCode,
        allocatedAmount: row.allocatedAmount,
        decision: 'rejected',
        reason: 'COA expense type is not OPEX',
        coaId: coa.COAID,
        budgetId: null,
      };
    }
    if (row.allocatedAmount === null || row.allocatedAmount <= 0) {
      return {
        coaCode: row.coaCode,
        allocatedAmount: row.allocatedAmount,
        decision: 'rejected',
        reason: 'Allocated amount must be positive',
        coaId: coa.COAID,
        budgetId: null,
      };
    }

    const existing = existingByCoaId.get(coa.COAID);
    if (existing) {
      return {
        coaCode: row.coaCode,
        allocatedAmount: row.allocatedAmount,
        decision: 'update',
        reason: 'Existing FY budget found for COA',
        coaId: coa.COAID,
        budgetId: existing.BudgetID,
      };
    }
    return {
      coaCode: row.coaCode,
      allocatedAmount: row.allocatedAmount,
      decision: 'insert',
      reason: 'No FY budget found for COA',
      coaId: coa.COAID,
      budgetId: null,
    };
  });
}

async function main(): Promise<void> {
  const args = parseArgs();
  await connectDatabase();
  try {
    const [coaRows, existingBudgetRows] = await Promise.all([getCoaRows(), getExistingBudgetRows(args.fiscalYear)]);
    const excelRows = parseBudgetRows(args.excelPath);
    const rows = reconcileRows(excelRows, coaRows, existingBudgetRows);
    const inserted = rows.filter((row) => row.decision === 'insert').length;
    const updated = rows.filter((row) => row.decision === 'update').length;
    const rejected = rows.filter((row) => row.decision === 'rejected').length;

    const report: ReconcileReport = {
      generatedAt: new Date().toISOString(),
      fiscalYear: args.fiscalYear,
      excelPath: args.excelPath,
      summary: {
        totalRows: rows.length,
        inserted,
        updated,
        rejected,
      },
      rows,
    };

    const output = writeReport(report);
    console.log(`Fiscal year: ${args.fiscalYear}`);
    console.log(`Rows analyzed: ${report.summary.totalRows}`);
    console.log(`Inserted: ${report.summary.inserted}`);
    console.log(`Updated: ${report.summary.updated}`);
    console.log(`Rejected: ${report.summary.rejected}`);
    console.log(`Report JSON: ${output.jsonPath}`);
    console.log(`Report CSV: ${output.csvPath}`);
  } catch (error) {
    console.error('Phase 4 OPEX reconciliation failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

main();
