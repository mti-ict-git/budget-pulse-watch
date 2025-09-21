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

async function debugUnionQuery() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    // Test the UNION part specifically for AMPLME05.6250
    const query = `
      WITH BudgetAllocations AS (
        -- Get actual budget allocations by COA and fiscal year
        SELECT 
          b.COAID,
          b.FiscalYear,
          coa.COACode,
          coa.COAName,
          coa.Department,
          coa.ExpenseType,
          SUM(b.AllocatedAmount) as TotalAllocated,
          SUM(b.UtilizedAmount) as TotalUtilized
        FROM Budget b
        INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
        GROUP BY b.COAID, b.FiscalYear, coa.COACode, coa.COAName, coa.Department, coa.ExpenseType
      )
      -- Include budgets without cost code mappings
      SELECT 
        'NO_COST_CODE_' + ba.COACode as PurchaseCostCode,
        ba.COAID,
        ba.COACode,
        ba.COAName,
        ba.Department,
        ba.ExpenseType,
        SUM(ba.TotalAllocated) as GrandTotalAllocated,
        0 as GrandTotalRequested,
        0 as GrandTotalApproved,
        0 as GrandTotalActual,
        0 as TotalRequests,
        COUNT(DISTINCT ba.FiscalYear) as YearsActive,
        MIN(ba.FiscalYear) as FirstYear,
        MAX(ba.FiscalYear) as LastYear
      FROM BudgetAllocations ba
      WHERE ba.COACode NOT IN (
        SELECT DISTINCT p.PurchaseCostCode 
        FROM dbo.PRF p 
        WHERE p.PurchaseCostCode IS NOT NULL AND p.PurchaseCostCode != ''
      )
      AND ba.COACode = 'AMPLME05.6250'
      GROUP BY ba.COAID, ba.COACode, ba.COAName, ba.Department, ba.ExpenseType
    `;

    const result = await sql.query(query);
    
    console.log('UNION query results for AMPLME05.6250:');
    console.log('Number of records:', result.recordset.length);
    
    result.recordset.forEach((row, index) => {
      console.log(`${index + 1}. PurchaseCostCode: ${row.PurchaseCostCode}`);
      console.log(`   COAID: ${row.COAID}`);
      console.log(`   COACode: ${row.COACode}`);
      console.log(`   COAName: ${row.COAName}`);
      console.log(`   GrandTotalAllocated: ${row.GrandTotalAllocated}`);
      console.log(`   YearsActive: ${row.YearsActive}`);
      console.log('');
    });

    // Check if AMPLME05.6250 exists in PRF table
    const prfQuery = `
      SELECT DISTINCT p.PurchaseCostCode 
      FROM dbo.PRF p 
      WHERE p.PurchaseCostCode = 'AMPLME05.6250'
        AND p.PurchaseCostCode IS NOT NULL 
        AND p.PurchaseCostCode != ''
    `;

    const prfResult = await sql.query(prfQuery);
    console.log('AMPLME05.6250 in PRF table:', prfResult.recordset.length > 0 ? 'YES' : 'NO');
    
    if (prfResult.recordset.length > 0) {
      console.log('This explains why it\'s NOT in the NO_COST_CODE results - it has cost code mappings!');
    } else {
      console.log('This should appear in NO_COST_CODE results since it has no cost code mappings.');
    }

    await sql.close();
  } catch (error) {
    console.error('Error:', error.message);
    await sql.close();
  }
}

debugUnionQuery();