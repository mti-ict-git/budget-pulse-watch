const fs = require('fs');
const path = require('path');

// User's COA list from Excel (51 codes)
const userCOAList = [
    'MTIRMRAD416769', 'MTIRMRHS606250', '51211325.6250', 'AMITBD01', 'AMITCM14.6718',
    'AMITCM16', 'AMITCM16.6250', 'AMITCM18.6250', 'AMITCM19.6250', 'AMITCM20.6250',
    'AMITCM21', 'AMITCM21.6250', '"AMITCM21.6250"', 'AMITCM22.6250', 'AMITCM23',
    'AMITINO1.6250', 'AMPLCM01.6250', 'AMPLME05.6250', 'MTIRMRAD416250', 'MTIRMRAD426249',
    'MTIRMRAD496014', 'MTIRMRAD496109', 'MTIRMRAD496137', 'MTIRMRAD496232', 'MTIRMRAD496250',
    'MTIRMRAD496313', 'MTIRMRAD496314', 'MTIRMRAD496326', 'MTIRMRAD4963265', 'MTIRMRAD496328',
    'MTIRMRAD496769', 'MTIRMRADA496328', 'MTIRMRHR606014', 'MTIRMRHS446250', 'MTIRMRHS446279',
    'MTIRMRHS606250', 'MTIRMRHS606279', 'MTIRMRMT236137', 'MTIRMRMT26', 'MTIRMRMT26.6137',
    'MTIRMRMT266014', 'MTIRMRMT266137', 'MTIRMRMT266137', 'MTIRMRMT266733', 'MTIRMRMT266769',
    'MTIRMRPR226250', 'MTIRMRPRA06250', 'MTIRMRPRC06250', 'MTIRMRPRD06769', 'MTIRMRTS606250',
    'W0171197.6769'
];

// Database COA list (23 codes)
const databaseCOAList = [
    'AMITBD01', 'AMITCM14.6718', 'AMITCM16', 'AMITCM16.6250', 'AMITCM18.6250',
    'AMITCM19.6250', 'AMITCM20.6250', 'AMITCM21', 'AMITCM21.6250', 'AMITCM22.6250',
    'AMITCM23', 'AMITINO1.6250', 'AMPLCM01.6250', 'AMPLME05.6250', 'MTIRMRAD496014',
    'MTIRMRAD496232', 'MTIRMRAD496250', 'MTIRMRAD496309', 'MTIRMRAD496313', 'MTIRMRAD496314',
    'MTIRMRAD496326', 'MTIRMRAD496328', 'MTIRMRAD496769'
];

// Read PRF analysis file
const prfPath = path.join(__dirname, '../../prf-analysis.json');
const prfData = JSON.parse(fs.readFileSync(prfPath, 'utf8'));

// Extract unique Purchase Cost Codes from PRF
const prfCOACodes = new Set();
prfData.prfRecords.forEach(item => {
    if (item['Purchase Cost Code']) {
        prfCOACodes.add(item['Purchase Cost Code'].trim());
    }
});
const prfCOAList = Array.from(prfCOACodes).sort();

// Clean user's list (remove quotes and duplicates)
const cleanUserList = [...new Set(userCOAList.map(code => code.replace(/"/g, '')))];

console.log('🔍 COMPREHENSIVE COA ANALYSIS');
console.log('='.repeat(60));
console.log(`📊 User's Excel COA count: ${userCOAList.length} (raw)`);
console.log(`🧹 User's Excel COA count: ${cleanUserList.length} (clean, no duplicates)`);
console.log(`📄 PRF Analysis COA count: ${prfCOAList.length}`);
console.log(`🗄️  Database COA count: ${databaseCOAList.length}`);

console.log('\n📈 DISCREPANCY ANALYSIS');
console.log('='.repeat(60));

// Find codes in User's Excel but NOT in PRF Analysis
const inExcelNotInPRF = cleanUserList.filter(code => !prfCOAList.includes(code));
console.log(`\n❌ In Excel but NOT in PRF Analysis (${inExcelNotInPRF.length}):`);
inExcelNotInPRF.forEach(code => console.log(`   - ${code}`));

// Find codes in PRF Analysis but NOT in User's Excel
const inPRFNotInExcel = prfCOAList.filter(code => !cleanUserList.includes(code));
console.log(`\n❌ In PRF Analysis but NOT in Excel (${inPRFNotInExcel.length}):`);
inPRFNotInExcel.forEach(code => console.log(`   - ${code}`));

// Find codes in User's Excel but NOT in Database
const inExcelNotInDB = cleanUserList.filter(code => !databaseCOAList.includes(code));
console.log(`\n❌ In Excel but NOT in Database (${inExcelNotInDB.length}):`);
inExcelNotInDB.forEach(code => console.log(`   - ${code}`));

// Find codes in Database but NOT in User's Excel
const inDBNotInExcel = databaseCOAList.filter(code => !cleanUserList.includes(code));
console.log(`\n❌ In Database but NOT in Excel (${inDBNotInExcel.length}):`);
inDBNotInExcel.forEach(code => console.log(`   - ${code}`));

// Find codes in PRF Analysis but NOT in Database
const inPRFNotInDB = prfCOAList.filter(code => !databaseCOAList.includes(code));
console.log(`\n❌ In PRF Analysis but NOT in Database (${inPRFNotInDB.length}):`);
inPRFNotInDB.forEach(code => console.log(`   - ${code}`));

console.log('\n✅ COMMON CODES ANALYSIS');
console.log('='.repeat(60));

// Find codes common to all three sources
const commonToAll = cleanUserList.filter(code => 
    prfCOAList.includes(code) && databaseCOAList.includes(code)
);
console.log(`\n✅ Common to ALL sources (${commonToAll.length}):`);
commonToAll.forEach(code => console.log(`   - ${code}`));

// Find codes common to Excel and PRF
const commonExcelPRF = cleanUserList.filter(code => prfCOAList.includes(code));
console.log(`\n✅ Common to Excel and PRF (${commonExcelPRF.length}):`);
commonExcelPRF.forEach(code => console.log(`   - ${code}`));

console.log('\n🎯 RECOMMENDATION');
console.log('='.repeat(60));
console.log('The most complete and accurate COA source appears to be:');
if (cleanUserList.length > prfCOAList.length) {
    console.log('📊 USER\'S EXCEL - Contains the most comprehensive list');
} else {
    console.log('📄 PRF ANALYSIS - Contains the most current data');
}

console.log('\n📋 NEXT STEPS:');
console.log('1. Use the most complete source as the master COA list');
console.log('2. Update database with missing COA codes');
console.log('3. Verify which codes are actually being used in current PRF data');