-- Migration 004: Remove Status CHECK constraint to allow any Excel values
-- Date: 2025-09-14
-- Description: Remove the CHECK constraint on PRF.Status column to allow importing exact Excel 'Status in Pronto' values

USE PRFMonitoringDB;
GO

PRINT 'Starting migration 004: Remove Status CHECK constraint...';
GO

-- Find and drop the CHECK constraint on Status column
DECLARE @constraintName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

-- Get the constraint name dynamically
SELECT @constraintName = cc.name
FROM sys.check_constraints cc
JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name = 'PRF' AND c.name = 'Status';

IF @constraintName IS NOT NULL
BEGIN
    SET @sql = N'ALTER TABLE dbo.PRF DROP CONSTRAINT ' + QUOTENAME(@constraintName) + N';';
    EXEC sp_executesql @sql;
    PRINT 'Dropped Status CHECK constraint: ' + @constraintName;
END
ELSE
BEGIN
    PRINT 'No Status CHECK constraint found to drop.';
END
GO

-- Optionally, increase the Status column size to accommodate longer Excel values
ALTER TABLE dbo.PRF ALTER COLUMN Status NVARCHAR(100);
PRINT 'Increased Status column size to NVARCHAR(100)';
GO

PRINT 'Migration 004 completed: Status column can now accept any Excel values';
GO