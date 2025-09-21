const sql = require('mssql');
const fs = require('fs');
const path = require('path');

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

async function runMigration() {
  try {
    console.log('Connecting to database...');
    await sql.connect(config);
    
    const migrationPath = path.join(__dirname, 'database', 'migrations', 'add_capex_opex_department.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    const batches = migrationSQL.split(/\nGO\s*\n/i).filter(batch => batch.trim());
    
    console.log(`Executing ${batches.length} SQL batches...`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        console.log(`Executing batch ${i + 1}...`);
        try {
          await sql.query(batch);
          console.log(`✅ Batch ${i + 1} completed`);
        } catch (error) {
          if (error.message.includes('already exists') || error.message.includes('Column names in each table must be unique')) {
            console.log(`⚠️ Batch ${i + 1} skipped (column already exists)`);
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.close();
  }
}

runMigration();