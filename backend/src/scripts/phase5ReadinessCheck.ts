import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { connectDatabase, closeDatabase, executeQuery } from '../config/database';

dotenv.config();

interface Args {
  fiscalYear: number;
}

interface CountRow {
  Total: number;
}

interface RoleCountRow {
  Role: string;
  Total: number;
}

interface ObjectExistsRow {
  ExistsFlag: number;
}

interface SourceCheck {
  name: string;
  passed: boolean;
  details: string;
}

interface DataCheck {
  name: string;
  passed: boolean;
  value: number;
  details: string;
}

interface ReadinessReport {
  generatedAt: string;
  fiscalYear: number;
  status: 'ready' | 'needs_action';
  sourceChecks: SourceCheck[];
  dataChecks: DataCheck[];
  roleCounts: {
    admin: number;
    doccon: number;
    user: number;
  };
}

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const yearArg = raw.find((arg) => arg.startsWith('--year='));
  const parsedYear = yearArg ? Number(yearArg.slice('--year='.length)) : 2026;
  return {
    fiscalYear: Number.isFinite(parsedYear) ? parsedYear : 2026,
  };
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

function readFileSafe(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
}

function checkSourceCode(): SourceCheck[] {
  const budgetRoutesPath = path.resolve(__dirname, '../routes/budgetRoutes.ts');
  const prfRoutesPath = path.resolve(__dirname, '../routes/prfRoutes.ts');
  const budgetContent = readFileSafe(budgetRoutesPath);
  const prfContent = readFileSafe(prfRoutesPath);

  const checks: SourceCheck[] = [
    {
      name: 'budget_cutoff_endpoints',
      passed:
        budgetContent.includes("router.get('/cutoff/:fiscalYear'") &&
        budgetContent.includes("router.post('/cutoff/:fiscalYear/close'") &&
        budgetContent.includes("router.post('/cutoff/:fiscalYear/reopen'"),
      details: 'Budget cutoff get/close/reopen endpoints',
    },
    {
      name: 'budget_write_role_guard',
      passed:
        budgetContent.includes("router.post('/', authenticateToken, requireContentManager") &&
        budgetContent.includes("router.put('/:id', authenticateToken, requireContentManager") &&
        budgetContent.includes("router.delete('/:id', authenticateToken, requireContentManager"),
      details: 'Budget write endpoints guarded by content manager middleware',
    },
    {
      name: 'pic_mandatory_logic',
      passed:
        prfContent.includes('Picked Up status requires Picking PIC') &&
        prfContent.includes('Picked Up status requires PickedUpDate') &&
        prfContent.includes('Picking PIC must be a DocCon or Admin user'),
      details: 'PRF item picked-up validation and role restriction rules',
    },
  ];

  return checks;
}

async function countQuery(query: string, params?: { [key: string]: unknown }): Promise<number> {
  const result = await executeQuery<CountRow>(query, params);
  return result.recordset[0]?.Total ?? 0;
}

async function getRoleCounts(): Promise<{ admin: number; doccon: number; user: number }> {
  const result = await executeQuery<RoleCountRow>(`
    SELECT Role, COUNT(*) AS Total
    FROM Users
    WHERE IsActive = 1
    GROUP BY Role
  `);
  const counts = { admin: 0, doccon: 0, user: 0 };
  result.recordset.forEach((row) => {
    const role = row.Role?.toLowerCase();
    if (role === 'admin') counts.admin = row.Total;
    if (role === 'doccon') counts.doccon = row.Total;
    if (role === 'user') counts.user = row.Total;
  });
  return counts;
}

async function existsObject(name: string, type: 'U' | 'V'): Promise<number> {
  const result = await executeQuery<ObjectExistsRow>(
    `
    SELECT CASE WHEN OBJECT_ID(@ObjectName, @ObjectType) IS NULL THEN 0 ELSE 1 END AS ExistsFlag
  `,
    { ObjectName: name, ObjectType: type }
  );
  return result.recordset[0]?.ExistsFlag ?? 0;
}

async function checkDataIntegrity(fiscalYear: number): Promise<DataCheck[]> {
  const missingPic = await countQuery(`
    SELECT COUNT(*) AS Total
    FROM PRFItems
    WHERE Status = 'Picked Up'
      AND (PickedUpBy IS NULL OR LTRIM(RTRIM(PickedUpBy)) = '')
      AND PickedUpByUserID IS NULL
  `);

  const missingDate = await countQuery(`
    SELECT COUNT(*) AS Total
    FROM PRFItems
    WHERE Status = 'Picked Up'
      AND PickedUpDate IS NULL
  `);

  const invalidUserRole = await countQuery(`
    SELECT COUNT(*) AS Total
    FROM PRFItems pi
    INNER JOIN Users u ON u.UserID = pi.PickedUpByUserID
    WHERE pi.PickedUpByUserID IS NOT NULL
      AND (u.IsActive = 0 OR u.Role NOT IN ('admin', 'doccon'))
  `);

  const cutoffMissingYear = await countQuery(
    `
    SELECT COUNT(*) AS Total
    FROM BudgetCutoff
    WHERE FiscalYear = @FiscalYear
  `,
    { FiscalYear: fiscalYear }
  );

  const cutoffTableExists = await existsObject('dbo.BudgetCutoff', 'U');
  const cutoffAuditTableExists = await existsObject('dbo.BudgetCutoffAudit', 'U');

  return [
    {
      name: 'budget_cutoff_table_exists',
      passed: cutoffTableExists === 1,
      value: cutoffTableExists,
      details: 'BudgetCutoff table exists',
    },
    {
      name: 'budget_cutoff_audit_table_exists',
      passed: cutoffAuditTableExists === 1,
      value: cutoffAuditTableExists,
      details: 'BudgetCutoffAudit table exists',
    },
    {
      name: 'picked_up_missing_pic_count',
      passed: missingPic === 0,
      value: missingPic,
      details: 'Picked Up items without PIC should be zero',
    },
    {
      name: 'picked_up_missing_date_count',
      passed: missingDate === 0,
      value: missingDate,
      details: 'Picked Up items without PickedUpDate should be zero',
    },
    {
      name: 'picked_up_invalid_pic_user_role_count',
      passed: invalidUserRole === 0,
      value: invalidUserRole,
      details: 'PickedUpByUserID must reference active DocCon/Admin',
    },
    {
      name: 'fiscal_year_cutoff_row_exists',
      passed: cutoffMissingYear > 0,
      value: cutoffMissingYear,
      details: `BudgetCutoff row exists for FY${fiscalYear}`,
    },
  ];
}

function writeReport(report: ReadinessReport): string {
  ensureReportDirectory();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(reportDirectory(), `phase5-readiness-${stamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  return outputPath;
}

async function main(): Promise<void> {
  const args = parseArgs();
  await connectDatabase();
  try {
    const sourceChecks = checkSourceCode();
    const dataChecks = await checkDataIntegrity(args.fiscalYear);
    const roleCounts = await getRoleCounts();
    const allPassed = [...sourceChecks, ...dataChecks].every((check) => check.passed);
    const report: ReadinessReport = {
      generatedAt: new Date().toISOString(),
      fiscalYear: args.fiscalYear,
      status: allPassed ? 'ready' : 'needs_action',
      sourceChecks,
      dataChecks,
      roleCounts,
    };
    const reportPath = writeReport(report);
    console.log(`Phase 5 status: ${report.status}`);
    console.log(`Role counts => admin: ${roleCounts.admin}, doccon: ${roleCounts.doccon}, user: ${roleCounts.user}`);
    dataChecks.forEach((check) => {
      const mark = check.passed ? 'PASS' : 'FAIL';
      console.log(`${mark} ${check.name}: ${check.value}`);
    });
    sourceChecks.forEach((check) => {
      const mark = check.passed ? 'PASS' : 'FAIL';
      console.log(`${mark} ${check.name}`);
    });
    console.log(`Report: ${reportPath}`);
  } catch (error) {
    console.error('Phase 5 readiness check failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

main();
