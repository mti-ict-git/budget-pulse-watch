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

async function checkOrphanedBudgets() {
  try {
    console.log('🔍 Connecting to database...');
    await sql.connect(config);
    console.log('✅ Connected to database');

    // Check for budgets that don't have corresponding COA records
    const orphanedBudgetsQuery = `
      SELECT 
        b.BudgetID,
        b.COAID,
        b.FiscalYear,
        b.Department,
        b.AllocatedAmount,
        b.CreatedAt
      FROM Budget b
      LEFT JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      WHERE coa.COAID IS NULL
      ORDER BY b.CreatedAt DESC
    `;

    console.log('🔍 Checking for orphaned budget records...');
    const orphanedResult = await sql.query(orphanedBudgetsQuery);
    
    if (orphanedResult.recordset.length > 0) {
      console.log(`❌ Found ${orphanedResult.recordset.length} orphaned budget records:`);
      orphanedResult.recordset.forEach(budget => {
        console.log(`  - BudgetID: ${budget.BudgetID}, COAID: ${budget.COAID}, FiscalYear: ${budget.FiscalYear}, Department: ${budget.Department}, Amount: ${budget.AllocatedAmount}, Created: ${budget.CreatedAt}`);
      });
    } else {
      console.log('✅ No orphaned budget records found');
    }

    // Check total budget count vs view count
    const totalBudgetsQuery = 'SELECT COUNT(*) as Total FROM Budget';
    const viewBudgetsQuery = 'SELECT COUNT(*) as Total FROM vw_BudgetSummary';

    const [totalResult, viewResult] = await Promise.all([
      sql.query(totalBudgetsQuery),
      sql.query(viewBudgetsQuery)
    ]);

    const totalBudgets = totalResult.recordset[0].Total;
    const viewBudgets = viewResult.recordset[0].Total;

    console.log(`\n📊 Budget count comparison:`);
    console.log(`  - Total budgets in Budget table: ${totalBudgets}`);
    console.log(`  - Budgets visible in vw_BudgetSummary view: ${viewBudgets}`);
    console.log(`  - Hidden budgets: ${totalBudgets - viewBudgets}`);

    // Check for recent budget creations
    const recentBudgetsQuery = `
      SELECT TOP 10
        b.BudgetID,
        b.COAID,
        b.FiscalYear,
        b.Department,
        b.AllocatedAmount,
        b.CreatedAt,
        coa.COACode,
        coa.COAName
      FROM Budget b
      LEFT JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      ORDER BY b.CreatedAt DESC
    `;

    console.log(`\n📅 Recent budget records:`);
    const recentResult = await sql.query(recentBudgetsQuery);
    recentResult.recordset.forEach(budget => {
      const coaInfo = budget.COACode ? `${budget.COACode} (${budget.COAName})` : 'COA NOT FOUND';
      console.log(`  - BudgetID: ${budget.BudgetID}, COAID: ${budget.COAID}, COA: ${coaInfo}, FiscalYear: ${budget.FiscalYear}, Created: ${budget.CreatedAt}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.close();
    console.log('\n🔌 Database connection closed');
  }
}

checkOrphanedBudgets();