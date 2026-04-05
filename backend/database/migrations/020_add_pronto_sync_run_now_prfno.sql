IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncRunNowPrfNo') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncRunNowPrfNo NVARCHAR(50) NULL
END
GO
