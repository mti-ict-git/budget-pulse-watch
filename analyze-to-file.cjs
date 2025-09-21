const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('prf-analysis.json', 'utf8'));
  
  let output = '';
  output += `Total PRF records: ${data.prfRecords.length}\n`;

  const withAmounts = data.prfRecords.filter(r => {
    const amount = r.Amount;
    return amount && amount !== '' && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
  });

  output += `Records with amounts > 0: ${withAmounts.length}\n\n`;
  output += '=== PRF RECORDS WITH AMOUNTS ===\n';

  withAmounts.forEach((r, i) => {
    output += `${i+1}. PRF ${r['PRF No']}: ${r['Purchase Cost Code']} - Rp ${parseFloat(r.Amount).toLocaleString()}\n`;
    output += `   Description: ${r.Description}\n`;
    output += `   Submit By: ${r['Submit By']}\n`;
    output += `   Status: ${r['Status in Pronto']}\n\n`;
  });

  // Get unique COA codes
  const uniqueCOA = [...new Set(withAmounts.map(r => r['Purchase Cost Code']).filter(c => c))];
  output += `\nUnique COA codes with amounts: ${uniqueCOA.length}\n`;
  output += `COA codes: ${uniqueCOA.sort().join(', ')}\n`;

  fs.writeFileSync('prf-analysis-output.txt', output);
  console.log('Analysis written to prf-analysis-output.txt');
  console.log(`Found ${withAmounts.length} PRF records with amounts`);
  console.log(`Found ${uniqueCOA.length} unique COA codes with amounts`);
  
} catch (error) {
  console.error('Error:', error.message);
}