IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncReplaceItem') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncReplaceItem BIT NOT NULL CONSTRAINT DF_AppSettings_ProntoSyncReplaceItem DEFAULT 0
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncAddMissingItem') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncAddMissingItem BIT NOT NULL CONSTRAINT DF_AppSettings_ProntoSyncAddMissingItem DEFAULT 0
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncSyncItemDescription') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncSyncItemDescription BIT NOT NULL CONSTRAINT DF_AppSettings_ProntoSyncSyncItemDescription DEFAULT 0
END
GO
