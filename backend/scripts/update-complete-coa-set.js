const fs = require('fs');
const sql = require('mssql');

// Database configuration
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

async function updateCompleteCOASet() {
    let pool;
    
    try {
        console.log('🔄 Starting complete COA set update...');
        
        // Read PRF analysis data
        const prfData = JSON.parse(fs.readFileSync('../prf-analysis.json', 'utf8'));
        const prfCOACodes = [...new Set(prfData.prfRecords.map(record => record['Purchase Cost Code']).filter(code => code && code.trim()))];
        
        console.log(`📊 Found ${prfCOACodes.length} unique COA codes in PRF analysis`);
        
        // Connect to database
        pool = await sql.connect(config);
        console.log('✅ Connected to database');
        
        // Get current COA codes
        const currentResult = await pool.request().query('SELECT COACode FROM ChartOfAccounts ORDER BY COACode');
        const currentCOACodes = currentResult.recordset.map(row => row.COACode);
        
        console.log(`📋 Current database has ${currentCOACodes.length} COA codes`);
        
        // Find missing codes
        const missingCodes = prfCOACodes.filter(code => !currentCOACodes.includes(code));
        
        if (missingCodes.length === 0) {
            console.log('✅ All COA codes are already in the database!');
            return;
        }
        
        console.log(`🔍 Found ${missingCodes.length} missing COA codes:`);
        missingCodes.forEach(code => console.log(`   - ${code}`));
        
        // Insert missing COA codes
        console.log('\n🚀 Inserting missing COA codes...');
        
        for (const coaCode of missingCodes) {
            try {
                await pool.request()
                    .input('COACode', sql.VarChar(50), coaCode)
                    .input('COAName', sql.VarChar(200), `Account ${coaCode}`)
                    .input('Description', sql.VarChar(500), `Auto-generated account for ${coaCode}`)
                    .input('Category', sql.VarChar(100), 'General')
                    .input('IsActive', sql.Bit, 1)
                    .query(`
                        INSERT INTO ChartOfAccounts (COACode, COAName, Description, Category, IsActive, CreatedAt)
                        VALUES (@COACode, @COAName, @Description, @Category, @IsActive, GETDATE())
                    `);
                
                console.log(`   ✅ Inserted: ${coaCode}`);
            } catch (error) {
                console.error(`   ❌ Failed to insert ${coaCode}:`, error.message);
            }
        }
        
        // Verify final count
        const finalResult = await pool.request().query('SELECT COUNT(*) as total FROM ChartOfAccounts');
        const finalCount = finalResult.recordset[0].total;
        
        console.log(`\n📊 Final COA count: ${finalCount}`);
        console.log('✅ COA update completed successfully!');
        
        // Create Budget entries for new COA codes
        console.log('\n🔄 Creating Budget entries for new COA codes...');
        
        for (const coaCode of missingCodes) {
            try {
                // Get the COAID for this COACode
                const coaResult = await pool.request()
                    .input('COACode', sql.VarChar(50), coaCode)
                    .query('SELECT COAID FROM ChartOfAccounts WHERE COACode = @COACode');
                
                if (coaResult.recordset.length > 0) {
                    const coaId = coaResult.recordset[0].COAID;
                    
                    // Check if budget entry already exists
                    const existingBudget = await pool.request()
                        .input('COAID', sql.Int, coaId)
                        .query('SELECT COUNT(*) as count FROM Budget WHERE COAID = @COAID');
                    
                    if (existingBudget.recordset[0].count === 0) {
                        await pool.request()
                            .input('COAID', sql.Int, coaId)
                            .input('FiscalYear', sql.Int, new Date().getFullYear())
                            .input('Quarter', sql.Int, Math.ceil((new Date().getMonth() + 1) / 3))
                            .input('Month', sql.Int, new Date().getMonth() + 1)
                            .input('AllocatedAmount', sql.Decimal(15, 2), 0.00)
                            .input('UtilizedAmount', sql.Decimal(15, 2), 0.00)
                            .input('CreatedBy', sql.Int, 1) // Default admin user
                            .query(`
                                INSERT INTO Budget (COAID, FiscalYear, Quarter, Month, AllocatedAmount, UtilizedAmount, CreatedBy, CreatedAt, UpdatedAt)
                                VALUES (@COAID, @FiscalYear, @Quarter, @Month, @AllocatedAmount, @UtilizedAmount, @CreatedBy, GETDATE(), GETDATE())
                            `);
                        
                        console.log(`   ✅ Created budget entry for: ${coaCode} (ID: ${coaId})`);
                    } else {
                        console.log(`   ⏭️  Budget entry already exists for: ${coaCode}`);
                    }
                }
            } catch (error) {
                console.error(`   ❌ Failed to create budget entry for ${coaCode}:`, error.message);
            }
        }
        
        console.log('\n🎉 Complete COA and Budget update finished!');
        
    } catch (error) {
        console.error('❌ Error updating COA set:', error);
        throw error;
    } finally {
        if (pool) {
            await pool.close();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run the update
if (require.main === module) {
    updateCompleteCOASet()
        .then(() => {
            console.log('\n✅ Script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = { updateCompleteCOASet };