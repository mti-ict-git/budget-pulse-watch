import { executeQuery, connectDatabase } from '../config/database';

async function verifyDisplayNames(): Promise<void> {
  try {
    console.log('🔍 Verifying updated display names...');
    
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');
    console.log('');
    
    // Get current SubmitBy values with counts
    const query = `
      SELECT SubmitBy, COUNT(*) as Count
      FROM PRF 
      WHERE SubmitBy IS NOT NULL 
      AND SubmitBy != ''
      GROUP BY SubmitBy
      ORDER BY Count DESC, SubmitBy
    `;
    
    const result = await executeQuery<{ SubmitBy: string; Count: number }>(query, {});
    
    console.log('📊 Current SubmitBy values after migration:');
    console.log('');
    
    let totalRecords = 0;
    result.recordset.forEach((row) => {
      console.log(`   ${row.SubmitBy}: ${row.Count} records`);
      totalRecords += row.Count;
    });
    
    console.log('');
    console.log(`📈 Total records with SubmitBy: ${totalRecords}`);
    
    // Check for standardized names
    const standardizedNames = [
      'Adriana Rante',
      'Peggy Putra', 
      'Reni Sitepu',
      'Widji Santoso'
    ];
    
    console.log('');
    console.log('✅ Standardized names found:');
    
    let standardizedCount = 0;
    standardizedNames.forEach((name) => {
      const record = result.recordset.find(r => r.SubmitBy === name);
      if (record) {
        console.log(`   ✓ ${name}: ${record.Count} records`);
        standardizedCount += record.Count;
      } else {
        console.log(`   ✗ ${name}: 0 records`);
      }
    });
    
    console.log('');
    console.log(`📊 Summary:`);
    console.log(`   Standardized records: ${standardizedCount}`);
    console.log(`   Non-standardized records: ${totalRecords - standardizedCount}`);
    console.log(`   Success rate: ${((standardizedCount / totalRecords) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Error verifying display names:', error);
    throw error;
  }
}

// If running directly
if (require.main === module) {
  verifyDisplayNames()
    .then(() => {
      console.log('');
      console.log('✅ Verification completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Verification failed:', error);
      process.exit(1);
    });
}

export { verifyDisplayNames };