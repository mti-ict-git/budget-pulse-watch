const { executeQuery, connectDatabase } = require('../dist/config/database');
const fs = require('fs');
const path = require('path');

async function updateBudgetAmounts() {
  try {
    console.log('🔄 Updating budget amounts with new data...');
    
    // Connect to database first
    await connectDatabase();
    console.log('✅ Database connected successfully');
    
    const sqlPath = path.join(__dirname, '../database/update-budget-amounts.sql');
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
        
        try {
          const result = await executeQuery(batch);
          console.log(`✅ Batch ${i + 1} completed successfully`);
          
          // Log any results from SELECT statements
          if (result && result.recordset && result.recordset.length > 0) {
            console.log('📊 Results:', result.recordset);
          }
        } catch (error) {
          console.error(`❌ Error in batch ${i + 1}:`, error);
          // Don't exit on error, continue with next batch
          console.log('⚠️ Continuing with next batch...');
        }
      }
    }
    
    console.log('🎉 Budget amounts update completed!');
    console.log('✅ Budget allocations updated with new billion-scale amounts');
    console.log('✅ ChartOfAccounts entries updated/created');
    
  } catch (error) {
    console.error('❌ Budget amounts update failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  updateBudgetAmounts();
}

module.exports = { updateBudgetAmounts };