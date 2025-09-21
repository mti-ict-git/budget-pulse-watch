const fs = require('fs');

try {
  // Read PRF analysis data
  const path = require('path');
  const analysisData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../prf-analysis.json'), 'utf8'));
  const prfData = analysisData.prfRecords;
  
  console.log('=== SIMPLE PRF ANALYSIS ===');
  console.log('Total PRF records:', prfData.length);
  
  // Check first few records to understand structure
  console.log('\n=== FIRST 5 PRF RECORDS ===');
  prfData.slice(0, 5).forEach((record, index) => {
    console.log(`\nRecord ${index + 1}:`);
    console.log(`  PRF No: ${record['PRF No']}`);
    console.log(`  Description: ${record.Description}`);
    console.log(`  COA Code: ${record['Purchase Cost Code']}`);
    console.log(`  Amount: ${record.Amount} (type: ${typeof record.Amount})`);
    console.log(`  Submit By: ${record['Submit By']}`);
  });
  
  // Filter records with amounts
  const recordsWithAmounts = prfData.filter(record => {
    const amount = record.Amount;
    return amount !== '' && amount !== null && amount !== undefined && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
  });
  
  console.log(`\n=== RECORDS WITH AMOUNTS ===`);
  console.log(`Total records with amounts > 0: ${recordsWithAmounts.length}`);
  
  recordsWithAmounts.forEach((record, index) => {
    console.log(`\nRecord ${index + 1} with amount:`);
    console.log(`  PRF No: ${record['PRF No']}`);
    console.log(`  Description: ${record.Description}`);
    console.log(`  COA Code: ${record['Purchase Cost Code']}`);
    console.log(`  Amount: Rp ${parseFloat(record.Amount).toLocaleString()}`);
    console.log(`  Submit By: ${record['Submit By']}`);
    console.log(`  Status: ${record['Status in Pronto']}`);
  });
  
  // Get unique COA codes from records with amounts
  const coaCodesWithAmounts = [...new Set(recordsWithAmounts
    .map(record => record['Purchase Cost Code'])
    .filter(code => code && code.trim() !== '')
  )];
  
  console.log(`\n=== UNIQUE COA CODES WITH AMOUNTS ===`);
  console.log(`Count: ${coaCodesWithAmounts.length}`);
  console.log('COA Codes:', coaCodesWithAmounts.sort());
  
} catch (error) {
  console.error('Error:', error.message);
}