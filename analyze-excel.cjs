const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Read the Excel file
const filePath = path.join(__dirname, 'PRF IT MONITORING - NEW UPDATED (3).xlsx');
console.log('Reading Excel file:', filePath);

try {
  const workbook = XLSX.readFile(filePath);
  
  console.log('\n=== WORKBOOK INFO ===');
  console.log('Sheet Names:', workbook.SheetNames);
  
  // Analyze PRF Detail sheet
  const prfSheet = workbook.Sheets['PRF Detail'];
  const prfData = XLSX.utils.sheet_to_json(prfSheet, { 
    header: 1,
    defval: ''
  });
  
  console.log('\n=== PRF DETAIL ANALYSIS ===');
  console.log('Total rows:', prfData.length);
  
  // Find the actual header row (row 2 based on previous output)
  const headerRow = prfData[1]; // Row 2 (0-indexed)
  console.log('\nHeaders:', headerRow);
  
  // Convert to objects using the header row
  const prfRecords = [];
  for (let i = 2; i < prfData.length; i++) {
    if (prfData[i].some(cell => cell !== '')) {
      const record = {};
      headerRow.forEach((header, index) => {
        if (header) {
          record[header] = prfData[i][index] || '';
        }
      });
      prfRecords.push(record);
    }
  }
  
  console.log('\nTotal PRF records:', prfRecords.length);
  console.log('\nSample PRF records (first 3):');
  prfRecords.slice(0, 3).forEach((record, index) => {
    console.log(`\nRecord ${index + 1}:`);
    Object.entries(record).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  });
  
  // Analyze Budget Detail sheet
  const budgetSheet = workbook.Sheets['Budget Detail'];
  const budgetData = XLSX.utils.sheet_to_json(budgetSheet, { 
    header: 1,
    defval: ''
  });
  
  console.log('\n\n=== BUDGET DETAIL ANALYSIS ===');
  console.log('Total rows:', budgetData.length);
  
  const budgetHeaderRow = budgetData[0]; // Row 1 (0-indexed)
  console.log('\nHeaders:', budgetHeaderRow);
  
  // Convert to objects
  const budgetRecords = [];
  for (let i = 1; i < budgetData.length; i++) {
    if (budgetData[i].some(cell => cell !== '')) {
      const record = {};
      budgetHeaderRow.forEach((header, index) => {
        if (header) {
          record[header] = budgetData[i][index] || '';
        }
      });
      budgetRecords.push(record);
    }
  }
  
  console.log('\nTotal Budget records:', budgetRecords.length);
  console.log('\nBudget records:');
  budgetRecords.forEach((record, index) => {
    console.log(`\nBudget ${index + 1}:`);
    Object.entries(record).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  });
  
  // Analyze data patterns
  console.log('\n\n=== DATA ANALYSIS ===');
  
  // Unique values analysis for PRF data
  const uniqueSubmitters = [...new Set(prfRecords.map(r => r['Submit By']).filter(Boolean))];
  const uniqueCategories = [...new Set(prfRecords.map(r => r['Sum Description Requested']).filter(Boolean))];
  const uniqueCostCodes = [...new Set(prfRecords.map(r => r['Purchase Cost Code']).filter(Boolean))];
  const uniqueYears = [...new Set(prfRecords.map(r => r['Budget']).filter(Boolean))];
  
  console.log('\nUnique Submitters:', uniqueSubmitters);
  console.log('\nUnique Categories:', uniqueCategories);
  console.log('\nUnique Cost Codes:', uniqueCostCodes);
  console.log('\nUnique Budget Years:', uniqueYears);
  
  // Amount analysis
  const amounts = prfRecords.map(r => parseFloat(r['Amount']) || 0).filter(a => a > 0);
  const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
  const avgAmount = amounts.length > 0 ? totalAmount / amounts.length : 0;
  
  console.log('\nAmount Analysis:');
  console.log(`  Total Amount: ${totalAmount.toLocaleString()}`);
  console.log(`  Average Amount: ${avgAmount.toLocaleString()}`);
  console.log(`  Min Amount: ${Math.min(...amounts).toLocaleString()}`);
  console.log(`  Max Amount: ${Math.max(...amounts).toLocaleString()}`);
  
  // Save analysis to JSON files
  const analysisData = {
    prfRecords,
    budgetRecords,
    analysis: {
      uniqueSubmitters,
      uniqueCategories,
      uniqueCostCodes,
      uniqueYears,
      totalAmount,
      avgAmount,
      recordCount: prfRecords.length
    }
  };
  
  fs.writeFileSync('prf-analysis.json', JSON.stringify(analysisData, null, 2));
  console.log('\n\nAnalysis saved to prf-analysis.json');
  
} catch (error) {
  console.error('Error reading Excel file:', error.message);
}