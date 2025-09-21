const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Database configuration
const config = {
    server: '10.60.10.47',
    database: 'PRFMonitoringDB',
    user: 'sa',
    password: 'Bl4ck3y34dmin',
    port: 1433,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function executeResetScript() {
    try {
        console.log('Connecting to database...');
        const pool = await sql.connect(config);
        
        console.log('Reading reset script...');
        const scriptPath = path.join(__dirname, 'reset-and-rebuild-coa.sql');
        const script = fs.readFileSync(scriptPath, 'utf8');
        
        // Split script by GO statements and execute each batch
        const batches = script.split(/\nGO\s*$/gm).filter(batch => batch.trim());
        
        console.log(`Executing ${batches.length} SQL batches...`);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch) {
                console.log(`Executing batch ${i + 1}/${batches.length}...`);
                try {
                    const result = await pool.request().query(batch);
                    if (result.recordset && result.recordset.length > 0) {
                        console.log('Result:', result.recordset);
                    }
                } catch (batchError) {
                    console.error(`Error in batch ${i + 1}:`, batchError.message);
                    console.error('Batch content:', batch.substring(0, 200) + '...');
                }
            }
        }
        
        console.log('Reset script execution completed successfully!');
        
    } catch (error) {
        console.error('Error executing reset script:', error);
    } finally {
        await sql.close();
    }
}

executeResetScript();