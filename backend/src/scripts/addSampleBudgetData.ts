import { executeQuery, connectDatabase } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function addSampleBudgetData() {
  try {
    console.log('🔄 Adding sample budget data...');
    
    // Connect to database first
    await connectDatabase();
    console.log('✅ Database connected successfully');
    
    const sqlPath = path.join(__dirname, '../../database/sample-budget-data.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

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
          // Don't exit on error, continue with next batch
          console.log('⚠️ Continuing with next batch...');
        }
      }
    }
    
    console.log('🎉 Sample budget data setup completed!');
    console.log('✅ ChartOfAccounts entries added');
    console.log('✅ Budget allocations created');
    
  } catch (error) {
    console.error('❌ Sample budget data setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  addSampleBudgetData();
}

export { addSampleBudgetData };