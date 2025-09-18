-- Migration: Add status tracking fields to PRF Items
-- Date: 2025-09-18
-- Description: Add status, picked up by, and tracking fields to PRF items

-- Add status tracking fields to PRFItems table
ALTER TABLE PRFItems ADD 
    Status NVARCHAR(50) DEFAULT 'Pending' CHECK (Status IN ('Pending', 'Approved', 'Ordered', 'Received', 'Delivered', 'Cancelled')),
    PickedUpBy NVARCHAR(200) NULL, -- Who picked up the item
    PickedUpDate DATETIME2 NULL, -- When the item was picked up
    Notes NVARCHAR(1000) NULL, -- Additional notes about the item status
    UpdatedAt DATETIME2 DEFAULT GETDATE(), -- Track when item was last updated
    UpdatedBy INT NULL; -- Who last updated the item

-- Add foreign key for UpdatedBy
ALTER TABLE PRFItems ADD CONSTRAINT FK_PRFItems_UpdatedBy 
    FOREIGN KEY (UpdatedBy) REFERENCES Users(UserID);

-- Add indexes for better performance
CREATE INDEX IX_PRFItems_Status ON PRFItems(Status);
CREATE INDEX IX_PRFItems_PickedUpBy ON PRFItems(PickedUpBy);
CREATE INDEX IX_PRFItems_UpdatedAt ON PRFItems(UpdatedAt);

-- Add extended properties for documentation
EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Current status of the PRF item',
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRFItems', 
    @level2type = N'COLUMN', @level2name = N'Status';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Name of person who picked up the item',
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRFItems', 
    @level2type = N'COLUMN', @level2name = N'PickedUpBy';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Date and time when item was picked up',
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRFItems', 
    @level2type = N'COLUMN', @level2name = N'PickedUpDate';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', @value = N'Additional notes about item status or handling',
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRFItems', 
    @level2type = N'COLUMN', @level2name = N'Notes';

GO

PRINT 'Migration completed: Added status tracking fields to PRFItems table';