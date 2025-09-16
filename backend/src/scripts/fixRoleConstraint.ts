import { executeQuery, connectDatabase } from '../config/database';

async function fixRoleConstraint() {
  try {
    console.log('🔄 Starting role constraint fix...');
    
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected successfully');
    
    // Step 1: Drop the existing constraint by its actual name
    console.log('🔄 Dropping existing constraint CK__LDAPUserAc__Role__160F4887...');
    try {
      await executeQuery(`ALTER TABLE LDAPUserAccess DROP CONSTRAINT CK__LDAPUserAc__Role__160F4887`);
      console.log('✅ Dropped existing constraint');
    } catch (error) {
      console.log('⚠️ Constraint may not exist or already dropped:', error);
    }
    
    // Step 2: Update existing role values to lowercase
    console.log('🔄 Updating role values to lowercase...');
    const updateResult = await executeQuery(`
      UPDATE LDAPUserAccess 
      SET Role = CASE 
        WHEN Role = 'Admin' THEN 'admin'
        WHEN Role = 'Manager' THEN 'doccon'
        WHEN Role = 'User' THEN 'user'
        WHEN Role = 'DocCon' THEN 'doccon'
        ELSE LOWER(Role)
      END
      WHERE Role NOT IN ('admin', 'doccon', 'user')
    `);
    console.log(`✅ Updated ${updateResult.rowsAffected[0]} role values`);
    
    // Step 3: Add new constraint with correct values
    console.log('🔄 Adding new constraint...');
    await executeQuery(`
      ALTER TABLE LDAPUserAccess 
      ADD CONSTRAINT CK_LDAPUserAccess_Role 
      CHECK (Role IN ('admin', 'doccon', 'user'))
    `);
    console.log('✅ Added new constraint: CK_LDAPUserAccess_Role');
    
    // Step 4: Verify the fix
    console.log('🔍 Verifying constraint...');
    const verifyResult = await executeQuery<{ConstraintName: string, ConstraintDefinition: string}>(`
      SELECT 
        cc.name AS ConstraintName,
        cc.definition AS ConstraintDefinition
      FROM sys.check_constraints cc
      JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
      JOIN sys.tables t ON cc.parent_object_id = t.object_id
      WHERE t.name = 'LDAPUserAccess' AND c.name = 'Role'
    `);
    
    if (verifyResult.recordset.length > 0) {
      console.log('✅ Current Role constraint:');
      verifyResult.recordset.forEach(constraint => {
        console.log(`   Name: ${constraint.ConstraintName}`);
        console.log(`   Definition: ${constraint.ConstraintDefinition}`);
      });
    } else {
      console.log('⚠️ No Role constraint found');
    }
    
    // Step 5: Check current role values
    console.log('🔍 Checking current role values...');
    const roleResult = await executeQuery<{Role: string, Count: number}>(`
      SELECT DISTINCT Role, COUNT(*) as Count 
      FROM LDAPUserAccess 
      GROUP BY Role
    `);
    
    console.log('📊 Current role distribution:');
    roleResult.recordset.forEach(role => {
      console.log(`   ${role.Role}: ${role.Count} users`);
    });
    
    // Step 6: Test the constraint by attempting a valid update
    console.log('🧪 Testing constraint with valid role update...');
    try {
      await executeQuery(`
        UPDATE LDAPUserAccess 
        SET Role = 'user' 
        WHERE Role = 'user' AND Username = (
          SELECT TOP 1 Username FROM LDAPUserAccess WHERE Role = 'user'
        )
      `);
      console.log('✅ Constraint allows valid role values');
    } catch (error) {
      console.log('❌ Constraint test failed:', error);
    }
    
    console.log('🎉 Role constraint fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Role constraint fix failed:', error);
    throw error;
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixRoleConstraint()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export default fixRoleConstraint;