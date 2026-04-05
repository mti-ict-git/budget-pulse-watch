IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncRunNowPrfNosJson') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncRunNowPrfNosJson NVARCHAR(MAX) NULL
END
GO
