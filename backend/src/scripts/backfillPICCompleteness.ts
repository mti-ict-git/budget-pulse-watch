import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { connectDatabase, closeDatabase, executeQuery } from '../config/database';

dotenv.config();

type Mode = 'dry-run' | 'apply';

interface Args {
  mode: Mode;
  excelPath: string;
  budgetYear: number | null;
  fallbackUnknown: boolean;
}

interface PRFItemCandidate {
  PRFItemID: number;
  PRFID: number;
  PRFNo: string | null;
  ItemName: string;
  Description: string | null;
  UnitPrice: number | null;
  BudgetYear: number | null;
  PurchaseCostCode: string | null;
  UpdatedBy: number | null;
}

interface UserRow {
  UserID: number;
  Username: string;
  FirstName: string;
  LastName: string;
  Role: 'admin' | 'doccon' | 'user';
  IsActive: boolean;
}

interface ExcelRow {
  prfNo: string;
  budgetYear: number | null;
  description: string;
  amount: number | null;
  costCode: string | null;
  picPickup: string | null;
}

type ResolutionStrategy = 'updatedBy' | 'excelPicMappedUser' | 'excelPicText' | 'fallbackUnknown' | 'unresolved';

interface Resolution {
  prfItemId: number;
  prfNo: string | null;
  strategy: ResolutionStrategy;
  pickedUpBy: string | null;
  pickedUpByUserId: number | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  reason: string;
}

interface Report {
  generatedAt: string;
  mode: Mode;
  budgetYear: number | null;
  excelPath: string;
  totals: {
    candidates: number;
    resolvedUpdatedBy: number;
    resolvedExcelMappedUser: number;
    resolvedExcelText: number;
    resolvedFallbackUnknown: number;
    unresolved: number;
    updatesPlanned: number;
    updatesApplied: number;
  };
  rows: Resolution[];
}

const placeholderValues: Set<string> = new Set(['', '-', 'N/A', 'NA', 'NONE', 'NULL']);

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const mode: Mode = raw.includes('--apply') ? 'apply' : 'dry-run';
  const excelArg = raw.find((arg) => arg.startsWith('--excel='));
  const yearArg = raw.find((arg) => arg.startsWith('--year='));
  const fallbackUnknown = raw.includes('--fallback-unknown');
  const excelPath = excelArg ? excelArg.slice('--excel='.length) : path.resolve(process.cwd(), 'PRF IT MONITORING - NEW UPDATED.xlsx');
  const parsedYear = yearArg ? Number(yearArg.slice('--year='.length)) : null;
  return {
    mode,
    excelPath,
    budgetYear: Number.isFinite(parsedYear) ? parsedYear : null,
    fallbackUnknown,
  };
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeKey(value: string | null | undefined): string {
  return normalizeText(value).replace(/[^A-Z0-9]/g, '');
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = Number(value.trim().replace(/,/g, ''));
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function cleanPic(value: string | null | undefined): string | null {
  const trimmed = value ? value.trim() : '';
  if (trimmed.length === 0) return null;
  const normalized = normalizeText(trimmed);
  if (placeholderValues.has(normalized)) return null;
  if (normalized.startsWith('UPDATED:')) return null;
  return trimmed.replace(/\s+/g, ' ');
}

function resolveSheetName(sheetNames: string[], hint: string): string {
  const target = normalizeText(hint);
  const exact = sheetNames.find((name) => normalizeText(name) === target);
  if (exact) return exact;
  const partial = sheetNames.find((name) => normalizeText(name).includes(target));
  return partial || sheetNames[0];
}

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let idx = 0; idx < Math.min(rows.length, 16); idx += 1) {
    const row = rows[idx].map((cell) => String(cell ?? ''));
    const hasPrf = row.some((cell) => normalizeText(cell) === 'PRF NO');
    const hasPic = row.some((cell) => normalizeText(cell) === 'PIC PICKUP');
    if (hasPrf && hasPic) return idx;
  }
  return 1;
}

function findColumn(headers: string[], aliases: string[]): number | null {
  const normalizedAliases = new Set(aliases.map((alias) => normalizeText(alias)));
  for (let idx = 0; idx < headers.length; idx += 1) {
    if (normalizedAliases.has(normalizeText(headers[idx]))) {
      return idx;
    }
  }
  return null;
}

function parseExcelRows(excelPath: string): ExcelRow[] {
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel source not found: ${excelPath}`);
  }
  const workbook = XLSX.readFile(excelPath);
  const sheetName = resolveSheetName(workbook.SheetNames, 'PRF Detail');
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  const headerIndex = findHeaderRowIndex(matrix);
  const headers = (matrix[headerIndex] || []).map((value) => String(value ?? ''));
  const data = matrix.slice(headerIndex + 1);

  const prfIdx = findColumn(headers, ['PRF No', 'PRF No.', 'PRF Number', 'PR/PO No']);
  const yearIdx = findColumn(headers, ['Budget', 'Budget Year']);
  const descIdx = findColumn(headers, ['Description', 'Sum Description Requested']);
  const amountIdx = findColumn(headers, ['Amount', 'Total Amount']);
  const costIdx = findColumn(headers, ['Purchase Cost Code', 'Cost Code']);
  const picIdx = findColumn(headers, ['PIC pickup', 'PIC Pickup']);
  if (prfIdx === null || picIdx === null) {
    throw new Error('Required columns PRF No or PIC pickup were not found in Excel');
  }

  const output: ExcelRow[] = [];
  data.forEach((row) => {
    const prfNo = String(row[prfIdx] ?? '').trim();
    if (!prfNo) return;
    output.push({
      prfNo,
      budgetYear: yearIdx === null ? null : toNumber(row[yearIdx]),
      description: descIdx === null ? '' : String(row[descIdx] ?? '').trim(),
      amount: amountIdx === null ? null : toNumber(row[amountIdx]),
      costCode: costIdx === null ? null : (String(row[costIdx] ?? '').trim() || null),
      picPickup: cleanPic(String(row[picIdx] ?? '')),
    });
  });

  return output;
}

async function getCandidates(year: number | null): Promise<PRFItemCandidate[]> {
  const query = `
    SELECT
      pi.PRFItemID,
      pi.PRFID,
      p.PRFNo,
      pi.ItemName,
      pi.Description,
      pi.UnitPrice,
      pi.BudgetYear,
      pi.PurchaseCostCode,
      pi.UpdatedBy
    FROM PRFItems pi
    INNER JOIN PRF p ON p.PRFID = pi.PRFID
    WHERE pi.Status = 'Picked Up'
      AND (pi.PickedUpBy IS NULL OR LTRIM(RTRIM(pi.PickedUpBy)) = '')
      AND pi.PickedUpByUserID IS NULL
      AND (@BudgetYear IS NULL OR pi.BudgetYear = @BudgetYear)
    ORDER BY pi.PRFItemID
  `;
  const result = await executeQuery<PRFItemCandidate>(query, { BudgetYear: year });
  return result.recordset;
}

async function getUsers(): Promise<UserRow[]> {
  const query = `
    SELECT UserID, Username, FirstName, LastName, Role, IsActive
    FROM Users
    WHERE IsActive = 1
  `;
  const result = await executeQuery<UserRow>(query);
  return result.recordset;
}

function buildUserMaps(users: UserRow[]): {
  eligibleById: Map<number, UserRow>;
  eligibleByName: Map<string, UserRow>;
} {
  const eligibleById = new Map<number, UserRow>();
  const eligibleByName = new Map<string, UserRow>();
  users.forEach((user) => {
    if (user.Role !== 'admin' && user.Role !== 'doccon') return;
    eligibleById.set(user.UserID, user);
    const fullName = `${user.FirstName} ${user.LastName}`.trim();
    const nameKey = normalizeKey(fullName);
    const userKey = normalizeKey(user.Username);
    if (nameKey && !eligibleByName.has(nameKey)) {
      eligibleByName.set(nameKey, user);
    }
    if (userKey && !eligibleByName.has(userKey)) {
      eligibleByName.set(userKey, user);
    }
  });
  return { eligibleById, eligibleByName };
}

function scoreRow(item: PRFItemCandidate, row: ExcelRow): number {
  if (normalizeText(item.PRFNo) !== normalizeText(row.prfNo)) return -1;
  let score = 0;
  if (item.BudgetYear !== null && row.budgetYear !== null && item.BudgetYear === row.budgetYear) score += 4;
  if (item.UnitPrice !== null && row.amount !== null && Math.abs(item.UnitPrice - row.amount) < 0.01) score += 6;
  if (normalizeText(item.PurchaseCostCode) && normalizeText(item.PurchaseCostCode) === normalizeText(row.costCode)) score += 4;
  const itemText = `${item.ItemName} ${item.Description ?? ''}`;
  const normItem = normalizeText(itemText);
  const normDesc = normalizeText(row.description);
  if (normDesc && (normItem.includes(normDesc) || normDesc.includes(normItem))) score += 4;
  if (row.picPickup) score += 2;
  return score;
}

function selectBestExcelRow(item: PRFItemCandidate, rows: ExcelRow[]): ExcelRow | null {
  let best: ExcelRow | null = null;
  let bestScore = -1;
  rows.forEach((row) => {
    const score = scoreRow(item, row);
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  });
  return bestScore >= 8 ? best : null;
}

function resolveCandidate(
  item: PRFItemCandidate,
  excelRows: ExcelRow[],
  eligibleById: Map<number, UserRow>,
  eligibleByName: Map<string, UserRow>,
  fallbackUnknown: boolean
): Resolution {
  if (item.UpdatedBy && eligibleById.has(item.UpdatedBy)) {
    const user = eligibleById.get(item.UpdatedBy)!;
    return {
      prfItemId: item.PRFItemID,
      prfNo: item.PRFNo,
      strategy: 'updatedBy',
      pickedUpBy: `${user.FirstName} ${user.LastName}`.trim(),
      pickedUpByUserId: user.UserID,
      confidence: 'high',
      reason: 'Resolved from UpdatedBy with eligible role',
    };
  }

  const excel = selectBestExcelRow(item, excelRows);
  if (excel && excel.picPickup) {
    const key = normalizeKey(excel.picPickup);
    if (key && eligibleByName.has(key)) {
      const user = eligibleByName.get(key)!;
      return {
        prfItemId: item.PRFItemID,
        prfNo: item.PRFNo,
        strategy: 'excelPicMappedUser',
        pickedUpBy: `${user.FirstName} ${user.LastName}`.trim(),
        pickedUpByUserId: user.UserID,
        confidence: 'medium',
        reason: 'Resolved from Excel PIC mapped to active DocCon/Admin user',
      };
    }
    return {
      prfItemId: item.PRFItemID,
      prfNo: item.PRFNo,
      strategy: 'excelPicText',
      pickedUpBy: excel.picPickup,
      pickedUpByUserId: null,
      confidence: 'low',
      reason: 'Resolved from Excel PIC text only',
    };
  }

  if (fallbackUnknown) {
    return {
      prfItemId: item.PRFItemID,
      prfNo: item.PRFNo,
      strategy: 'fallbackUnknown',
      pickedUpBy: 'UNKNOWN (BACKFILL)',
      pickedUpByUserId: null,
      confidence: 'low',
      reason: 'Fallback unknown policy applied',
    };
  }

  return {
    prfItemId: item.PRFItemID,
    prfNo: item.PRFNo,
    strategy: 'unresolved',
    pickedUpBy: null,
    pickedUpByUserId: null,
    confidence: 'none',
    reason: 'No reliable source found',
  };
}

async function applyRows(rows: Resolution[]): Promise<number> {
  const actionable = rows.filter((row) => row.strategy !== 'unresolved');
  let updated = 0;
  for (const row of actionable) {
    await executeQuery(
      `
      UPDATE PRFItems
      SET PickedUpBy = @PickedUpBy,
          PickedUpByUserID = @PickedUpByUserID,
          UpdatedAt = GETDATE()
      WHERE PRFItemID = @PRFItemID
      `,
      {
        PRFItemID: row.prfItemId,
        PickedUpBy: row.pickedUpBy,
        PickedUpByUserID: row.pickedUpByUserId,
      }
    );
    updated += 1;
  }
  return updated;
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

function toCsv(rows: Resolution[]): string {
  const header = 'PRFItemID,PRFNo,Strategy,PickedUpBy,PickedUpByUserID,Confidence,Reason';
  const quote = (value: string | number | null): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = rows.map((row) => {
    return [
      quote(row.prfItemId),
      quote(row.prfNo),
      quote(row.strategy),
      quote(row.pickedUpBy),
      quote(row.pickedUpByUserId),
      quote(row.confidence),
      quote(row.reason),
    ].join(',');
  });
  return [header, ...lines].join('\n');
}

function writeReport(report: Report): { jsonPath: string; csvPath: string } {
  ensureReportDirectory();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `phase4-pic-backfill-${stamp}`;
  const jsonPath = path.join(reportDirectory(), `${base}.json`);
  const csvPath = path.join(reportDirectory(), `${base}.csv`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  fs.writeFileSync(csvPath, toCsv(report.rows), 'utf-8');
  return { jsonPath, csvPath };
}

async function main(): Promise<void> {
  const args = parseArgs();
  await connectDatabase();
  try {
    const [candidates, users] = await Promise.all([getCandidates(args.budgetYear), getUsers()]);
    const excelRows = parseExcelRows(args.excelPath);
    const { eligibleById, eligibleByName } = buildUserMaps(users);
    const rows = candidates.map((item) => resolveCandidate(item, excelRows, eligibleById, eligibleByName, args.fallbackUnknown));

    const unresolved = rows.filter((row) => row.strategy === 'unresolved').length;
    const resolvedUpdatedBy = rows.filter((row) => row.strategy === 'updatedBy').length;
    const resolvedExcelMappedUser = rows.filter((row) => row.strategy === 'excelPicMappedUser').length;
    const resolvedExcelText = rows.filter((row) => row.strategy === 'excelPicText').length;
    const resolvedFallbackUnknown = rows.filter((row) => row.strategy === 'fallbackUnknown').length;
    const updatesPlanned = rows.length - unresolved;
    const updatesApplied = args.mode === 'apply' ? await applyRows(rows) : 0;

    const report: Report = {
      generatedAt: new Date().toISOString(),
      mode: args.mode,
      budgetYear: args.budgetYear,
      excelPath: args.excelPath,
      totals: {
        candidates: rows.length,
        resolvedUpdatedBy,
        resolvedExcelMappedUser,
        resolvedExcelText,
        resolvedFallbackUnknown,
        unresolved,
        updatesPlanned,
        updatesApplied,
      },
      rows,
    };

    const output = writeReport(report);
    console.log(`Mode: ${args.mode}`);
    console.log(`Candidates: ${report.totals.candidates}`);
    console.log(`Resolved UpdatedBy: ${report.totals.resolvedUpdatedBy}`);
    console.log(`Resolved Excel mapped user: ${report.totals.resolvedExcelMappedUser}`);
    console.log(`Resolved Excel text: ${report.totals.resolvedExcelText}`);
    console.log(`Resolved fallback unknown: ${report.totals.resolvedFallbackUnknown}`);
    console.log(`Unresolved: ${report.totals.unresolved}`);
    console.log(`Updates planned: ${report.totals.updatesPlanned}`);
    console.log(`Updates applied: ${report.totals.updatesApplied}`);
    console.log(`Report JSON: ${output.jsonPath}`);
    console.log(`Report CSV: ${output.csvPath}`);
  } catch (error) {
    console.error('PIC backfill failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

main();
