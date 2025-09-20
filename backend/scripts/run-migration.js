const sql = require('mssql');
const fs = require('fs');
const path = require('path');

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

async function runMigration() {
  try {
    console.log('Connecting to database...');
    await sql.connect(config);
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '002_add_budget_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by GO statements and execute each batch
    const batches = migrationSQL.split(/\nGO\s*\n/i).filter(batch => batch.trim());
    
    console.log(`Executing ${batches.length} SQL batches...`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        console.log(`Executing batch ${i + 1}...`);
        await sql.query(batch);
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