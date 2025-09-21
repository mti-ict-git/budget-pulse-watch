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

// COA codes for 2024 budget
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

// COA codes for 2025 budget
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

async function analyzeBudgetYears() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    console.log('=== BUDGET YEAR ANALYSIS ===\n');

    // Analyze 2024 budget codes
    console.log('2024 Budget COA Codes Analysis:');
    console.log('Expected Year: 2024');
    console.log('Number of COA codes:', budget2024Codes.length);
    console.log('COA codes:', budget2024Codes.join(', '));
    console.log('');

    for (const coaCode of budget2024Codes) {
      const query = `
        SELECT 
          b.BudgetID,
          b.COAID,
          coa.COACode,
          coa.COAName,
          b.FiscalYear,
          b.AllocatedAmount,
          b.UtilizedAmount
        FROM Budget b
        INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
        WHERE coa.COACode = @coaCode
        ORDER BY b.FiscalYear DESC
      `;

      const request = new sql.Request();
      request.input('coaCode', sql.VarChar, coaCode);
      const result = await request.query(query);

      if (result.recordset.length > 0) {
        console.log(`COA: ${coaCode}`);
        result.recordset.forEach(row => {
          console.log(`  BudgetID: ${row.BudgetID}, COAID: ${row.COAID}, FiscalYear: ${row.FiscalYear}, Amount: ${row.AllocatedAmount}`);
        });
      } else {
        console.log(`COA: ${coaCode} - NO BUDGET FOUND`);
      }
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Analyze 2025 budget codes
    console.log('2025 Budget COA Codes Analysis:');
    console.log('Expected Year: 2025');
    console.log('Number of COA codes:', budget2025Codes.length);
    console.log('COA codes:', budget2025Codes.slice(0, 10).join(', '), '... (showing first 10)');
    console.log('');

    let found2025 = 0;
    let notFound2025 = 0;
    let wrongYear2025 = 0;

    for (const coaCode of budget2025Codes) {
      const query = `
        SELECT 
          b.BudgetID,
          b.COAID,
          coa.COACode,
          coa.COAName,
          b.FiscalYear,
          b.AllocatedAmount,
          b.UtilizedAmount
        FROM Budget b
        INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
        WHERE coa.COACode = @coaCode
        ORDER BY b.FiscalYear DESC
      `;

      const request = new sql.Request();
      request.input('coaCode', sql.VarChar, coaCode);
      const result = await request.query(query);

      if (result.recordset.length > 0) {
        found2025++;
        const hasCorrectYear = result.recordset.some(row => row.FiscalYear === 2025);
        const hasWrongYear = result.recordset.some(row => row.FiscalYear !== 2025);
        
        if (hasWrongYear && !hasCorrectYear) {
          wrongYear2025++;
          console.log(`COA: ${coaCode} - WRONG YEAR`);
          result.recordset.forEach(row => {
            console.log(`  BudgetID: ${row.BudgetID}, FiscalYear: ${row.FiscalYear} (should be 2025), Amount: ${row.AllocatedAmount}`);
          });
        } else if (hasCorrectYear) {
          console.log(`COA: ${coaCode} - CORRECT YEAR (2025)`);
        }
      } else {
        notFound2025++;
        console.log(`COA: ${coaCode} - NO BUDGET FOUND`);
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`2024 Budget Codes: ${budget2024Codes.length} total`);
    console.log(`2025 Budget Codes: ${budget2025Codes.length} total`);
    console.log(`  - Found with budgets: ${found2025}`);
    console.log(`  - Not found: ${notFound2025}`);
    console.log(`  - Wrong fiscal year: ${wrongYear2025}`);

    await sql.close();
  } catch (error) {
    console.error('Error:', error.message);
    await sql.close();
  }
}

analyzeBudgetYears();