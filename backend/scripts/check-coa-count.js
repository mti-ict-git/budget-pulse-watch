const sql = require('mssql');
require('dotenv').config();

const config = {
    server: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'PRFMonitoringDB',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
    }
};

// User's COA list from pivot table
const userCOAList = [
    'MTIRMRAD416769',
    'MTIRMRHS606250',
    '51211325.6250',
    'AMITBD01',
    'AMITCM14.6718',
    'AMITCM16',
    'AMITCM16.6250',
    'AMITCM18.6250',
    'AMITCM19.6250',
    'AMITCM20.6250',
    'AMITCM21',
    'AMITCM21.6250',
    '"AMITCM21.6250"',
    'AMITCM22.6250',
    'AMITCM23',
    'AMITINO1.6250',
    'AMPLCM01.6250',
    'AMPLME05.6250',
    'MTIRMRAD416250',
    'MTIRMRAD426249',
    'MTIRMRAD496014',
    'MTIRMRAD496109',
    'MTIRMRAD496137',
    'MTIRMRAD496232',
    'MTIRMRAD496250',
    'MTIRMRAD496313',
    'MTIRMRAD496314',
    'MTIRMRAD496326',
    'MTIRMRAD4963265',
    'MTIRMRAD496328',
    'MTIRMRAD496769',
    'MTIRMRADA496328',
    'MTIRMRHR606014',
    'MTIRMRHS446250',
    'MTIRMRHS446279',
    'MTIRMRHS606250',
    'MTIRMRHS606279',
    'MTIRMRMT236137',
    'MTIRMRMT26',
    'MTIRMRMT26.6137',
    'MTIRMRMT266014',
    'MTIRMRMT266137',
    'MTIRMRMT266137',
    'MTIRMRMT266733',
    'MTIRMRMT266769',
    'MTIRMRPR226250',
    'MTIRMRPRA06250',
    'MTIRMRPRC06250',
    'MTIRMRPRD06769',
    'MTIRMRTS606250',
    'W0171197.6769'
];

async function checkCOACount() {
    try {
        console.log('🔍 Connecting to database...');
        await sql.connect(config);
        
        // Get total count from database
        const totalCountResult = await sql.query`
            SELECT COUNT(*) as TotalCOA FROM ChartOfAccounts WHERE IsActive = 1
        `;
        
        // Get all COA codes from database
        const allCOAResult = await sql.query`
            SELECT COACode, COAName, Category, CreatedAt
            FROM ChartOfAccounts 
            WHERE IsActive = 1
            ORDER BY COACode
        `;
        
        const dbCOACount = totalCountResult.recordset[0].TotalCOA;
        const dbCOACodes = allCOAResult.recordset.map(row => row.COACode);
        
        console.log('\n📊 COA COUNT ANALYSIS');
        console.log('='.repeat(50));
        console.log(`👤 User's COA list count: ${userCOAList.length}`);
        console.log(`🗄️  Database COA count: ${dbCOACount}`);
        console.log(`📈 Difference: ${dbCOACount - userCOAList.length}`);
        
        // Clean user's list (remove quotes and duplicates)
        const cleanUserList = [...new Set(userCOAList.map(code => code.replace(/"/g, '')))];
        console.log(`🧹 User's clean list count: ${cleanUserList.length}`);
        
        // Find codes in database but not in user's list
        const extraInDB = dbCOACodes.filter(code => !cleanUserList.includes(code));
        console.log(`\n➕ Extra codes in database (${extraInDB.length}):`);
        extraInDB.forEach(code => console.log(`   - ${code}`));
        
        // Find codes in user's list but not in database
        const missingInDB = cleanUserList.filter(code => !dbCOACodes.includes(code));
        console.log(`\n❌ Missing codes in database (${missingInDB.length}):`);
        missingInDB.forEach(code => console.log(`   - ${code}`));
        
        // Show duplicates in user's list
        const duplicates = userCOAList.filter((code, index) => userCOAList.indexOf(code) !== index);
        if (duplicates.length > 0) {
            console.log(`\n🔄 Duplicates in user's list (${duplicates.length}):`);
            duplicates.forEach(code => console.log(`   - ${code}`));
        }
        
        // Show all database COA codes for comparison
        console.log(`\n🗄️  All Database COA Codes (${dbCOACount}):`);
        allCOAResult.recordset.forEach((row, index) => {
            console.log(`${(index + 1).toString().padStart(2, '0')}. ${row.COACode} - ${row.COAName} [${row.Category || 'N/A'}]`);
        });
        
        await sql.close();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkCOACount();