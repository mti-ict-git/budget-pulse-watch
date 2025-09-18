-- Rollback Migration: Remove status tracking fields from PRF Items
-- Date: 2025-09-18
-- Description: Remove status, picked up by, and tracking fields from PRF items

-- Remove extended properties
EXEC sp_dropextendedproperty 
    @name = N'MS_Description', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRFItems', 
    @level2type = N'COLUMN', @level2name = N'Status';

EXEC sp_dropextendedproperty 
    @name = N'MS_Description', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRFItems', 
    @level2type = N'COLUMN', @level2name = N'PickedUpBy';

EXEC sp_dropextendedproperty 
    @name = N'MS_Description', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRFItems', 
    @level2type = N'COLUMN', @level2name = N'PickedUpDate';

EXEC sp_dropextendedproperty 
    @name = N'MS_Description', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRFItems', 
    @level2type = N'COLUMN', @level2name = N'Notes';

-- Drop indexes
DROP INDEX IF EXISTS IX_PRFItems_Status ON PRFItems;
DROP INDEX IF EXISTS IX_PRFItems_PickedUpBy ON PRFItems;
DROP INDEX IF EXISTS IX_PRFItems_UpdatedAt ON PRFItems;

-- Drop foreign key constraint
ALTER TABLE PRFItems DROP CONSTRAINT IF EXISTS FK_PRFItems_UpdatedBy;

-- Remove the status tracking columns
ALTER TABLE PRFItems DROP COLUMN 
    Status,
    PickedUpBy,
    PickedUpDate,
    Notes,
    UpdatedAt,
    UpdatedBy;

GO

PRINT 'Rollback completed: Removed status tracking fields from PRFItems table';