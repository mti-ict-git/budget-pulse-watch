const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  }
};

async function fixDuplicateBudgets() {
  try {
    console.log('🔄 Connecting to database...');
    await sql.connect(config);
    console.log('✅ Connected to database');
    
    // First, let's see the duplicate entries
    console.log('\n📊 Checking for duplicate budget entries...');
    const duplicatesQuery = `
      SELECT 
        b.COAID,
        c.COACode,
        c.COAName,
        b.FiscalYear,
        b.Quarter,
        b.Month,
        COUNT(*) as EntryCount,
        STRING_AGG(CAST(b.AllocatedAmount AS VARCHAR), ', ') as AllocationAmounts,
        STRING_AGG(CAST(b.BudgetID AS VARCHAR), ', ') as BudgetIDs
      FROM Budget b
      JOIN ChartOfAccounts c ON b.COAID = c.COAID
      GROUP BY b.COAID, c.COACode, c.COAName, b.FiscalYear, b.Quarter, b.Month
      HAVING COUNT(*) > 1
      ORDER BY EntryCount DESC, c.COACode
    `;
    
    const duplicates = await sql.query(duplicatesQuery);
    console.log('Duplicate Budget Entries:');
    console.table(duplicates.recordset);
    
    if (duplicates.recordset.length === 0) {
      console.log('✅ No duplicate entries found!');
      return;
    }
    
    // For each set of duplicates, keep only the one with the highest allocation
    console.log('\n🔧 Removing duplicate entries (keeping highest allocation)...');
    
    for (const duplicate of duplicates.recordset) {
      const { COAID, FiscalYear, Quarter, Month } = duplicate;
      
      // Get all budget entries for this combination
      const entriesQuery = `
        SELECT BudgetID, AllocatedAmount, UtilizedAmount, CreatedAt
        FROM Budget 
        WHERE COAID = ${COAID} 
          AND FiscalYear = ${FiscalYear} 
          AND Quarter = ${Quarter} 
          AND Month = ${Month}
        ORDER BY AllocatedAmount DESC, CreatedAt DESC
      `;
      
      const entries = await sql.query(entriesQuery);
      const allEntries = entries.recordset;
      
      if (allEntries.length > 1) {
        // Keep the first one (highest allocation), delete the rest
        const keepEntry = allEntries[0];
        const deleteEntries = allEntries.slice(1);
        
        console.log(`\n📝 Processing ${duplicate.COACode} (${duplicate.COAName}):`);
        console.log(`   Keeping: BudgetID ${keepEntry.BudgetID} with allocation ${keepEntry.AllocatedAmount}`);
        console.log(`   Deleting: ${deleteEntries.length} duplicate entries`);
        
        // Delete the duplicate entries
        for (const entry of deleteEntries) {
          await sql.query`DELETE FROM Budget WHERE BudgetID = ${entry.BudgetID}`;
          console.log(`   ❌ Deleted BudgetID ${entry.BudgetID} (allocation: ${entry.AllocatedAmount})`);
        }
      }
    }
    
    console.log('\n✅ Duplicate cleanup completed!');
    
    // Verify the results
    console.log('\n📊 Verification - Budget Summary After Cleanup:');
    const summary = await sql.query`
      SELECT 
        COUNT(*) as TotalBudgets,
        SUM(AllocatedAmount) as TotalAllocated,
        AVG(AllocatedAmount) as AvgAllocated,
        MAX(AllocatedAmount) as MaxAllocated,
        MIN(AllocatedAmount) as MinAllocated
      FROM Budget
    `;
    console.table(summary.recordset);
    
    // Check the top allocations
    const topAllocations = await sql.query`
      SELECT TOP 10 
        c.COACode,
        c.COAName,
        b.AllocatedAmount,
        b.UtilizedAmount,
        b.FiscalYear,
        b.Quarter
      FROM Budget b
      JOIN ChartOfAccounts c ON b.COAID = c.COAID
      ORDER BY b.AllocatedAmount DESC
    `;
    console.log('\n🏆 Top 10 Budget Allocations After Cleanup:');
    console.table(topAllocations.recordset);
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await sql.close();
  }
}

fixDuplicateBudgets();