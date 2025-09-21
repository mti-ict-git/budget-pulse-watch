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

async function addExpenseTypeColumn() {
  try {
    console.log('Connecting to database...');
    await sql.connect(config);
    
    // Add ExpenseType column to Budget table
    console.log('Adding ExpenseType column to Budget table...');
    await sql.query(`
      ALTER TABLE Budget 
      ADD ExpenseType NVARCHAR(10) DEFAULT 'OPEX' CHECK (ExpenseType IN ('CAPEX', 'OPEX'))
    `);
    console.log('✅ ExpenseType column added to Budget table');
    
    // Update existing Budget records with default values
    console.log('Updating existing Budget records...');
    await sql.query(`
      UPDATE Budget 
      SET ExpenseType = CASE 
          WHEN EXISTS (
              SELECT 1 FROM ChartOfAccounts coa 
              WHERE coa.COAID = Budget.COAID 
              AND coa.Category IN ('IT Equipment', 'Equipment', 'Hardware Equipment', 'Office Equipment')
          ) THEN 'CAPEX'
          ELSE 'OPEX'
      END
      WHERE ExpenseType IS NULL
    `);
    console.log('✅ Budget records updated');
    
    // Create index for better performance
    console.log('Creating index...');
    await sql.query(`
      CREATE INDEX IX_Budget_ExpenseType ON Budget(ExpenseType)
    `);
    console.log('✅ Index created');
    
    console.log('🎉 ExpenseType column successfully added to Budget table!');
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠️ ExpenseType column already exists');
    } else {
      console.error('Error adding ExpenseType column:', error);
      process.exit(1);
    }
  } finally {
    await sql.close();
  }
}

addExpenseTypeColumn();