const { executeQuery, connectDatabase } = require('../dist/config/database');
const fs = require('fs');
const path = require('path');

async function runScript() {
  try {
    await connectDatabase();
    console.log('Connected to database');
    
    const sqlPath = path.join(__dirname, '../database/fix-budget-and-spending.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by GO statements and execute each batch
    const batches = sql.split(/\bGO\b/gi)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0);
    
    console.log(`Found ${batches.length} SQL batches to execute`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (batch.trim()) {
        console.log(`Executing batch ${i + 1}/${batches.length}...`);
        try {
          const result = await executeQuery(batch);
          if (result && result.recordset) {
            console.log('Result:', result.recordset);
          }
        } catch (batchError) {
          console.error(`Error in batch ${i + 1}:`, batchError.message);
          // Continue with next batch
        }
      }
    }
    
    console.log('Script completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runScript();