const sql = require('mssql');

const config = {
  server: '10.60.10.47',
  database: 'PRFMonitoringDB',
  user: 'sa',
  password: 'Bl4ck3y34dmin',
  port: 1433,
  options: { encrypt: true, trustServerCertificate: true }
};

async function checkSchema() {
  try {
    await sql.connect(config);
    
    // Check if cost code columns exist
    const result = await sql.query`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'PRFItems' 
      AND COLUMN_NAME IN ('PurchaseCostCode', 'COAID', 'BudgetYear')
      ORDER BY COLUMN_NAME
    `;
    
    console.log('Cost code columns in PRFItems table:');
    console.table(result.recordset);
    
    if (result.recordset.length === 0) {
      console.log('\n❌ Cost code columns are missing! Migration needs to be applied.');
      return;
    }
    
    // Check if there's any data
    const dataResult = await sql.query`
      SELECT TOP 5 PRFItemID, ItemName, PurchaseCostCode, COAID, BudgetYear 
      FROM PRFItems 
      WHERE PurchaseCostCode IS NOT NULL OR COAID IS NOT NULL
    `;
    
    console.log('\nSample PRFItems with cost code data:');
    console.table(dataResult.recordset);
    
    // Check total count
    const countResult = await sql.query`
      SELECT 
        COUNT(*) as TotalItems,
        COUNT(PurchaseCostCode) as ItemsWithCostCode,
        COUNT(COAID) as ItemsWithCOAID
      FROM PRFItems
    `;
    
    console.log('\nPRFItems statistics:');
    console.table(countResult.recordset);
    
    await sql.close();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSchema();