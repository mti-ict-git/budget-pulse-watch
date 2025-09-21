const fs = require('fs');
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

async function analyzePRFBudgetMapping() {
  try {
    // Read PRF analysis data
    const analysisData = JSON.parse(fs.readFileSync('../prf-analysis.json', 'utf8'));
    const prfData = analysisData.prfRecords;
    console.log('=== PRF DATA ANALYSIS ===');
    console.log('Total PRF records:', prfData.length);
    
    // Extract unique COA codes from PRF data
    const prfCOACodes = [...new Set(prfData
      .map(record => record['Purchase Cost Code'])
      .filter(code => code && code.trim() !== '')
    )];
    
    console.log('Unique COA codes in PRF data:', prfCOACodes.length);
    console.log('PRF COA codes:', prfCOACodes.sort());
    
    // Calculate total amounts by COA code from PRF
    const prfAmountsByCOA = {};
    prfData.forEach(record => {
      const coaCode = record['Purchase Cost Code'];
      const amount = parseFloat(record['Total Amount'] || 0);
      if (coaCode && coaCode.trim() !== '') {
        if (!prfAmountsByCOA[coaCode]) {
          prfAmountsByCOA[coaCode] = 0;
        }
        prfAmountsByCOA[coaCode] += amount;
      }
    });
    
    console.log('\n=== PRF AMOUNTS BY COA CODE ===');
    Object.entries(prfAmountsByCOA)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([coaCode, amount]) => {
        console.log(`${coaCode}: Rp ${amount.toLocaleString()}`);
      });
    
    // Connect to database and check budget allocations
    await sql.connect(config);
    
    // Get budget allocations for PRF COA codes
    const budgetQuery = `
      SELECT 
        c.COACode,
        c.COAName,
        b.AllocatedAmount,
        b.UtilizedAmount
      FROM ChartOfAccounts c
      LEFT JOIN Budget b ON c.COAID = b.COAID
      WHERE c.COACode IN (${prfCOACodes.map(code => `'${code}'`).join(',')})
      ORDER BY c.COACode
    `;
    
    const budgetResults = await sql.query(budgetQuery);
    
    console.log('\n=== BUDGET STATUS FOR PRF COA CODES ===');
    const coaWithBudget = [];
    const coaWithoutBudget = [];
    
    budgetResults.recordset.forEach(row => {
      const prfAmount = prfAmountsByCOA[row.COACode] || 0;
      const status = row.AllocatedAmount > 0 ? 'HAS BUDGET' : 'NO BUDGET';
      
      console.log(`${row.COACode} | ${status} | PRF Total: Rp ${prfAmount.toLocaleString()} | Budget: Rp ${(row.AllocatedAmount || 0).toLocaleString()}`);
      
      if (row.AllocatedAmount > 0) {
        coaWithBudget.push(row.COACode);
      } else {
        coaWithoutBudget.push(row.COACode);
      }
    });
    
    console.log('\n=== SUMMARY ===');
    console.log(`PRF COA codes with budget allocation: ${coaWithBudget.length}`);
    console.log(`PRF COA codes without budget allocation: ${coaWithoutBudget.length}`);
    console.log(`Expected budget entries: ${prfCOACodes.length}`);
    console.log(`Actual budget entries: ${coaWithBudget.length}`);
    
    if (coaWithoutBudget.length > 0) {
      console.log('\n=== COA CODES MISSING BUDGET ALLOCATION ===');
      coaWithoutBudget.forEach(code => {
        const prfAmount = prfAmountsByCOA[code] || 0;
        console.log(`${code} - PRF Total: Rp ${prfAmount.toLocaleString()}`);
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.close();
  }
}

analyzePRFBudgetMapping();