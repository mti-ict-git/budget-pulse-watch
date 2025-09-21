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

async function analyzePRFWithAmounts() {
  try {
    // Read PRF analysis data
    const analysisData = JSON.parse(fs.readFileSync('../prf-analysis.json', 'utf8'));
    const prfData = analysisData.prfRecords;
    
    console.log('=== PRF DATA WITH AMOUNTS ANALYSIS ===');
    console.log('Total PRF records:', prfData.length);
    
    // Filter PRF records with actual amounts > 0
    const prfWithAmounts = prfData.filter(record => {
      const amount = parseFloat(record.Amount || 0);
      return amount > 0;
    });
    
    console.log('PRF records with amounts > 0:', prfWithAmounts.length);
    
    // Extract unique COA codes from PRF data with amounts
    const prfCOACodesWithAmounts = [...new Set(prfWithAmounts
      .map(record => record['Purchase Cost Code'])
      .filter(code => code && code.trim() !== '')
    )];
    
    console.log('Unique COA codes in PRF data with amounts:', prfCOACodesWithAmounts.length);
    console.log('PRF COA codes with amounts:', prfCOACodesWithAmounts.sort());
    
    // Calculate total amounts by COA code from PRF
    const prfAmountsByCOA = {};
    prfWithAmounts.forEach(record => {
      const coaCode = record['Purchase Cost Code'];
      const amount = parseFloat(record.Amount || 0);
      if (coaCode && coaCode.trim() !== '' && amount > 0) {
        if (!prfAmountsByCOA[coaCode]) {
          prfAmountsByCOA[coaCode] = 0;
        }
        prfAmountsByCOA[coaCode] += amount;
      }
    });
    
    console.log('\n=== PRF AMOUNTS BY COA CODE (with amounts > 0) ===');
    const sortedPRFAmounts = Object.entries(prfAmountsByCOA)
      .sort(([a], [b]) => a.localeCompare(b));
    
    sortedPRFAmounts.forEach(([coaCode, amount]) => {
      console.log(`${coaCode}: Rp ${amount.toLocaleString()}`);
    });
    
    console.log(`\nTotal COA codes with PRF amounts: ${sortedPRFAmounts.length}`);
    
    // Connect to database and check budget allocations
    await sql.connect(config);
    
    // Get budget allocations for PRF COA codes with amounts
    if (prfCOACodesWithAmounts.length > 0) {
      const budgetQuery = `
        SELECT 
          c.COACode,
          c.COAName,
          b.AllocatedAmount,
          b.UtilizedAmount
        FROM ChartOfAccounts c
        LEFT JOIN Budget b ON c.COAID = b.COAID
        WHERE c.COACode IN (${prfCOACodesWithAmounts.map(code => `'${code}'`).join(',')})
        ORDER BY c.COACode
      `;
      
      const budgetResults = await sql.query(budgetQuery);
      
      console.log('\n=== BUDGET STATUS FOR PRF COA CODES WITH AMOUNTS ===');
      const coaWithBudget = [];
      const coaWithoutBudget = [];
      
      budgetResults.recordset.forEach(row => {
        const prfAmount = prfAmountsByCOA[row.COACode] || 0;
        const status = row.AllocatedAmount > 0 ? 'HAS BUDGET' : 'NO BUDGET';
        
        console.log(`${row.COACode} | ${status} | PRF Total: Rp ${prfAmount.toLocaleString()} | Budget: Rp ${(row.AllocatedAmount || 0).toLocaleString()}`);
        
        if (row.AllocatedAmount > 0) {
          coaWithBudget.push({
            code: row.COACode,
            prfAmount: prfAmount,
            budgetAmount: row.AllocatedAmount
          });
        } else {
          coaWithoutBudget.push({
            code: row.COACode,
            prfAmount: prfAmount
          });
        }
      });
      
      console.log('\n=== SUMMARY FOR PRF WITH AMOUNTS ===');
      console.log(`PRF COA codes with amounts: ${prfCOACodesWithAmounts.length}`);
      console.log(`PRF COA codes with budget allocation: ${coaWithBudget.length}`);
      console.log(`PRF COA codes without budget allocation: ${coaWithoutBudget.length}`);
      
      if (coaWithoutBudget.length > 0) {
        console.log('\n=== COA CODES WITH PRF AMOUNTS BUT NO BUDGET ALLOCATION ===');
        coaWithoutBudget.forEach(item => {
          console.log(`${item.code} - PRF Total: Rp ${item.prfAmount.toLocaleString()}`);
        });
      }
      
      // Show detailed PRF records for analysis
      console.log('\n=== DETAILED PRF RECORDS WITH AMOUNTS ===');
      prfWithAmounts.forEach((record, index) => {
        console.log(`\nPRF ${index + 1}:`);
        console.log(`  PRF No: ${record['PRF No']}`);
        console.log(`  Description: ${record.Description}`);
        console.log(`  COA Code: ${record['Purchase Cost Code']}`);
        console.log(`  Amount: Rp ${parseFloat(record.Amount).toLocaleString()}`);
        console.log(`  Submit By: ${record['Submit By']}`);
        console.log(`  Status: ${record['Status in Pronto']}`);
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.close();
  }
}

analyzePRFWithAmounts();