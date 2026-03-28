USE PRFMonitoringDB;
GO

IF COL_LENGTH('dbo.PRFItems', 'SplitPONumber') IS NOT NULL
BEGIN
  ALTER TABLE dbo.PRFItems DROP COLUMN SplitPONumber;
END
GO

IF COL_LENGTH('dbo.PRFItems', 'OriginalPONumber') IS NOT NULL
BEGIN
  ALTER TABLE dbo.PRFItems DROP COLUMN OriginalPONumber;
END
GO

PRINT 'Rollback completed: PRFItems PO split columns removed';
GO
