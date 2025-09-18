import { executeQuery, connectDatabase } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function runStatusOverriddenMigration() {
  try {
    console.log('🔄 Starting migration: Add StatusOverridden field to PRFItems...');
    
    // Connect to database first
    await connectDatabase();
    console.log('✅ Database connected successfully');
    
    const migrationPath = path.join(__dirname, '../../database/migrations/005_add_status_overridden_to_prf_items.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL by GO statements and execute each batch
    const batches = sql.split(/\bGO\b/gi)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0 && !/^USE\s/i.test(batch));

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
    console.log('✅ StatusOverridden field has been added to PRFItems table');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runStatusOverriddenMigration();
}

export { runStatusOverriddenMigration };