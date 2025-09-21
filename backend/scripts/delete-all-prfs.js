const sql = require('mssql');

// Database configuration
const dbConfig = {
  server: '10.60.10.47',
  database: 'PRFMonitoringDB',
  user: 'sa',
  password: 'Bl4ck3y34dmin',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 30000,
    connectionTimeout: 30000
  }
};

async function deleteAllPRFs() {
  let pool;
  
  try {
    console.log('🔌 Connecting to database...');
    pool = await sql.connect(dbConfig);
    
    // Get all PRF IDs
    console.log('📋 Getting all PRF IDs...');
    const result = await pool.request().query('SELECT PRFID FROM PRF ORDER BY PRFID');
    const prfIds = result.recordset.map(row => row.PRFID);
    
    console.log(`📊 Found ${prfIds.length} PRFs to delete`);
    
    if (prfIds.length === 0) {
      console.log('✅ No PRFs found to delete');
      return;
    }
    
    // Confirm deletion
    console.log('⚠️  WARNING: This will delete ALL PRFs and their associated data!');
    console.log('   - PRF records');
    console.log('   - PRF Items (CASCADE)');
    console.log('   - PRF Files metadata (CASCADE)');
    console.log('   - PRF Approvals (CASCADE)');
    console.log('   - Note: Files in shared folder will NOT be deleted');
    
    // Delete in batches to avoid timeout
    const batchSize = 50;
    let deletedCount = 0;
    
    for (let i = 0; i < prfIds.length; i += batchSize) {
      const batch = prfIds.slice(i, i + batchSize);
      console.log(`🗑️  Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(prfIds.length / batchSize)} (${batch.length} PRFs)...`);
      
      try {
        // Delete each PRF in the batch
        for (const prfId of batch) {
          const deleteResult = await pool.request()
            .input('PRFID', sql.Int, prfId)
            .query('DELETE FROM PRF WHERE PRFID = @PRFID');
          
          if (deleteResult.rowsAffected[0] > 0) {
            deletedCount++;
          }
        }
        
        console.log(`   ✅ Batch completed. Total deleted so far: ${deletedCount}`);
      } catch (batchError) {
        console.error(`   ❌ Error in batch:`, batchError.message);
      }
    }
    
    console.log(`\n🎉 Deletion completed!`);
    console.log(`   Total PRFs deleted: ${deletedCount}/${prfIds.length}`);
    
    // Verify deletion
    const verifyResult = await pool.request().query('SELECT COUNT(*) as RemainingCount FROM PRF');
    const remainingCount = verifyResult.recordset[0].RemainingCount;
    
    console.log(`   Remaining PRFs in database: ${remainingCount}`);
    
    if (remainingCount === 0) {
      console.log('✅ All PRFs successfully deleted!');
    } else {
      console.log('⚠️  Some PRFs may not have been deleted. Check the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
console.log('🚀 Starting PRF deletion script...');
deleteAllPRFs().then(() => {
  console.log('📝 Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});