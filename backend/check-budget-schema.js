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

async function checkBudgetSchema() {
  try {
    await sql.connect(config);
    console.log('Connected to database\n');

    // Get Budget table schema
    const schemaQuery = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Budget'
      ORDER BY ORDINAL_POSITION
    `;

    const result = await sql.query(schemaQuery);
    
    console.log('Budget table schema:');
    console.log('===================');
    result.recordset.forEach(col => {
      console.log(`${col.COLUMN_NAME} (${col.DATA_TYPE}) - Nullable: ${col.IS_NULLABLE} - Default: ${col.COLUMN_DEFAULT || 'None'}`);
    });

    // Also get a sample record to see actual data
    const sampleQuery = `SELECT TOP 1 * FROM Budget`;
    const sampleResult = await sql.query(sampleQuery);
    
    console.log('\nSample Budget record:');
    console.log('====================');
    if (sampleResult.recordset.length > 0) {
      console.log(JSON.stringify(sampleResult.recordset[0], null, 2));
    }

    await sql.close();
  } catch (error) {
    console.error('Error:', error.message);
    await sql.close();
  }
}

checkBudgetSchema();