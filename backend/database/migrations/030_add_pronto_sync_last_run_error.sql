-- Last Pronto sync run: error message and whether it was a scheduled cycle or a run-now request.
-- The backend also adds these columns at startup (initializeDatabase.ts).
IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncLastRunError') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncLastRunError NVARCHAR(1000) NULL
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoSyncLastRunKind') IS NULL
BEGIN
  ALTER TABLE dbo.AppSettings ADD ProntoSyncLastRunKind NVARCHAR(20) NULL
END
GO
