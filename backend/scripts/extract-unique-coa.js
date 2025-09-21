const fs = require('fs');
const path = require('path');

// Read PRF analysis file
const prfPath = path.join(__dirname, '../../prf-analysis.json');
const prfData = JSON.parse(fs.readFileSync(prfPath, 'utf8'));

// Extract unique Purchase Cost Codes
const uniqueCodes = new Set();

prfData.prfRecords.forEach(item => {
    if (item['Purchase Cost Code']) {
        uniqueCodes.add(item['Purchase Cost Code'].trim());
    }
});

// Sort and display
const sortedCodes = Array.from(uniqueCodes).sort();

console.log('Unique COA codes from PRF data:');
console.log('Total unique codes:', sortedCodes.length);
console.log('\nCodes:');
sortedCodes.forEach(code => {
    console.log(code);
});

// Filter for AMIT codes specifically
const amitCodes = sortedCodes.filter(code => code.startsWith('AMIT'));
console.log('\n\nAMIT codes specifically:');
amitCodes.forEach(code => {
    console.log(code);
});