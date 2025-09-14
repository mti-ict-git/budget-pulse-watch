import { executeQuery, connectDatabase } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Starting migration: Remove PRFNumber column...');
    
    // Connect to database first
    await connectDatabase();
    console.log('✅ Database connected successfully');
    
    const migrationPath = path.join(__dirname, '../../database/migrations/002_remove_prfnumber_column.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL by GO statements and execute each batch
    const batches = sql.split(/\bGO\b/gi)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0 && !batch.startsWith('--') && !batch.startsWith('USE'));
    
    console.log(`📝 Found ${batches.length} SQL batches to execute`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (batch.trim()) {
        console.log(`⚡ Executing batch ${i + 1}/${batches.length}...`);
        console.log(`SQL: ${batch.substring(0, 100)}...`);
        
        try {
          await executeQuery(batch);
          console.log(`✅ Batch ${i + 1} completed successfully`);
        } catch (error) {
          console.error(`❌ Error in batch ${i + 1}:`, error);
          console.error('Aborting migration due to error.');
          process.exit(1);
        }
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log('✅ PRFNumber column has been removed');
    console.log('✅ PRFNo is now the primary business identifier');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration();
}

export { runMigration };