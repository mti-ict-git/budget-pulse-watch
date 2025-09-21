const sql = require('mssql');

const config = {
  server: '10.60.10.47',
  database: 'PRFMonitoringDB',
  user: 'sa',
  password: 'Bl4ck3y34dmin',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function checkCostCodeMapping() {
  try {
    await sql.connect(config);
    console.log('Connected to database');

    // 1. Check if COAID 23 exists in ChartOfAccounts
    console.log('\n=== 1. Checking COAID 23 in ChartOfAccounts ===');
    const coaResult = await sql.query`
      SELECT COAID, COACode, COAName, Category, Description
      FROM ChartOfAccounts 
      WHERE COAID = 23
    `;
    console.log('COA Record:', coaResult.recordset[0] || 'Not found');

    // 2. Check if there's a cost code mapping for COAID 23
    console.log('\n=== 2. Checking Cost Code Mapping ===');
    const costCodeResult = await sql.query`
      SELECT DISTINCT 
        coa.COAID,
        coa.COACode,
        coa.COAName,
        prf.PurchaseCostCode
      FROM ChartOfAccounts coa
      LEFT JOIN PRF prf ON coa.COAID = prf.COAID
      WHERE coa.COAID = 23
    `;
    console.log('Cost Code Mapping:', costCodeResult.recordset);

    // 3. Check what cost codes exist for similar COAs
    console.log('\n=== 3. Checking Similar COA Cost Codes ===');
    const similarResult = await sql.query`
      SELECT TOP 10
        coa.COAID,
        coa.COACode,
        coa.COAName,
        COUNT(DISTINCT prf.PurchaseCostCode) as CostCodeCount
      FROM ChartOfAccounts coa
      LEFT JOIN PRF prf ON coa.COAID = prf.COAID
      WHERE coa.COACode LIKE 'AMPLME%'
      GROUP BY coa.COAID, coa.COACode, coa.COAName
      ORDER BY coa.COAID
    `;
    console.log('Similar COAs with Cost Codes:');
    similarResult.recordset.forEach(row => {
      console.log(`  COAID ${row.COAID} (${row.COACode}): ${row.CostCodeCount} cost codes`);
    });

    // 4. Check the cost code budget view logic
    console.log('\n=== 4. Checking Cost Code Budget Logic ===');
    const costCodeBudgetResult = await sql.query`
      SELECT 
        prf.PurchaseCostCode,
        coa.COACode,
        coa.COAName,
        COUNT(DISTINCT b.BudgetID) as BudgetCount,
        SUM(b.AllocatedAmount) as TotalAllocated
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN PRF prf ON coa.COAID = prf.COAID
      WHERE b.FiscalYear = 2025 AND coa.COAID = 23
      GROUP BY prf.PurchaseCostCode, coa.COACode, coa.COAName
    `;
    console.log('Cost Code Budget for COAID 23:', costCodeBudgetResult.recordset);

    // 5. Check if the budget appears in vw_CostCodeBudgets
    console.log('\n=== 5. Checking vw_CostCodeBudgets View ===');
    try {
      const viewResult = await sql.query`
        SELECT *
        FROM vw_CostCodeBudgets
        WHERE COACode = 'AMPLME05.6250'
      `;
      console.log('Budget in vw_CostCodeBudgets:', viewResult.recordset);
    } catch (error) {
      console.log('vw_CostCodeBudgets view error:', error.message);
      
      // Try alternative approach - check what views exist
      const viewsResult = await sql.query`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.VIEWS 
        WHERE TABLE_NAME LIKE '%CostCode%' OR TABLE_NAME LIKE '%Budget%'
      `;
      console.log('Available budget-related views:', viewsResult.recordset.map(r => r.TABLE_NAME));
    }

    // 6. Check the backend cost code budget endpoint logic
    console.log('\n=== 6. Understanding Cost Code Aggregation ===');
    const aggregationResult = await sql.query`
      SELECT 
        COALESCE(prf.PurchaseCostCode, 'NO_COST_CODE') as PurchaseCostCode,
        coa.COACode,
        coa.COAName,
        coa.Category,
        COUNT(DISTINCT b.BudgetID) as BudgetCount,
        SUM(b.AllocatedAmount) as TotalAllocated,
        SUM(b.UtilizedAmount) as TotalUtilized
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN PRF prf ON coa.COAID = prf.COAID
      WHERE b.FiscalYear = 2025
      GROUP BY COALESCE(prf.PurchaseCostCode, 'NO_COST_CODE'), coa.COACode, coa.COAName, coa.Category
      HAVING coa.COACode = 'AMPLME05.6250'
    `;
    console.log('Aggregation for AMPLME05.6250:', aggregationResult.recordset);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.close();
  }
}

checkCostCodeMapping();