-- Migration: Add status tracking fields to PRF Items
-- Date: 2025-09-18
-- Description: Add status, picked up by, and tracking fields to PRF items

USE PRFMonitoringDB;
GO

IF COL_LENGTH('dbo.PRFItems', 'Status') IS NULL
BEGIN
  ALTER TABLE dbo.PRFItems ADD Status NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.PRFItems', 'PickedUpBy') IS NULL
BEGIN
  ALTER TABLE dbo.PRFItems ADD PickedUpBy NVARCHAR(200) NULL;
END
GO

IF COL_LENGTH('dbo.PRFItems', 'PickedUpDate') IS NULL
BEGIN
  ALTER TABLE dbo.PRFItems ADD PickedUpDate DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.PRFItems', 'Notes') IS NULL
BEGIN
  ALTER TABLE dbo.PRFItems ADD Notes NVARCHAR(1000) NULL;
END
GO

IF COL_LENGTH('dbo.PRFItems', 'UpdatedAt') IS NULL
BEGIN
  ALTER TABLE dbo.PRFItems ADD UpdatedAt DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.PRFItems', 'UpdatedBy') IS NULL
BEGIN
  ALTER TABLE dbo.PRFItems ADD UpdatedBy INT NULL;
END
GO

-- Add foreign key for UpdatedBy
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PRFItems_UpdatedBy')
BEGIN
  ALTER TABLE dbo.PRFItems
  ADD CONSTRAINT FK_PRFItems_UpdatedBy
  FOREIGN KEY (UpdatedBy) REFERENCES dbo.Users(UserID);
END
GO

-- Add indexes for better performance
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRFItems_Status' AND object_id = OBJECT_ID('dbo.PRFItems'))
  CREATE INDEX IX_PRFItems_Status ON dbo.PRFItems(Status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRFItems_PickedUpBy' AND object_id = OBJECT_ID('dbo.PRFItems'))
  CREATE INDEX IX_PRFItems_PickedUpBy ON dbo.PRFItems(PickedUpBy);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRFItems_UpdatedAt' AND object_id = OBJECT_ID('dbo.PRFItems'))
  CREATE INDEX IX_PRFItems_UpdatedAt ON dbo.PRFItems(UpdatedAt);
GO

PRINT 'Migration completed: Added status tracking fields to PRFItems table';
