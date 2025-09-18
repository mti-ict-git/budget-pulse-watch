-- Migration: Add StatusOverridden field to PRF Items
-- Date: 2025-09-18
-- Description: Add StatusOverridden flag to track when item status is manually set vs following PRF status

-- Add StatusOverridden field to PRFItems table
ALTER TABLE PRFItems ADD 
    StatusOverridden BIT DEFAULT 0 NOT NULL; -- FALSE = follows PRF status, TRUE = manually overridden

-- Add index for better performance
CREATE INDEX IX_PRFItems_StatusOverridden ON PRFItems(StatusOverridden);

-- Add extended property for documentation
EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Indicates if item status was manually overridden (1) or follows PRF status (0)',
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRFItems', 
    @level2type = N'COLUMN', @level2name = N'StatusOverridden';

GO

PRINT 'Migration completed: Added StatusOverridden field to PRFItems table';