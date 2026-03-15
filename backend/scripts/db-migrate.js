const fs = require('fs');
const path = require('path');
const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_HOST || process.env.DB_SERVER || '10.60.10.47',
  database: process.env.DB_NAME || 'PRFMonitoringDB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  }
};

const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
const mode = (process.env.DB_MIGRATE_MODE || 'latest').toLowerCase();

const getMigrationFiles = () => {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .filter((file) => !file.toLowerCase().includes('rollback'))
    .map((file) => {
      const fullPath = path.join(migrationsDir, file);
      const stats = fs.statSync(fullPath);
      return { file, modifiedTime: stats.mtimeMs };
    })
    .sort((a, b) => {
      if (a.modifiedTime !== b.modifiedTime) {
        return a.modifiedTime - b.modifiedTime;
      }
      return a.file.localeCompare(b.file);
    })
    .map((entry) => entry.file);
  return files;
};

const splitBatches = (sqlText) => {
  return sqlText
    .split(/\bGO\b/gi)
    .map((batch) => batch.trim())
    .filter((batch) => batch.length > 0);
};

async function ensureMigrationTable(pool) {
  const query = `
    IF OBJECT_ID('dbo.SchemaMigrations', 'U') IS NULL
    BEGIN
      CREATE TABLE SchemaMigrations (
        MigrationID INT IDENTITY(1,1) PRIMARY KEY,
        FileName NVARCHAR(255) NOT NULL UNIQUE,
        AppliedAt DATETIME2 NOT NULL DEFAULT GETDATE()
      )
    END
  `;
  await pool.request().query(query);
}

async function getAppliedMigrations(pool) {
  const result = await pool.request().query('SELECT FileName FROM SchemaMigrations');
  return new Set(result.recordset.map((row) => row.FileName));
}

async function applyMigration(pool, fileName) {
  const migrationPath = path.join(migrationsDir, fileName);
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  const batches = splitBatches(migrationSQL);

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    console.log(`Executing ${fileName} batch ${index + 1}/${batches.length}`);
    await pool.request().query(batch);
  }

  await pool
    .request()
    .input('FileName', sql.NVarChar(255), fileName)
    .query('INSERT INTO SchemaMigrations (FileName) VALUES (@FileName)');

  console.log(`Applied migration: ${fileName}`);
}

async function run() {
  const files = getMigrationFiles();
  if (files.length === 0) {
    console.log('No migration files found');
    return;
  }

  const pool = await sql.connect(config);
  await ensureMigrationTable(pool);

  const applied = await getAppliedMigrations(pool);
  const unapplied = files.filter((file) => !applied.has(file));

  if (unapplied.length === 0) {
    console.log('No pending migrations');
    return;
  }

  const targets = mode === 'all' ? unapplied : [unapplied[unapplied.length - 1]];
  for (const fileName of targets) {
    await applyMigration(pool, fileName);
  }

  console.log(`Migration run completed in ${mode} mode`);
}

run()
  .catch((error) => {
    console.error('Migration run failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sql.close();
    } catch (error) {
      console.error('Failed to close SQL connection:', error);
    }
  });
