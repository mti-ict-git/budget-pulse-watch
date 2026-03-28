-- Migration: Add StatusOverridden field to PRF Items
-- Date: 2025-09-18
-- Description: Add StatusOverridden flag to track when item status is manually set vs following PRF status

USE PRFMonitoringDB;
GO

IF COL_LENGTH('dbo.PRFItems', 'StatusOverridden') IS NULL
BEGIN
  ALTER TABLE dbo.PRFItems ADD StatusOverridden BIT NOT NULL DEFAULT 0;
END
GO

-- Add index for better performance
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRFItems_StatusOverridden' AND object_id = OBJECT_ID('dbo.PRFItems'))
  CREATE INDEX IX_PRFItems_StatusOverridden ON dbo.PRFItems(StatusOverridden);
GO

PRINT 'Migration completed: Added StatusOverridden field to PRFItems table';
