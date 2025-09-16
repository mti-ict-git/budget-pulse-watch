-- Fix Role Constraint Migration
-- Date: 2025-09-16
-- Description: Fix the Role CHECK constraint for LDAPUserAccess table

USE PRFMonitoringDB;
GO

PRINT 'Starting Role constraint fix migration...';
GO

-- Find and drop existing Role CHECK constraint
DECLARE @constraintName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

-- Get the constraint name dynamically
SELECT @constraintName = cc.name
FROM sys.check_constraints cc
JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name = 'LDAPUserAccess' AND c.name = 'Role';

IF @constraintName IS NOT NULL
BEGIN
    SET @sql = N'ALTER TABLE dbo.LDAPUserAccess DROP CONSTRAINT ' + QUOTENAME(@constraintName) + N';';
    EXEC sp_executesql @sql;
    PRINT 'Dropped existing Role CHECK constraint: ' + @constraintName;
END
ELSE
BEGIN
    PRINT 'No existing Role CHECK constraint found.';
END
GO

-- Update existing role values to lowercase
UPDATE LDAPUserAccess 
SET Role = CASE 
    WHEN Role = 'Admin' THEN 'admin'
    WHEN Role = 'Manager' THEN 'doccon'
    WHEN Role = 'User' THEN 'user'
    WHEN Role = 'DocCon' THEN 'doccon'
    ELSE LOWER(Role)
END
WHERE Role NOT IN ('admin', 'doccon', 'user');

PRINT 'Updated existing role values to lowercase format';
GO

-- Add new constraint with correct role values
ALTER TABLE LDAPUserAccess 
ADD CONSTRAINT CK_LDAPUserAccess_Role 
CHECK (Role IN ('admin', 'doccon', 'user'));

PRINT 'Added new Role CHECK constraint: CK_LDAPUserAccess_Role';
GO

-- Verify the constraint
SELECT 
    cc.name AS ConstraintName,
    cc.definition AS ConstraintDefinition
FROM sys.check_constraints cc
JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name = 'LDAPUserAccess' AND c.name = 'Role';

PRINT 'Role constraint fix migration completed successfully';
GO