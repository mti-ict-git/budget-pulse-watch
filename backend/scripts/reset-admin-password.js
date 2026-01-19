// Reset the mti.admin password using a simple script patterned after backend/scripts utilities
// Usage:
//   node backend/scripts/reset-admin-password.js "NewStrongPassword123!"

const sql = require('mssql');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: require('path').join(__dirname, '../.env.staging') });

// Prefer environment variables, fall back to known workspace defaults
const config = {
  server: process.env.DB_SERVER || process.env.DB_HOST || '10.60.10.47',
  database: process.env.DB_NAME || 'PRFMonitoringDB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'Bl4ck3y34dmin',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: (process.env.DB_ENCRYPT || 'true') === 'true',
    trustServerCertificate: (process.env.DB_TRUST_CERT || 'true') === 'true',
    enableArithAbort: true,
    requestTimeout: 30000,
    connectTimeout: 30000,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function resetAdminPassword() {
  const newPassword = process.argv[2];
  const username = 'mti.admin';

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 8) {
    console.error('❌ Please provide a new password (min length 8).');
    console.error('   Example: node backend/scripts/reset-admin-password.js "NewStrongPassword123!"');
    process.exit(1);
  }

  try {
    console.log('🔐 Generating bcrypt hash...');
    const saltRounds = parseInt(process.env.SALT_ROUNDS || '12', 10);
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    console.log('🔧 Connecting to database...');
    const pool = await sql.connect(config);

    console.log(`🔄 Updating password for user: ${username}`);
    const updateResult = await pool
      .request()
      .input('PasswordHash', sql.NVarChar, passwordHash)
      .input('Username', sql.NVarChar, username)
      .query(
        `UPDATE Users SET PasswordHash = @PasswordHash, UpdatedAt = GETDATE()
         WHERE Username = @Username AND IsActive = 1`
      );

    const affected = Array.isArray(updateResult.rowsAffected) ? updateResult.rowsAffected[0] : updateResult.rowsAffected;
    if (affected && affected > 0) {
      console.log('✅ Password updated successfully.');
    } else {
      console.warn('⚠️ No rows were updated. The user may be inactive or not exist.');
    }

    console.log('🔍 Verifying update...');
    const verify = await pool
      .request()
      .input('Username', sql.NVarChar, username)
      .query(`SELECT Username, Email, Role, IsActive, UpdatedAt FROM Users WHERE Username = @Username`);

    if (verify.recordset && verify.recordset.length > 0) {
      console.log('User info (sanitized):', verify.recordset[0]);
    } else {
      console.log('User not found for verification.');
    }

    await sql.close();
    console.log('✅ Done. You can now log in with the new password.');
  } catch (err) {
    console.error('❌ Error resetting password:', err);
    try { await sql.close(); } catch (_) {}
    process.exit(1);
  }
}

resetAdminPassword();