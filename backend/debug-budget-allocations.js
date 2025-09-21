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

async function debugBudgetAllocations() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    // Check BudgetAllocations CTE for COAID 23
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
        WHERE b.COAID = 23
        GROUP BY b.COAID, b.FiscalYear, coa.COACode, coa.COAName, coa.Department, coa.ExpenseType
      )
      SELECT * FROM BudgetAllocations;
    `;

    const result = await sql.query(query);
    
    console.log('BudgetAllocations for COAID 23:');
    console.log('Number of records:', result.recordset.length);
    
    result.recordset.forEach((row, index) => {
      console.log(`${index + 1}. COAID: ${row.COAID}`);
      console.log(`   FiscalYear: ${row.FiscalYear}`);
      console.log(`   COACode: ${row.COACode}`);
      console.log(`   COAName: ${row.COAName}`);
      console.log(`   Department: ${row.Department}`);
      console.log(`   ExpenseType: ${row.ExpenseType}`);
      console.log(`   TotalAllocated: ${row.TotalAllocated}`);
      console.log(`   TotalUtilized: ${row.TotalUtilized}`);
      console.log('');
    });

    // Check if MTIRMRPRC06250 exists in PRF table
    const prfQuery = `
      SELECT DISTINCT p.PurchaseCostCode 
      FROM dbo.PRF p 
      WHERE p.PurchaseCostCode = 'MTIRMRPRC06250'
        AND p.PurchaseCostCode IS NOT NULL 
        AND p.PurchaseCostCode != ''
    `;

    const prfResult = await sql.query(prfQuery);
    console.log('MTIRMRPRC06250 in PRF table:', prfResult.recordset.length > 0 ? 'YES' : 'NO');

    await sql.close();
  } catch (error) {
    console.error('Error:', error.message);
    await sql.close();
  }
}

debugBudgetAllocations();