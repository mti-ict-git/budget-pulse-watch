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

async function checkCostCodeRelationship() {
  try {
    console.log('🔄 Connecting to database...');
    await sql.connect(config);
    console.log('✅ Connected to database');
    
    console.log('\n🔍 Checking if PRF PurchaseCostCode matches ChartOfAccounts COACode:');
    const matches = await sql.query`
      SELECT DISTINCT
        p.PurchaseCostCode,
        c.COACode,
        c.COAName,
        'MATCH' as Relationship
      FROM PRF p
      INNER JOIN ChartOfAccounts c ON p.PurchaseCostCode = c.COACode
      ORDER BY p.PurchaseCostCode
    `;
    console.table(matches.recordset);
    
    console.log('\n📊 Sample PRF cost codes vs ChartOfAccounts:');
    const sample = await sql.query`
      SELECT TOP 10
        p.PurchaseCostCode as PRF_CostCode,
        c.COACode as COA_Code,
        c.COAName
      FROM PRF p
      CROSS JOIN ChartOfAccounts c
      WHERE c.COAID BETWEEN 2 AND 10
      ORDER BY p.PurchaseCostCode, c.COACode
    `;
    console.table(sample.recordset);
    
    console.log('\n🎯 Budget entries with billion-scale amounts:');
    const budgetBillion = await sql.query`
      SELECT 
        c.COACode,
        c.COAName,
        b.AllocatedAmount,
        b.COAID
      FROM Budget b
      JOIN ChartOfAccounts c ON b.COAID = c.COAID
      WHERE b.AllocatedAmount > 1000000000
      ORDER BY b.AllocatedAmount DESC
    `;
    console.table(budgetBillion.recordset);
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await sql.close();
  }
}

checkCostCodeRelationship();