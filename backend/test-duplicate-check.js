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

async function testDuplicateCheck() {
  try {
    console.log('🔍 Connecting to database...');
    await sql.connect(config);
    console.log('✅ Connected to database');

    // Test the exact query used in findByCOAAndYear
    console.log('\n🔍 Testing duplicate check logic...');
    
    // Let's check what COA and fiscal year combinations exist
    const existingBudgetsQuery = `
      SELECT 
        COAID,
        FiscalYear,
        COUNT(*) as Count,
        STRING_AGG(CAST(BudgetID as VARCHAR), ', ') as BudgetIDs
      FROM Budget 
      GROUP BY COAID, FiscalYear
      HAVING COUNT(*) > 0
      ORDER BY FiscalYear DESC, COAID
    `;

    console.log('📊 Existing COA and FiscalYear combinations:');
    const existingResult = await sql.query(existingBudgetsQuery);
    existingResult.recordset.forEach(row => {
      console.log(`  - COAID: ${row.COAID}, FiscalYear: ${row.FiscalYear}, Count: ${row.Count}, BudgetIDs: ${row.BudgetIDs}`);
    });

    // Test specific duplicate check for COAID 23 and FiscalYear 2025 (the most recent one)
    console.log('\n🔍 Testing duplicate check for COAID 23, FiscalYear 2025:');
    const duplicateCheckQuery = `
      SELECT * FROM Budget 
      WHERE COAID = @COAID AND FiscalYear = @FiscalYear
    `;

    const request = new sql.Request();
    request.input('COAID', sql.Int, 23);
    request.input('FiscalYear', sql.Int, 2025);
    
    const duplicateResult = await request.query(duplicateCheckQuery);
    
    if (duplicateResult.recordset.length > 0) {
      console.log(`❌ Found ${duplicateResult.recordset.length} existing budget(s):`);
      duplicateResult.recordset.forEach(budget => {
        console.log(`  - BudgetID: ${budget.BudgetID}, Department: ${budget.Department}, Amount: ${budget.AllocatedAmount}, Status: ${budget.Status}, Created: ${budget.CreatedAt}`);
      });
    } else {
      console.log('✅ No existing budget found for COAID 23, FiscalYear 2025');
    }

    // Check what COAs are available for selection
    console.log('\n📋 Available COAs for budget creation:');
    const coaQuery = `
      SELECT TOP 10
        COAID,
        COACode,
        COAName,
        IsActive
      FROM ChartOfAccounts
      WHERE IsActive = 1
      ORDER BY COACode
    `;

    const coaResult = await sql.query(coaQuery);
    coaResult.recordset.forEach(coa => {
      console.log(`  - COAID: ${coa.COAID}, Code: ${coa.COACode}, Name: ${coa.COAName}, Active: ${coa.IsActive}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.close();
    console.log('\n🔌 Database connection closed');
  }
}

testDuplicateCheck();