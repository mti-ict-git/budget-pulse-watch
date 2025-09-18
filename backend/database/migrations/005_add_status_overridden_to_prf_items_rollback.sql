-- Rollback Migration: Remove StatusOverridden field from PRF Items
-- Date: 2025-09-18
-- Description: Rollback the StatusOverridden field addition

-- Drop index first
DROP INDEX IX_PRFItems_StatusOverridden ON PRFItems;

-- Remove extended property
EXEC sp_dropextendedproperty 
    @name = N'MS_Description',
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRFItems', 
    @level2type = N'COLUMN', @level2name = N'StatusOverridden';

-- Drop the StatusOverridden column
ALTER TABLE PRFItems DROP COLUMN StatusOverridden;

GO

PRINT 'Rollback completed: Removed StatusOverridden field from PRFItems table';