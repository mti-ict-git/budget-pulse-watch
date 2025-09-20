const sql = require('mssql');
const fs = require('fs');
const path = require('path');
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

async function backupCOAData() {
    let pool;
    
    try {
        console.log('🔌 Connecting to database...');
        pool = await sql.connect(config);
        
        // Create backup directory if it doesn't exist
        const backupDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `coa-backup-${timestamp}.sql`);
        
        console.log('📋 Backing up ChartOfAccounts data...');
        
        // Get all COA data
        const coaQuery = 'SELECT * FROM ChartOfAccounts ORDER BY COAID';
        const coaResult = await pool.request().query(coaQuery);
        
        // Get all Budget data that references COA
        const budgetQuery = 'SELECT * FROM Budget ORDER BY BudgetID';
        const budgetResult = await pool.request().query(budgetQuery);
        
        console.log(`📊 Found ${coaResult.recordset.length} COA entries and ${budgetResult.recordset.length} budget entries`);
        
        // Generate SQL backup script
        let backupSQL = `-- COA and Budget Data Backup\n`;
        backupSQL += `-- Generated on: ${new Date().toISOString()}\n`;
        backupSQL += `-- Total COA entries: ${coaResult.recordset.length}\n`;
        backupSQL += `-- Total Budget entries: ${budgetResult.recordset.length}\n\n`;
        
        // Backup ChartOfAccounts
        backupSQL += `-- ChartOfAccounts Backup\n`;
        backupSQL += `-- DELETE FROM ChartOfAccounts; -- Uncomment to clear table before restore\n\n`;
        
        coaResult.recordset.forEach(row => {
            const values = [
                row.COAID,
                `'${row.COACode.replace(/'/g, "''")}'`,
                `'${row.COAName.replace(/'/g, "''")}'`,
                row.Category ? `'${row.Category.replace(/'/g, "''")}'` : 'NULL',
                row.ExpenseType ? `'${row.ExpenseType.replace(/'/g, "''")}'` : 'NULL',
                row.Department ? `'${row.Department.replace(/'/g, "''")}'` : 'NULL',
                row.CreatedAt ? `'${row.CreatedAt.toISOString()}'` : 'NULL'
            ];
            
            backupSQL += `INSERT INTO ChartOfAccounts (COAID, COACode, COAName, Category, ExpenseType, Department, CreatedAt) VALUES (${values.join(', ')});\n`;
        });
        
        backupSQL += `\n-- Budget Backup\n`;
        backupSQL += `-- DELETE FROM Budget; -- Uncomment to clear table before restore\n\n`;
        
        budgetResult.recordset.forEach(row => {
            const values = [
                row.BudgetID,
                row.COAID,
                row.AllocatedAmount || 0,
                row.SpentAmount || 0,
                row.RemainingAmount || 0,
                row.BudgetPeriod ? `'${row.BudgetPeriod.replace(/'/g, "''")}'` : 'NULL',
                row.CreatedAt ? `'${row.CreatedAt.toISOString()}'` : 'NULL',
                row.UpdatedAt ? `'${row.UpdatedAt.toISOString()}'` : 'NULL'
            ];
            
            backupSQL += `INSERT INTO Budget (BudgetID, COAID, AllocatedAmount, SpentAmount, RemainingAmount, BudgetPeriod, CreatedAt, UpdatedAt) VALUES (${values.join(', ')});\n`;
        });
        
        // Write backup file
        fs.writeFileSync(backupFile, backupSQL);
        
        console.log(`✅ Backup completed successfully!`);
        console.log(`📁 Backup file: ${backupFile}`);
        console.log(`📊 Backup contains:`);
        console.log(`   - ${coaResult.recordset.length} COA entries`);
        console.log(`   - ${budgetResult.recordset.length} budget entries`);
        
        // Also create a JSON backup for easier reading
        const jsonBackupFile = path.join(backupDir, `coa-backup-${timestamp}.json`);
        const jsonBackup = {
            timestamp: new Date().toISOString(),
            chartOfAccounts: coaResult.recordset,
            budget: budgetResult.recordset
        };
        
        fs.writeFileSync(jsonBackupFile, JSON.stringify(jsonBackup, null, 2));
        console.log(`📁 JSON backup: ${jsonBackupFile}`);
        
        return {
            sqlFile: backupFile,
            jsonFile: jsonBackupFile,
            coaCount: coaResult.recordset.length,
            budgetCount: budgetResult.recordset.length
        };
        
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
    backupCOAData()
        .then((result) => {
            console.log('\n🎉 Backup completed successfully!');
            console.log(`📁 Files created:`);
            console.log(`   - SQL: ${result.sqlFile}`);
            console.log(`   - JSON: ${result.jsonFile}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Backup failed:', error.message);
            process.exit(1);
        });
}

module.exports = { backupCOAData };