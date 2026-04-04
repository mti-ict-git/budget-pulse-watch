USE PRFMonitoringDB;
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncProgressJson') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncProgressJson NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncProgressUpdatedAt') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncProgressUpdatedAt DATETIME2 NULL;
END
GO

PRINT 'Migration completed: Added Pronto sync progress columns';
GO
