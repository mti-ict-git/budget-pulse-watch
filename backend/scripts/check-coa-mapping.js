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

async function checkCOAMapping() {
  try {
    console.log('🔄 Connecting to database...');
    await sql.connect(config);
    console.log('✅ Connected to database');
    
    console.log('\n📊 COA Mapping in PRF vs Budget:');
    const mapping = await sql.query`
      SELECT 
        'PRF' as Source,
        p.COAID,
        c.COACode,
        c.COAName,
        COUNT(*) as RecordCount
      FROM PRF p
      JOIN ChartOfAccounts c ON p.COAID = c.COAID
      GROUP BY p.COAID, c.COACode, c.COAName
      
      UNION ALL
      
      SELECT 
        'Budget' as Source,
        b.COAID,
        c.COACode,
        c.COAName,
        COUNT(*) as RecordCount
      FROM Budget b
      JOIN ChartOfAccounts c ON b.COAID = c.COAID
      GROUP BY b.COAID, c.COACode, c.COAName
      
      ORDER BY Source, COAID
    `;
    console.table(mapping.recordset);
    
    console.log('\n🔍 Budget entries with their COA details:');
    const budgetCOAs = await sql.query`
      SELECT 
        b.COAID,
        c.COACode,
        c.COAName,
        SUM(b.AllocatedAmount) as TotalAllocated,
        COUNT(*) as EntryCount
      FROM Budget b
      JOIN ChartOfAccounts c ON b.COAID = c.COAID
      GROUP BY b.COAID, c.COACode, c.COAName
      ORDER BY TotalAllocated DESC
    `;
    console.table(budgetCOAs.recordset);
    
    console.log('\n🎯 PRF entries by COAID:');
    const prfCOAs = await sql.query`
      SELECT 
        p.COAID,
        c.COACode,
        c.COAName,
        COUNT(*) as PRFCount,
        SUM(p.RequestedAmount) as TotalRequested
      FROM PRF p
      JOIN ChartOfAccounts c ON p.COAID = c.COAID
      GROUP BY p.COAID, c.COACode, c.COAName
      ORDER BY PRFCount DESC
    `;
    console.table(prfCOAs.recordset);
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await sql.close();
  }
}

checkCOAMapping();