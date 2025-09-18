-- Migration 006: Fix PRFItems Status CHECK constraint to match frontend values
-- Date: 2025-09-18
-- Description: Update the Status CHECK constraint to allow frontend status values

USE PRFMonitoringDB;
GO

PRINT 'Starting migration 006: Fix PRFItems Status CHECK constraint...';
GO

-- Find and drop the existing CHECK constraint on Status column
DECLARE @constraintName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

-- Get the constraint name dynamically
SELECT @constraintName = cc.name
FROM sys.check_constraints cc
JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name = 'PRFItems' AND c.name = 'Status';

IF @constraintName IS NOT NULL
BEGIN
    SET @sql = N'ALTER TABLE dbo.PRFItems DROP CONSTRAINT ' + QUOTENAME(@constraintName) + N';';
    EXEC sp_executesql @sql;
    PRINT 'Dropped existing Status CHECK constraint: ' + @constraintName;
END
ELSE
BEGIN
    PRINT 'No existing Status CHECK constraint found.';
END
GO

-- Add new constraint with frontend status values
ALTER TABLE PRFItems 
ADD CONSTRAINT CK_PRFItems_Status 
CHECK (Status IN ('Pending', 'Approved', 'Picked Up', 'On Hold', 'Cancelled'));

PRINT 'Added new Status CHECK constraint with frontend values: Pending, Approved, Picked Up, On Hold, Cancelled';
GO

-- Verify the constraint
SELECT 
    cc.name AS ConstraintName,
    cc.definition AS ConstraintDefinition
FROM sys.check_constraints cc
JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name = 'PRFItems' AND c.name = 'Status';

PRINT 'Migration 006 completed: PRFItems Status constraint updated to match frontend values';
GO