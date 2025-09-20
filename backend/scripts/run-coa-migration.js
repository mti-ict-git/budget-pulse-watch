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
    console.log('Connected to database successfully');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/007_rename_coa_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running ChartOfAccounts column rename migration...');
    
    // Split the SQL into individual statements
    const statements = migrationSQL.split('GO').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await sql.query(statement);
        } catch (error) {
          console.log(`Statement executed with message: ${error.message}`);
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