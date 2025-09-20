import { executeQuery, connectDatabase } from '../config/database';
import { ldapService, LDAPUser } from '../services/ldapService';

interface PRFRecord {
  SubmitBy: string;
}

// Manual mapping for current database names to usernames
const nameToUsernameMapping: Record<string, string> = {
  'Peggy': 'peggy.putra',
  'Peggy Putra': 'peggy.putra',
  'Reni': 'reni.sitepu',
  'Reni Sitepu': 'reni.sitepu', 
  'Adhi': 'adhi.suhartman',
  'Adriana': 'adriana.rante',
  'Adriana ': 'adriana.rante',  // Handle trailing space
  'Adriana Rante': 'adriana.rante',
  'Widji': 'widji.santoso',
  'Widji Santoso': 'widji.santoso'
};



/**
 * Map current database name to username, then get standardized display name from AD
 * Flow: current name → username → AD display name
 * @param currentName - The current name from database
 * @param ldapUsers - Array of LDAP users with display names
 * @returns Standardized display name from AD or null if no match found
 */
function findBestMatch(currentName: string, ldapUsers: LDAPUser[]): string | null {
  const trimmedName = currentName.trim();
  
  // Step 1: Map current name to username
  const username = nameToUsernameMapping[trimmedName];
  if (username) {
    // Step 2: Find user in AD by username
    const user = ldapUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
      console.log(`   ✓ Mapped "${currentName}" → username: ${username} → AD display name: ${user.displayName}`);
      return user.displayName; // Return standardized display name from AD
    } else {
      console.log(`   ✗ Username "${username}" not found in AD for "${currentName}"`);
    }
  } else {
    console.log(`   ✗ No username mapping found for "${currentName}"`);
  }
  
  // If no exact mapping, try fuzzy matching on display names as fallback
  for (const user of ldapUsers) {
    const displayNameParts = user.displayName.toLowerCase().split(' ');
    const currentNameLower = trimmedName.toLowerCase();
    
    // Check if current name matches any part of the display name
    if (displayNameParts.some(part => part.includes(currentNameLower) || currentNameLower.includes(part))) {
      console.log(`   ✓ Fuzzy matched "${currentName}" → AD display name: ${user.displayName}`);
      return user.displayName; // Return standardized display name from AD
    }
  }
  
  console.log(`   ✗ No match found for "${currentName}"`);
  return null;
}



/**
 * Main function to update all PRF records
 */
async function updateAllPRFUsernames(dryRun: boolean = true): Promise<void> {
  try {
    console.log('🔄 Starting PRF display name standardization process...');
    console.log('📋 Flow: Current DB names → Usernames → AD Display Names → Update DB');
    
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');
    
    // Step 1: Get all unique SubmitBy values from PRF table
    console.log('\n📊 Step 1: Analyzing current database names...');
    const uniqueSubmitByQuery = `
      SELECT DISTINCT SubmitBy 
      FROM PRF 
      WHERE SubmitBy IS NOT NULL 
      AND SubmitBy != ''
      ORDER BY SubmitBy
    `;
    
    const uniqueSubmitByResult = await executeQuery<{ SubmitBy: string }>(uniqueSubmitByQuery, {});
    const uniqueSubmitByValues = uniqueSubmitByResult.recordset.map((row) => row.SubmitBy);
    
    console.log(`Found ${uniqueSubmitByValues.length} unique SubmitBy values:`);
    uniqueSubmitByValues.forEach(value => console.log(`   - "${value}"`));
    
    // Step 2: Get users from Active Directory for known usernames
    console.log('\n🔍 Step 2: Fetching users from Active Directory...');
    const knownUsernames = Object.values(nameToUsernameMapping);
    const ldapUsers: LDAPUser[] = [];
    
    for (const username of knownUsernames) {
      const users = await ldapService.searchUsers(username);
      ldapUsers.push(...users);
    }
    
    console.log(`Found ${ldapUsers.length} users in AD for known usernames`);
    
    // Step 3: Map current names to usernames, then get AD display names
    console.log('\n🔄 Step 3: Mapping current names → usernames → AD display names...');
    const updates: Array<{ from: string; to: string }> = [];
    
    for (const submitBy of uniqueSubmitByValues) {
      const standardizedDisplayName = findBestMatch(submitBy, ldapUsers);
      
      if (standardizedDisplayName && standardizedDisplayName !== submitBy) {
        updates.push({ from: submitBy, to: standardizedDisplayName });
      }
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`   Total unique values: ${uniqueSubmitByValues.length}`);
    console.log(`   Successful mappings: ${updates.length}`);
    console.log(`   Failed mappings: ${uniqueSubmitByValues.length - updates.length}`);
    
    if (updates.length === 0) {
      console.log('\n✅ No updates needed - all names are already standardized');
      return;
    }
    
    if (dryRun) {
      console.log('\n🔍 DRY RUN - No changes will be made to the database');
      console.log('\nProposed updates:');
      updates.forEach(update => {
        console.log(`   "${update.from}" → "${update.to}"`);
      });
      return;
    }
    
    // Step 4: Execute database updates
    console.log('\n💾 Step 4: Executing database updates...');
    let totalUpdated = 0;
    
    for (const update of updates) {
      const updateQuery = `
        UPDATE PRF 
        SET SubmitBy = @newValue 
        WHERE SubmitBy = @oldValue
      `;
      
      const result = await executeQuery(updateQuery, {
        newValue: update.to,
        oldValue: update.from
      });
      
      const rowsAffected = result.rowsAffected[0] || 0;
      totalUpdated += rowsAffected;
      
      console.log(`   ✓ Updated "${update.from}" → "${update.to}" (${rowsAffected} records)`);
    }
    
    console.log(`\n✅ Successfully updated ${totalUpdated} PRF records with AD display names`);
    
  } catch (error) {
    console.error('❌ Error updating PRF usernames:', error);
    throw error;
  }
}

// Export functions for use in other scripts
export {
  updateAllPRFUsernames,
  findBestMatch
};

// If running directly
if (require.main === module) {
  const dryRun = process.argv.includes('--live') ? false : true;
  
  updateAllPRFUsernames(dryRun)
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}