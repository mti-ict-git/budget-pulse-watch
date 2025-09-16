import { executeQuery, connectDatabase } from '../config/database';

async function updateRoleValues() {
  try {
    console.log('🔄 Updating remaining uppercase role values...');
    
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected successfully');
    
    // Update User to user
    const result = await executeQuery(`
      UPDATE LDAPUserAccess 
      SET Role = 'user' 
      WHERE Role = 'User'
    `);
    
    console.log(`✅ Updated ${result.rowsAffected[0]} users from 'User' to 'user'`);
    
    // Verify all roles are now lowercase
    const roleResult = await executeQuery<{Role: string, Count: number}>(`
      SELECT DISTINCT Role, COUNT(*) as Count 
      FROM LDAPUserAccess 
      GROUP BY Role
    `);
    
    console.log('📊 Final role distribution:');
    roleResult.recordset.forEach(role => {
      console.log(`   ${role.Role}: ${role.Count} users`);
    });
    
    console.log('🎉 Role values update completed successfully!');
    
  } catch (error) {
    console.error('❌ Role values update failed:', error);
    throw error;
  }
}

// Run the update if this script is executed directly
if (require.main === module) {
  updateRoleValues()
    .then(() => {
      console.log('🎉 Update completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Update failed:', error);
      process.exit(1);
    });
}

export default updateRoleValues;