const fs = require('fs');

const data = JSON.parse(fs.readFileSync('prf-analysis.json', 'utf8'));
console.log('Total PRF records:', data.prfRecords.length);

const withAmounts = data.prfRecords.filter(r => {
  const amount = r.Amount;
  return amount && amount !== '' && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
});

console.log('Records with amounts > 0:', withAmounts.length);
console.log('\n=== PRF RECORDS WITH AMOUNTS ===');

withAmounts.forEach((r, i) => {
  console.log(`${i+1}. PRF ${r['PRF No']}: ${r['Purchase Cost Code']} - Rp ${parseFloat(r.Amount).toLocaleString()}`);
  console.log(`   Description: ${r.Description}`);
  console.log(`   Submit By: ${r['Submit By']}`);
  console.log(`   Status: ${r['Status in Pronto']}`);
  console.log('');
});

// Get unique COA codes
const uniqueCOA = [...new Set(withAmounts.map(r => r['Purchase Cost Code']).filter(c => c))];
console.log(`\nUnique COA codes with amounts: ${uniqueCOA.length}`);
console.log('COA codes:', uniqueCOA.sort());