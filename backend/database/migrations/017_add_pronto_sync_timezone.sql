IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncTimeZone') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncTimeZone NVARCHAR(64) NULL
END
GO
