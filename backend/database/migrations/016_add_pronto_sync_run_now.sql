IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncRunNowRequestedAt') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncRunNowRequestedAt DATETIME2 NULL
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncRunNowRequestedBy') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncRunNowRequestedBy NVARCHAR(100) NULL
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncLastRunStartedAt') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncLastRunStartedAt DATETIME2 NULL
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncLastRunFinishedAt') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncLastRunFinishedAt DATETIME2 NULL
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncLastRunExitCode') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncLastRunExitCode INT NULL
END
GO
