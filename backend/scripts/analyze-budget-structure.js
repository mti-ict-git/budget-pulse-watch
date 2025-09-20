const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  }
};

async function analyzeBudgetStructure() {
  try {
    console.log('🔄 Connecting to database...');
    await sql.connect(config);
    console.log('✅ Connected to database');
    
    // Check all budget entries grouped by COA
    console.log('\n📊 All Budget Entries by COA Code:');
    const allBudgets = await sql.query`
      SELECT 
        c.COACode,
        c.COAName,
        b.FiscalYear,
        b.Quarter,
        b.Month,
        b.AllocatedAmount,
        b.UtilizedAmount,
        b.BudgetID,
        b.CreatedAt
      FROM Budget b
      JOIN ChartOfAccounts c ON b.COAID = c.COAID
      ORDER BY c.COACode, b.FiscalYear, b.Quarter, b.Month, b.AllocatedAmount DESC
    `;
    console.table(allBudgets.recordset);
    
    // Check the specific cost codes that should have billion amounts
    console.log('\n🎯 Specific High-Value Cost Codes:');
    const specificCodes = await sql.query`
      SELECT 
        c.COACode,
        c.COAName,
        b.FiscalYear,
        b.Quarter,
        b.Month,
        b.AllocatedAmount,
        b.UtilizedAmount,
        b.BudgetID
      FROM Budget b
      JOIN ChartOfAccounts c ON b.COAID = c.COAID
      WHERE c.COACode IN ('MTIRMRAD496232', 'MTIRMRAD496250', 'MTIRMRAD496309', 'MTIRMRAD496313', 'MTIRMRAD496314')
      ORDER BY c.COACode, b.AllocatedAmount DESC
    `;
    console.table(specificCodes.recordset);
    
    // Check what the API query would return
    console.log('\n🔍 Simulating API Query - BudgetAllocations CTE:');
    const budgetAllocations = await sql.query`
      SELECT 
        b.COAID,
        b.FiscalYear,
        coa.COACode,
        coa.COAName,
        SUM(b.AllocatedAmount) as TotalAllocated,
        SUM(b.UtilizedAmount) as TotalUtilized,
        COUNT(*) as EntryCount
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      GROUP BY b.COAID, b.FiscalYear, coa.COACode, coa.COAName
      ORDER BY TotalAllocated DESC
    `;
    console.table(budgetAllocations.recordset);
    
    // Check total allocations
    console.log('\n💰 Total Budget Summary:');
    const totalSummary = await sql.query`
      SELECT 
        SUM(AllocatedAmount) as GrandTotalAllocated,
        COUNT(*) as TotalBudgetEntries,
        COUNT(DISTINCT COAID) as UniqueCOAs,
        AVG(AllocatedAmount) as AvgAllocation
      FROM Budget
    `;
    console.table(totalSummary.recordset);
    
    // Check if there are any PRF entries that might be affecting the calculation
    console.log('\n📋 PRF Data Sample:');
    const prfSample = await sql.query`
      SELECT TOP 5
        PurchaseCostCode,
        COAID,
        BudgetYear,
        RequestedAmount,
        ApprovedAmount,
        ActualAmount
      FROM PRF
      WHERE PurchaseCostCode IS NOT NULL
      ORDER BY RequestedAmount DESC
    `;
    console.table(prfSample.recordset);
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await sql.close();
  }
}

analyzeBudgetStructure();