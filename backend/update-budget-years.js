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

// COA codes that should have 2024 fiscal year
const budget2024Codes = [
  'AMITINO1.6250',
  'AMPLME05.6250',
  'MTIRMRAD496014',
  'MTIRMRAD496232',
  'MTIRMRAD496250',
  'MTIRMRAD496313',
  'MTIRMRAD496314',
  'MTIRMRAD4963265',
  'MTIRMRAD496328',
  'MTIRMRAD496769',
  'MTIRMRHR606014'
];

// COA codes that should have 2025 fiscal year
const budget2025Codes = [
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
  'MTIRMRAD496014',
  'MTIRMRAD496109',
  'MTIRMRAD496137',
  'MTIRMRAD496232',
  'MTIRMRAD496250',
  'MTIRMRAD496313',
  'MTIRMRAD496314',
  'MTIRMRAD496326',
  'MTIRMRAD496328',
  'MTIRMRAD496769',
  'MTIRMRADA496328',
  'MTIRMRHR606014',
  'MTIRMRHS446250',
  'MTIRMRHS446279',
  'MTIRMRHS606250',
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

async function updateBudgetYears() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    console.log('=== BUDGET YEAR UPDATE PROCESS ===\n');

    // Step 1: Update budgets that should be 2024 but are currently 2025
    console.log('Step 1: Updating budgets to 2024 fiscal year...');
    let updated2024 = 0;

    for (const coaCode of budget2024Codes) {
      // Find budgets with wrong fiscal year (2025 instead of 2024)
      const findQuery = `
        SELECT b.BudgetID, b.COAID, coa.COACode, b.FiscalYear, b.AllocatedAmount
        FROM Budget b
        INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
        WHERE coa.COACode = @coaCode AND b.FiscalYear = 2025
      `;

      const findRequest = new sql.Request();
      findRequest.input('coaCode', sql.VarChar, coaCode);
      const findResult = await findRequest.query(findQuery);

      if (findResult.recordset.length > 0) {
        for (const budget of findResult.recordset) {
          // Check if there's already a 2024 budget for this COA
          const checkQuery = `
            SELECT COUNT(*) as count
            FROM Budget b
            INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
            WHERE coa.COACode = @coaCode AND b.FiscalYear = 2024
          `;

          const checkRequest = new sql.Request();
          checkRequest.input('coaCode', sql.VarChar, coaCode);
          const checkResult = await checkRequest.query(checkQuery);

          if (checkResult.recordset[0].count === 0) {
            // No 2024 budget exists, safe to update
            const updateQuery = `
              UPDATE Budget 
              SET FiscalYear = 2024 
              WHERE BudgetID = @budgetId
            `;

            const updateRequest = new sql.Request();
            updateRequest.input('budgetId', sql.Int, budget.BudgetID);
            await updateRequest.query(updateQuery);

            console.log(`  ✅ Updated BudgetID ${budget.BudgetID} (${coaCode}) from 2025 to 2024`);
            updated2024++;
          } else {
            console.log(`  ⚠️  Skipped ${coaCode} - already has 2024 budget, manual review needed`);
          }
        }
      }
    }

    console.log(`\nStep 1 Complete: Updated ${updated2024} budgets to 2024\n`);

    // Step 2: Update budgets that should be 2025 but are currently 2024
    console.log('Step 2: Updating budgets to 2025 fiscal year...');
    let updated2025 = 0;

    for (const coaCode of budget2025Codes) {
      // Find budgets with wrong fiscal year (2024 instead of 2025)
      const findQuery = `
        SELECT b.BudgetID, b.COAID, coa.COACode, b.FiscalYear, b.AllocatedAmount
        FROM Budget b
        INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
        WHERE coa.COACode = @coaCode AND b.FiscalYear = 2024
      `;

      const findRequest = new sql.Request();
      findRequest.input('coaCode', sql.VarChar, coaCode);
      const findResult = await findRequest.query(findQuery);

      if (findResult.recordset.length > 0) {
        for (const budget of findResult.recordset) {
          // Check if there's already a 2025 budget for this COA
          const checkQuery = `
            SELECT COUNT(*) as count
            FROM Budget b
            INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
            WHERE coa.COACode = @coaCode AND b.FiscalYear = 2025
          `;

          const checkRequest = new sql.Request();
          checkRequest.input('coaCode', sql.VarChar, coaCode);
          const checkResult = await checkRequest.query(checkQuery);

          if (checkResult.recordset[0].count === 0) {
            // No 2025 budget exists, safe to update
            const updateQuery = `
              UPDATE Budget 
              SET FiscalYear = 2025 
              WHERE BudgetID = @budgetId
            `;

            const updateRequest = new sql.Request();
            updateRequest.input('budgetId', sql.Int, budget.BudgetID);
            await updateRequest.query(updateQuery);

            console.log(`  ✅ Updated BudgetID ${budget.BudgetID} (${coaCode}) from 2024 to 2025`);
            updated2025++;
          } else {
            console.log(`  ⚠️  Skipped ${coaCode} - already has 2025 budget, manual review needed`);
          }
        }
      }
    }

    console.log(`\nStep 2 Complete: Updated ${updated2025} budgets to 2025\n`);

    console.log('=== UPDATE SUMMARY ===');
    console.log(`Total budgets updated to 2024: ${updated2024}`);
    console.log(`Total budgets updated to 2025: ${updated2025}`);
    console.log(`Total updates: ${updated2024 + updated2025}`);

    await sql.close();
  } catch (error) {
    console.error('Error:', error.message);
    await sql.close();
  }
}

// Add confirmation prompt
console.log('This script will update budget fiscal years based on the provided COA code lists.');
console.log('2024 Budget COA Codes:', budget2024Codes.length, 'codes');
console.log('2025 Budget COA Codes:', budget2025Codes.length, 'codes');
console.log('\nStarting update process...\n');

updateBudgetYears();