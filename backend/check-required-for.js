const { connectDatabase, executeQuery } = require('./dist/config/database');

async function checkRequiredForData() {
  try {
    await connectDatabase();
    console.log('Connected to database');
    
    const result = await executeQuery(`
      SELECT TOP 20 
        PRFNo,
        RequiredFor,
        Description
      FROM PRF 
      WHERE RequiredFor IS NOT NULL 
        AND RequiredFor != ''
      ORDER BY SubmitDate DESC
    `);
    
    console.log('\nRecent PRF Required For data:');
    console.log('='.repeat(80));
    result.recordset.forEach(row => {
      console.log(`PRF: ${row.PRFNo}`);
      console.log(`Required For: ${row.RequiredFor}`);
      console.log(`Description: ${row.Description?.substring(0, 100)}...`);
      console.log('-'.repeat(40));
    });
    
    // Check for the specific pattern
    const specificResult = await executeQuery(`
      SELECT COUNT(*) as count
      FROM PRF 
      WHERE RequiredFor LIKE '%FOR Supporting OHS%'
    `);
    
    console.log(`\nPRFs with 'FOR Supporting OHS' pattern: ${specificResult.recordset[0].count}`);
    
    // Check all unique Required For patterns
    const patternsResult = await executeQuery(`
      SELECT RequiredFor, COUNT(*) as count
      FROM PRF 
      WHERE RequiredFor IS NOT NULL 
        AND RequiredFor != ''
      GROUP BY RequiredFor
      ORDER BY count DESC
    `);
    
    console.log('\nAll Required For patterns:');
    console.log('='.repeat(80));
    patternsResult.recordset.forEach(row => {
      console.log(`"${row.RequiredFor}" - ${row.count} times`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkRequiredForData();