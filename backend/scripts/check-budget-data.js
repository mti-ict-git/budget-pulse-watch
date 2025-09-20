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

async function checkBudgets() {
  try {
    console.log('🔄 Connecting to database...');
    await sql.connect(config);
    console.log('✅ Connected to database');
    
    const result = await sql.query`
      SELECT TOP 10 
        b.BudgetID,
        c.COACode,
        c.COAName,
        b.AllocatedAmount,
        b.UtilizedAmount,
        b.FiscalYear,
        b.Quarter
      FROM Budget b
      JOIN ChartOfAccounts c ON b.COAID = c.COAID
      ORDER BY b.AllocatedAmount DESC
    `;
    console.log('\n📊 Current Budget Data (Top 10 by Allocation):');
    console.table(result.recordset);
    
    const summary = await sql.query`
      SELECT 
        COUNT(*) as TotalBudgets,
        SUM(AllocatedAmount) as TotalAllocated,
        AVG(AllocatedAmount) as AvgAllocated,
        MAX(AllocatedAmount) as MaxAllocated,
        MIN(AllocatedAmount) as MinAllocated
      FROM Budget
    `;
    console.log('\n📈 Budget Summary:');
    console.table(summary.recordset);
    
    // Check specific cost codes that should have been updated
    const specificCodes = await sql.query`
      SELECT 
        c.COACode,
        c.COAName,
        b.AllocatedAmount,
        b.UtilizedAmount
      FROM Budget b
      JOIN ChartOfAccounts c ON b.COAID = c.COAID
      WHERE c.COACode IN ('MTIRMRAD496232', 'MTIRMRAD496250', 'MTIRMRAD496309', 'MTIRMRAD496313', 'MTIRMRAD496314')
      ORDER BY b.AllocatedAmount DESC
    `;
    console.log('\n🎯 Specific Cost Codes (Should have billion-scale amounts):');
    console.table(specificCodes.recordset);
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await sql.close();
  }
}

checkBudgets();