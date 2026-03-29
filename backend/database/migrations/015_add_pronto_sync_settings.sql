IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncEnabled') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncEnabled BIT NOT NULL CONSTRAINT DF_AppSettings_ProntoSyncEnabled DEFAULT 0
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncHeaderEnabled') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncHeaderEnabled BIT NOT NULL CONSTRAINT DF_AppSettings_ProntoSyncHeaderEnabled DEFAULT 1
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncItemsEnabled') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncItemsEnabled BIT NOT NULL CONSTRAINT DF_AppSettings_ProntoSyncItemsEnabled DEFAULT 1
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncBudgetYear') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncBudgetYear INT NULL
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncIntervalMinutes') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncIntervalMinutes INT NOT NULL CONSTRAINT DF_AppSettings_ProntoSyncIntervalMinutes DEFAULT 60
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncApply') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncApply BIT NOT NULL CONSTRAINT DF_AppSettings_ProntoSyncApply DEFAULT 0
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncMaxPrfs') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncMaxPrfs INT NULL
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncLimit') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncLimit INT NOT NULL CONSTRAINT DF_AppSettings_ProntoSyncLimit DEFAULT 1000
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncLogEvery') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncLogEvery INT NOT NULL CONSTRAINT DF_AppSettings_ProntoSyncLogEvery DEFAULT 25
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoHeadless') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoHeadless BIT NOT NULL CONSTRAINT DF_AppSettings_ProntoHeadless DEFAULT 1
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoCaptureScreenshots') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoCaptureScreenshots BIT NOT NULL CONSTRAINT DF_AppSettings_ProntoCaptureScreenshots DEFAULT 0
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoWritePerPoJson') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoWritePerPoJson BIT NOT NULL CONSTRAINT DF_AppSettings_ProntoWritePerPoJson DEFAULT 0
END
GO
