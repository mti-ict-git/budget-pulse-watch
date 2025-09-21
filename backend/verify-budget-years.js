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

// Expected 2024 and 2025 COA codes
const budget2024Codes = [
  'AMITINO1.6250', 'AMPLME05.6250', 'MTIRMRAD496014', 'MTIRMRAD496232',
  'MTIRMRAD496250', 'MTIRMRAD496313', 'MTIRMRAD496314', 'MTIRMRAD4963265',
  'MTIRMRAD496328', 'MTIRMRAD496769', 'MTIRMRHR606014'
];

const budget2025Codes = [
  'MTIRMRAD416769', 'MTIRMRHS606250', '51211325.6250', 'AMITBD01',
  'AMITCM14.6718', 'AMITCM16', 'AMITCM16.6250', 'AMITCM18.6250',
  'AMITCM19.6250', 'AMITCM20.6250', 'AMITCM21', 'AMITCM21.6250',
  'AMITCM22.6250', 'AMITCM23', 'AMPLCM01.6250', 'MTIRMRAD416250',
  'MTIRMRAD426249', 'MTIRMRAD496014', 'MTIRMRAD496109', 'MTIRMRAD496137',
  'MTIRMRAD496232', 'MTIRMRAD496250', 'MTIRMRAD496313', 'MTIRMRAD496314',
  'MTIRMRAD496326', 'MTIRMRAD496328', 'MTIRMRAD496769', 'MTIRMRADA496328',
  'MTIRMRHR606014', 'MTIRMRHS446250', 'MTIRMRHS446279', 'MTIRMRHS606250',
  'MTIRMRHS606279', 'MTIRMRMT236137', 'MTIRMRMT26', 'MTIRMRMT26.6137',
  'MTIRMRMT266014', 'MTIRMRMT266137', 'MTIRMRMT266733', 'MTIRMRMT266769',
  'MTIRMRPR226250', 'MTIRMRPRA06250', 'MTIRMRPRC06250', 'MTIRMRPRD06769',
  'MTIRMRTS606250', 'W0171197.6769'
];

async function verifyBudgetYears() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    console.log('=== BUDGET YEAR VERIFICATION ===\n');

    // Verify 2024 budgets
    console.log('Verifying 2024 Budget COA Codes:');
    let correct2024 = 0;
    let wrong2024 = 0;

    for (const coaCode of budget2024Codes) {
      const query = `
        SELECT b.BudgetID, b.COAID, coa.COACode, b.FiscalYear, b.AllocatedAmount
        FROM Budget b
        INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
        WHERE coa.COACode = @coaCode
        ORDER BY b.FiscalYear
      `;

      const request = new sql.Request();
      request.input('coaCode', sql.VarChar, coaCode);
      const result = await request.query(query);

      if (result.recordset.length > 0) {
        const fiscalYears = result.recordset.map(r => r.FiscalYear);
        const has2024 = fiscalYears.includes(2024);
        const has2025 = fiscalYears.includes(2025);

        if (has2024 && !has2025) {
          console.log(`  ✅ ${coaCode} - Correct (2024 only)`);
          correct2024++;
        } else if (has2024 && has2025) {
          console.log(`  ⚠️  ${coaCode} - Has both 2024 and 2025 budgets`);
          wrong2024++;
        } else if (!has2024 && has2025) {
          console.log(`  ❌ ${coaCode} - Wrong (2025 only, should be 2024)`);
          wrong2024++;
        }
      } else {
        console.log(`  ❓ ${coaCode} - Not found`);
      }
    }

    console.log(`\n2024 Summary: ${correct2024} correct, ${wrong2024} need attention\n`);

    // Verify 2025 budgets
    console.log('Verifying 2025 Budget COA Codes:');
    let correct2025 = 0;
    let wrong2025 = 0;

    for (const coaCode of budget2025Codes) {
      const query = `
        SELECT b.BudgetID, b.COAID, coa.COACode, b.FiscalYear, b.AllocatedAmount
        FROM Budget b
        INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
        WHERE coa.COACode = @coaCode
        ORDER BY b.FiscalYear
      `;

      const request = new sql.Request();
      request.input('coaCode', sql.VarChar, coaCode);
      const result = await request.query(query);

      if (result.recordset.length > 0) {
        const fiscalYears = result.recordset.map(r => r.FiscalYear);
        const has2024 = fiscalYears.includes(2024);
        const has2025 = fiscalYears.includes(2025);

        if (has2025 && !has2024) {
          console.log(`  ✅ ${coaCode} - Correct (2025 only)`);
          correct2025++;
        } else if (has2024 && has2025) {
          console.log(`  ⚠️  ${coaCode} - Has both 2024 and 2025 budgets`);
          wrong2025++;
        } else if (has2024 && !has2025) {
          console.log(`  ❌ ${coaCode} - Wrong (2024 only, should be 2025)`);
          wrong2025++;
        }
      } else {
        console.log(`  ❓ ${coaCode} - Not found`);
      }
    }

    console.log(`\n2025 Summary: ${correct2025} correct, ${wrong2025} need attention\n`);

    console.log('=== OVERALL VERIFICATION SUMMARY ===');
    console.log(`2024 Budget Codes: ${correct2024}/${budget2024Codes.length} correct`);
    console.log(`2025 Budget Codes: ${correct2025}/${budget2025Codes.length} correct`);
    console.log(`Total Success Rate: ${((correct2024 + correct2025) / (budget2024Codes.length + budget2025Codes.length) * 100).toFixed(1)}%`);

    await sql.close();
  } catch (error) {
    console.error('Error:', error.message);
    await sql.close();
  }
}

verifyBudgetYears();