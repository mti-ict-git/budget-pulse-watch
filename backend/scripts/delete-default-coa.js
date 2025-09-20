const sql = require('mssql');
require('dotenv').config();

const config = {
    server: process.env.DB_HOST || '10.60.10.47',
    database: process.env.DB_NAME || 'PRFMonitoringDB',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Bl4ck3y34dmin',
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
    }
};

async function deleteDefaultCOA() {
    let pool;
    
    try {
        console.log('🔌 Connecting to database...');
        pool = await sql.connect(config);
        
        // First, let's check what we're about to delete
        console.log('\n📋 Checking default COA entries to delete...');
        
        const checkQuery = `
            SELECT COACode, COAName, Category 
            FROM ChartOfAccounts 
            WHERE COACode LIKE 'IT-%' 
               OR COACode LIKE 'MTIRMRAD496%'
            ORDER BY COACode
        `;
        
        const checkResult = await pool.request().query(checkQuery);
        
        if (checkResult.recordset.length === 0) {
            console.log('✅ No default COA entries found to delete.');
            return;
        }
        
        console.log(`\n🗑️  Found ${checkResult.recordset.length} default COA entries to delete:`);
        checkResult.recordset.forEach(row => {
            console.log(`   - ${row.COACode}: ${row.COAName} [${row.Category}]`);
        });
        
        // Check if any of these COA codes are referenced in Budget table
        console.log('\n🔍 Checking for budget references...');
        const budgetCheckQuery = `
            SELECT DISTINCT b.COAID, c.COACode, c.COAName
            FROM Budget b
            INNER JOIN ChartOfAccounts c ON b.COAID = c.COAID
            WHERE c.COACode LIKE 'IT-%' 
               OR c.COACode LIKE 'MTIRMRAD496%'
        `;
        
        const budgetCheckResult = await pool.request().query(budgetCheckQuery);
        
        if (budgetCheckResult.recordset.length > 0) {
            console.log(`⚠️  WARNING: Found ${budgetCheckResult.recordset.length} budget entries referencing these COA codes:`);
            budgetCheckResult.recordset.forEach(row => {
                console.log(`   - Budget COAID ${row.COAID}: ${row.COACode} (${row.COAName})`);
            });
            
            console.log('\n🗑️  Deleting budget entries first...');
            const deleteBudgetQuery = `
                DELETE FROM Budget 
                WHERE COAID IN (
                    SELECT COAID FROM ChartOfAccounts 
                    WHERE COACode LIKE 'IT-%' 
                       OR COACode LIKE 'MTIRMRAD496%'
                )
            `;
            
            const budgetDeleteResult = await pool.request().query(deleteBudgetQuery);
            console.log(`✅ Deleted ${budgetDeleteResult.rowsAffected[0]} budget entries.`);
        } else {
            console.log('✅ No budget references found.');
        }
        
        // Now delete the COA entries
        console.log('\n🗑️  Deleting default COA entries...');
        const deleteQuery = `
            DELETE FROM ChartOfAccounts 
            WHERE COACode LIKE 'IT-%' 
               OR COACode LIKE 'MTIRMRAD496%'
        `;
        
        const deleteResult = await pool.request().query(deleteQuery);
        console.log(`✅ Deleted ${deleteResult.rowsAffected[0]} COA entries.`);
        
        // Verify deletion
        console.log('\n🔍 Verifying deletion...');
        const verifyResult = await pool.request().query(checkQuery);
        
        if (verifyResult.recordset.length === 0) {
            console.log('✅ All default COA entries successfully deleted!');
        } else {
            console.log(`⚠️  Warning: ${verifyResult.recordset.length} entries still remain:`);
            verifyResult.recordset.forEach(row => {
                console.log(`   - ${row.COACode}: ${row.COAName}`);
            });
        }
        
        // Show final COA count
        const countQuery = 'SELECT COUNT(*) as total FROM ChartOfAccounts';
        const countResult = await pool.request().query(countQuery);
        console.log(`\n📊 Total COA entries remaining: ${countResult.recordset[0].total}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        if (pool) {
            await pool.close();
            console.log('\n🔌 Database connection closed.');
        }
    }
}

// Run the script
if (require.main === module) {
    deleteDefaultCOA()
        .then(() => {
            console.log('\n🎉 Default COA deletion completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = { deleteDefaultCOA };