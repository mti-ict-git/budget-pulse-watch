const fs = require('fs');
const path = require('path');

// Read PRF analysis data
const prfData = JSON.parse(fs.readFileSync('prf-analysis.json', 'utf8'));

// Extract unique COA codes from PRF data with amounts > 0
const prfCoaCodes = new Set();
if (prfData.prfRecords && Array.isArray(prfData.prfRecords)) {
  prfData.prfRecords.forEach(record => {
    if (record.Amount && record.Amount.toString().trim() !== '') {
      const amount = parseFloat(record.Amount.toString().replace(/[^\d.-]/g, ''));
      if (amount > 0 && record['Purchase Cost Code']) {
        prfCoaCodes.add(record['Purchase Cost Code']);
      }
    }
  });
}

console.log('=== PRF COA Analysis ===');
console.log(`Total unique COA codes from PRF with amounts: ${prfCoaCodes.size}`);
console.log('PRF COA codes:', Array.from(prfCoaCodes).sort());

// Read budget data from prf-analysis.json
let budgetData = [];
try {
  if (prfData.budgetRecords && Array.isArray(prfData.budgetRecords)) {
    budgetData = prfData.budgetRecords;
    console.log('\n=== Budget Data Analysis ===');
    console.log(`Total budget entries: ${budgetData.length}`);
    
    const budgetCoaCodes = new Set();
    budgetData.forEach(budget => {
      if (budget.COA) {
        budgetCoaCodes.add(budget.COA);
      }
    });
    
    console.log(`Unique COA codes in budget: ${budgetCoaCodes.size}`);
    console.log('Budget COA codes:', Array.from(budgetCoaCodes).sort());
    
    // Find matches and mismatches
    const matches = [];
    const prfOnly = [];
    const budgetOnly = [];
    
    prfCoaCodes.forEach(coa => {
      if (budgetCoaCodes.has(coa)) {
        matches.push(coa);
      } else {
        prfOnly.push(coa);
      }
    });
    
    budgetCoaCodes.forEach(coa => {
      if (!prfCoaCodes.has(coa)) {
        budgetOnly.push(coa);
      }
    });
    
    console.log('\n=== COA Mapping Analysis ===');
    console.log(`Matching COA codes: ${matches.length}`);
    console.log('Matches:', matches.sort());
    
    console.log(`\nCOA codes in PRF but not in budget: ${prfOnly.length}`);
    console.log('PRF only:', prfOnly.sort());
    
    console.log(`\nCOA codes in budget but not in PRF: ${budgetOnly.length}`);
    console.log('Budget only:', budgetOnly.sort());
    
    // Analyze budget amounts
    console.log('\n=== Budget Amount Analysis ===');
    budgetData.forEach((budget, index) => {
      console.log(`${index + 1}. COA: ${budget.COA}`);
      console.log(`   Category: ${budget.Category || 'N/A'}`);
      console.log(`   Initial Budget: ${budget['Initial Budget'] || 'N/A'}`);
      console.log(`   Spent: ${budget.Spent || 'N/A'}`);
      console.log(`   Remaining: ${budget.Remaining || 'N/A'}`);
      console.log(`   Utilization: ${budget.Utilization || 'N/A'}`);
      console.log('');
    });
    
  } else {
    console.log('\nNo budget records found in prf-analysis.json');
  }
} catch (error) {
  console.error('Error reading budget data:', error.message);
}

// Write detailed analysis to file
const analysis = {
  prfCoaCodes: Array.from(prfCoaCodes).sort(),
  prfCoaCount: prfCoaCodes.size,
  budgetData: budgetData,
  timestamp: new Date().toISOString()
};

fs.writeFileSync('coa-mapping-analysis.json', JSON.stringify(analysis, null, 2));
console.log('\nDetailed analysis written to coa-mapping-analysis.json');