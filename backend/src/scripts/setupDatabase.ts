import { executeQuery, connectDatabase } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function setupDatabase() {
  try {
    console.log('🔄 Starting database setup...');
    
    // Connect to database first
    await connectDatabase();
    console.log('✅ Database connected successfully');
    
    // Check if LDAPUserAccess table exists
    const checkTableQuery = `
      SELECT COUNT(*) as TableCount
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'LDAPUserAccess'
    `;
    
    const result = await executeQuery<{ TableCount: number }>(checkTableQuery);
    const tableExists = result.recordset[0]?.TableCount > 0;
    
    if (tableExists) {
      console.log('✅ LDAPUserAccess table already exists');
      return;
    }
    
    console.log('📋 LDAPUserAccess table not found, creating from schema...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Extract only the LDAPUserAccess table creation and indexes
    const ldapTableMatch = schemaSql.match(
      /-- LDAP User Access table[\s\S]*?CREATE TABLE LDAPUserAccess[\s\S]*?;[\s\S]*?CREATE INDEX[\s\S]*?ON LDAPUserAccess\(Role\);/
    );
    
    if (!ldapTableMatch) {
      throw new Error('Could not find LDAPUserAccess table definition in schema.sql');
    }
    
    const ldapTableSql = ldapTableMatch[0];
    
    // Split by GO statements and execute each batch
    const batches = ldapTableSql.split(/\bGO\b/gi)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0);
    
    console.log(`📝 Found ${batches.length} SQL batches to execute`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (batch.trim()) {
        console.log(`⚡ Executing batch ${i + 1}/${batches.length}...`);
        
        try {
          await executeQuery(batch);
          console.log(`✅ Batch ${i + 1} completed successfully`);
        } catch (error) {
          console.error(`❌ Error in batch ${i + 1}:`, error);
          console.error('Aborting setup due to error.');
          process.exit(1);
        }
      }
    }
    
    // Verify table was created
    const verifyResult = await executeQuery<{ TableCount: number }>(checkTableQuery);
    const tableCreated = verifyResult.recordset[0]?.TableCount > 0;
    
    if (tableCreated) {
      console.log('🎉 Database setup completed successfully!');
      console.log('✅ LDAPUserAccess table has been created');
      console.log('✅ Indexes have been created');
    } else {
      throw new Error('Table creation verification failed');
    }
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupDatabase();
}

export { setupDatabase };