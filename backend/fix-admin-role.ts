import { executeQuery, connectDatabase } from './src/config/database';

async function fixAdminRole() {
  try {
    console.log('🔧 Connecting to database...');
    await connectDatabase();
    console.log('🔧 Fixing admin user role...');
    
    // Check current role
    const checkQuery = `SELECT Username, Role FROM Users WHERE Username = 'mti.admin'`;
    const currentUser = await executeQuery(checkQuery);
    
    if (currentUser.recordset.length === 0) {
      console.log('❌ Admin user not found');
      return;
    }
    
    console.log('Current admin user:', currentUser.recordset[0]);
    
    // Update role to lowercase
    const updateQuery = `
      UPDATE Users 
      SET Role = 'admin', UpdatedAt = GETDATE() 
      WHERE Username = 'mti.admin' AND Role != 'admin'
    `;
    
    const result = await executeQuery(updateQuery);
    console.log('Update result:', result.rowsAffected);
    
    // Verify the update
    const verifyQuery = `SELECT Username, Role FROM Users WHERE Username = 'mti.admin'`;
    const updatedUser = await executeQuery(verifyQuery);
    console.log('✅ Updated admin user:', updatedUser.recordset[0]);
    
  } catch (error) {
    console.error('❌ Error fixing admin role:', error);
  }
}

fixAdminRole().then(() => {
  console.log('✅ Admin role fix completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});