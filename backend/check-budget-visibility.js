const sql = require('mssql');

// Database configuration
const config = {
  server: process.env.DB_HOST || '10.60.10.47',
  database: process.env.DB_NAME || 'PRFMonitoringDB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Bl4ck3y34dmin',
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  }
};

async function checkBudgetVisibility() {
  try {
    console.log('🔍 Connecting to database...');
    await sql.connect(config);
    console.log('✅ Connected to database');

    // First, check the view structure
    console.log('\n🔍 Checking view structure...');
    const structureQuery = `
      SELECT TOP 1 * FROM vw_BudgetSummary
    `;

    const structureResult = await sql.query(structureQuery);
    if (structureResult.recordset.length > 0) {
      console.log('📋 Available columns in vw_BudgetSummary:');
      console.log(Object.keys(structureResult.recordset[0]).join(', '));
    }

    // Check if the budget for COAID 23, FiscalYear 2025 is visible in the view
    console.log('\n🔍 Checking budget visibility for COAID 23, FY 2025...');
    
    const viewQuery = `
      SELECT * FROM vw_BudgetSummary
      WHERE COAID = 23 AND FiscalYear = 2025
    `;

    const viewResult = await sql.query(viewQuery);
    
    if (viewResult.recordset.length > 0) {
      console.log('✅ Budget IS visible in vw_BudgetSummary:');
      viewResult.recordset.forEach(budget => {
        console.log(`  - BudgetID: ${budget.BudgetID}, COA: ${budget.COACode}, Department: ${budget.Department}, Amount: ${budget.AllocatedAmount}, Status: ${budget.Status}`);
      });
    } else {
      console.log('❌ Budget is NOT visible in vw_BudgetSummary');
      
      // Check if the COA exists in ChartOfAccounts
      console.log('\n🔍 Checking if COAID 23 exists in ChartOfAccounts...');
      const coaCheckQuery = `
        SELECT * FROM ChartOfAccounts WHERE COAID = 23
      `;
      
      const coaResult = await sql.query(coaCheckQuery);
      if (coaResult.recordset.length > 0) {
        console.log('✅ COAID 23 exists in ChartOfAccounts:');
        console.log(`  - COACode: ${coaResult.recordset[0].COACode}, COAName: ${coaResult.recordset[0].COAName}, IsActive: ${coaResult.recordset[0].IsActive}`);
      } else {
        console.log('❌ COAID 23 does NOT exist in ChartOfAccounts');
      }
    }

    // Check recent budgets in the view (what the frontend would see)
    console.log('\n📋 Recent budgets visible in frontend (top 5):');
    const recentViewQuery = `
      SELECT TOP 5
        BudgetID,
        COAID,
        FiscalYear,
        AccountCode,
        Department,
        AllocatedAmount,
        Status,
        CreatedAt
      FROM vw_BudgetSummary
      ORDER BY CreatedAt DESC
    `;

    const recentViewResult = await sql.query(recentViewQuery);
    recentViewResult.recordset.forEach(budget => {
      console.log(`  - BudgetID: ${budget.BudgetID}, COAID: ${budget.COAID}, COA: ${budget.AccountCode}, FY: ${budget.FiscalYear}, Dept: ${budget.Department}, Amount: ${budget.AllocatedAmount}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.close();
    console.log('\n🔌 Database connection closed');
  }
}

checkBudgetVisibility();