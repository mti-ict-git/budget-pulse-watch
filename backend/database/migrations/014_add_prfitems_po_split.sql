USE PRFMonitoringDB;
GO

IF COL_LENGTH('dbo.PRFItems', 'OriginalPONumber') IS NULL
BEGIN
  ALTER TABLE dbo.PRFItems ADD OriginalPONumber NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.PRFItems', 'SplitPONumber') IS NULL
BEGIN
  ALTER TABLE dbo.PRFItems ADD SplitPONumber NVARCHAR(50) NULL;
END
GO

PRINT 'Migration completed: PRFItems PO split columns added';
GO
