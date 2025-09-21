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

async function analyzeBudgetDiscrepancy() {
  try {
    await sql.connect(config);
    
    console.log('=== BUDGET DATA ANALYSIS ===');
    
    // Check total budget entries
    const totalBudgets = await sql.query('SELECT COUNT(*) as total FROM Budget');
    console.log('Total Budget entries:', totalBudgets.recordset[0].total);
    
    // Check budgets with initial budget > 0
    const budgetsWithInitial = await sql.query('SELECT COUNT(*) as count FROM Budget WHERE AllocatedAmount > 0');
    console.log('Budgets with AllocatedAmount > 0:', budgetsWithInitial.recordset[0].count);
    
    // Check budget entries by COA
    const budgetByCOA = await sql.query(`
      SELECT 
        c.COACode,
        c.COAName,
        b.AllocatedAmount,
        b.UtilizedAmount,
        b.FiscalYear,
        b.Quarter,
        b.Month
      FROM Budget b
      JOIN ChartOfAccounts c ON b.COAID = c.COAID
      WHERE b.AllocatedAmount > 0
      ORDER BY c.COACode
    `);
    
    console.log('\n=== BUDGETS WITH ALLOCATED AMOUNT > 0 ===');
    budgetByCOA.recordset.forEach(row => {
      console.log(`COA: ${row.COACode} | Name: ${row.COAName} | Allocated: ${row.AllocatedAmount} | Utilized: ${row.UtilizedAmount} | Period: ${row.FiscalYear}-Q${row.Quarter}-M${row.Month}`);
    });
    
    // Check all COA codes that should have budgets based on PRF
    const coaWithPRF = await sql.query(`
      SELECT DISTINCT c.COACode, c.COAName
      FROM ChartOfAccounts c
      ORDER BY c.COACode
    `);
    
    console.log('\n=== ALL COA CODES IN DATABASE ===');
    console.log('Total COA codes:', coaWithPRF.recordset.length);
    coaWithPRF.recordset.forEach(row => {
      console.log(`${row.COACode} - ${row.COAName}`);
    });
    
    // Check which COA codes are missing budget allocations
    const coaWithoutBudget = await sql.query(`
      SELECT c.COACode, c.COAName
      FROM ChartOfAccounts c
      LEFT JOIN Budget b ON c.COAID = b.COAID AND b.AllocatedAmount > 0
      WHERE b.COAID IS NULL
      ORDER BY c.COACode
    `);
    
    console.log('\n=== COA CODES WITHOUT BUDGET ALLOCATION ===');
    console.log('Count:', coaWithoutBudget.recordset.length);
    coaWithoutBudget.recordset.forEach(row => {
      console.log(`${row.COACode} - ${row.COAName}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.close();
  }
}

analyzeBudgetDiscrepancy();