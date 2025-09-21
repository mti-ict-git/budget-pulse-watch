const sql = require('mssql');

const config = {
  server: '10.60.10.47',
  database: 'PRFMonitoringDB',
  user: 'sa',
  password: 'Bl4ck3y34dmin',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 30000,
  },
};

// COA codes that appear in BOTH 2024 and 2025 lists (should have both fiscal years)
const overlappingCodes = [
  'MTIRMRAD496014',
  'MTIRMRAD496232', 
  'MTIRMRAD496250',
  'MTIRMRAD496313',
  'MTIRMRAD496314',
  'MTIRMRAD496328',
  'MTIRMRAD496769',
  'MTIRMRHR606014'
];

// COA codes that should ONLY be in 2024
const only2024Codes = [
  'AMITINO1.6250',
  'AMPLME05.6250',
  'MTIRMRAD4963265'
];

// COA codes that should ONLY be in 2025 (excluding overlapping ones)
const only2025Codes = [
  'MTIRMRAD416769',
  'MTIRMRHS606250',
  '51211325.6250',
  'AMITBD01',
  'AMITCM14.6718',
  'AMITCM16',
  'AMITCM16.6250',
  'AMITCM18.6250',
  'AMITCM19.6250',
  'AMITCM20.6250',
  'AMITCM21',
  'AMITCM21.6250',
  'AMITCM22.6250',
  'AMITCM23',
  'AMPLCM01.6250',
  'MTIRMRAD416250',
  'MTIRMRAD426249',
  'MTIRMRAD496109',
  'MTIRMRAD496137',
  'MTIRMRAD496326',
  'MTIRMRADA496328',
  'MTIRMRHS446250',
  'MTIRMRHS446279',
  'MTIRMRHS606279',
  'MTIRMRMT236137',
  'MTIRMRMT26',
  'MTIRMRMT26.6137',
  'MTIRMRMT266014',
  'MTIRMRMT266137',
  'MTIRMRMT266733',
  'MTIRMRMT266769',
  'MTIRMRPR226250',
  'MTIRMRPRA06250',
  'MTIRMRPRC06250',
  'MTIRMRPRD06769',
  'MTIRMRTS606250',
  'W0171197.6769'
];

async function fixOverlappingBudgets() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    console.log('=== FIXING OVERLAPPING BUDGET YEARS ===\n');

    // Step 1: Create 2024 budgets for overlapping codes that currently only have 2025
    console.log('Step 1: Creating missing 2024 budgets for overlapping codes...');
    let created2024 = 0;

    for (const coaCode of overlappingCodes) {
      // Check if 2024 budget exists
      const check2024Query = `
        SELECT COUNT(*) as count
        FROM Budget b
        INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
        WHERE coa.COACode = @coaCode AND b.FiscalYear = 2024
      `;

      const check2024Request = new sql.Request();
      check2024Request.input('coaCode', sql.VarChar, coaCode);
      const check2024Result = await check2024Request.query(check2024Query);

      if (check2024Result.recordset[0].count === 0) {
        // Get the 2025 budget to copy structure
        const get2025Query = `
          SELECT b.COAID, b.AllocatedAmount, b.Department, b.Status, b.BudgetType, b.ExpenseType, b.CreatedBy
          FROM Budget b
          INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
          WHERE coa.COACode = @coaCode AND b.FiscalYear = 2025
        `;

        const get2025Request = new sql.Request();
        get2025Request.input('coaCode', sql.VarChar, coaCode);
        const get2025Result = await get2025Request.query(get2025Query);

        if (get2025Result.recordset.length > 0) {
          const budget2025 = get2025Result.recordset[0];

          // Create 2024 budget
          const create2024Query = `
            INSERT INTO Budget (COAID, FiscalYear, AllocatedAmount, Department, Status, BudgetType, ExpenseType, CreatedBy, CreatedAt, UpdatedAt)
            VALUES (@coaid, 2024, @allocatedAmount, @department, @status, @budgetType, @expenseType, @createdBy, GETDATE(), GETDATE())
          `;

          const create2024Request = new sql.Request();
          create2024Request.input('coaid', sql.Int, budget2025.COAID);
          create2024Request.input('allocatedAmount', sql.Decimal(18, 2), budget2025.AllocatedAmount);
          create2024Request.input('department', sql.NVarChar, budget2025.Department);
          create2024Request.input('status', sql.NVarChar, budget2025.Status);
          create2024Request.input('budgetType', sql.NVarChar, budget2025.BudgetType);
          create2024Request.input('expenseType', sql.NVarChar, budget2025.ExpenseType);
          create2024Request.input('createdBy', sql.Int, budget2025.CreatedBy);
          
          await create2024Request.query(create2024Query);
          console.log(`  ✅ Created 2024 budget for ${coaCode}`);
          created2024++;
        }
      } else {
        console.log(`  ℹ️  ${coaCode} already has 2024 budget`);
      }
    }

    console.log(`\nStep 1 Complete: Created ${created2024} new 2024 budgets\n`);

    console.log('=== FINAL VERIFICATION ===\n');

    // Verify overlapping codes have both years
    console.log('Overlapping codes (should have both 2024 and 2025):');
    for (const coaCode of overlappingCodes) {
      const verifyQuery = `
        SELECT b.FiscalYear, COUNT(*) as count
        FROM Budget b
        INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
        WHERE coa.COACode = @coaCode
        GROUP BY b.FiscalYear
        ORDER BY b.FiscalYear
      `;

      const verifyRequest = new sql.Request();
      verifyRequest.input('coaCode', sql.VarChar, coaCode);
      const verifyResult = await verifyRequest.query(verifyQuery);

      const years = verifyResult.recordset.map(r => r.FiscalYear);
      const has2024 = years.includes(2024);
      const has2025 = years.includes(2025);

      if (has2024 && has2025) {
        console.log(`  ✅ ${coaCode} - Has both 2024 and 2025`);
      } else if (has2024 && !has2025) {
        console.log(`  ⚠️  ${coaCode} - Only has 2024`);
      } else if (!has2024 && has2025) {
        console.log(`  ⚠️  ${coaCode} - Only has 2025`);
      } else {
        console.log(`  ❌ ${coaCode} - Not found`);
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Created ${created2024} new 2024 budgets for overlapping codes`);
    console.log('All overlapping codes should now have both 2024 and 2025 budgets');

    await sql.close();
  } catch (error) {
    console.error('Error:', error.message);
    await sql.close();
  }
}

console.log('This script will create missing 2024 budgets for codes that should exist in both years.');
console.log('Overlapping codes:', overlappingCodes.length, 'codes');
console.log('\nStarting fix process...\n');

fixOverlappingBudgets();