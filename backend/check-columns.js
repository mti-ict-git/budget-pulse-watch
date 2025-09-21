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

async function checkColumns() {
  try {
    console.log('Connecting to database...');
    await sql.connect(config);
    
    // Check if ExpenseType column exists in Budget table
    const result = await sql.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Budget' 
      AND COLUMN_NAME IN ('ExpenseType', 'Department')
    `);
    
    console.log('Existing columns in Budget table:');
    result.recordset.forEach(row => {
      console.log(`- ${row.COLUMN_NAME}`);
    });
    
    if (result.recordset.length === 0) {
      console.log('❌ ExpenseType and Department columns do not exist in Budget table');
    } else {
      console.log(`✅ Found ${result.recordset.length} columns`);
    }
    
  } catch (error) {
    console.error('Error checking columns:', error);
  } finally {
    await sql.close();
  }
}

checkColumns();