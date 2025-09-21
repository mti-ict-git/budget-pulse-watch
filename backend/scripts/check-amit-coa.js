const sql = require('mssql');
require('dotenv').config();

const config = {
    server: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
    }
};

async function checkAMITCOA() {
    try {
        console.log('🔌 Connecting to database...');
        await sql.connect(config);
        
        console.log('🔍 Checking for AMIT COA codes...');
        const result = await sql.query`
            SELECT COACode, COAName, Category 
            FROM ChartOfAccounts 
            WHERE COACode LIKE '%AMIT%NO1%' OR COACode LIKE '%AMITINO1%'
            ORDER BY COACode
        `;
        
        console.log(`\n📊 Found ${result.recordset.length} matching COA codes:`);
        if (result.recordset.length > 0) {
            result.recordset.forEach(row => {
                console.log(`   - ${row.COACode}: ${row.COAName} [${row.Category}]`);
            });
        } else {
            console.log('   No matching COA codes found in database');
        }
        
        // Also check for any AMIT codes
        const allAMITResult = await sql.query`
            SELECT COACode, COAName, Category 
            FROM ChartOfAccounts 
            WHERE COACode LIKE 'AMIT%'
            ORDER BY COACode
        `;
        
        console.log(`\n📋 All AMIT COA codes in database (${allAMITResult.recordset.length}):`);
        allAMITResult.recordset.forEach(row => {
            console.log(`   - ${row.COACode}: ${row.COAName} [${row.Category}]`);
        });
        
        // Show all COA codes to understand what's in the database
        const allCOAResult = await sql.query`
            SELECT COACode, COAName, Category 
            FROM ChartOfAccounts 
            ORDER BY COACode
        `;
        
        console.log(`\n📋 ALL COA codes in database (${allCOAResult.recordset.length}):`);
        allCOAResult.recordset.forEach((row, index) => {
            console.log(`${(index + 1).toString().padStart(2, '0')}. ${row.COACode}: ${row.COAName} [${row.Category}]`);
        });
        
        await sql.close();
        console.log('\n✅ Database check completed');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkAMITCOA();