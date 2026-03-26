-- Rollback: Remove ApprovedByName from PRF

USE PRFMonitoringDB;
GO

BEGIN TRY
    EXEC sys.sp_dropextendedproperty
        @name = N'MS_Description',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE',  @level1name = N'PRF',
        @level2type = N'COLUMN', @level2name = N'ApprovedByName';
END TRY
BEGIN CATCH
END CATCH
GO

IF COL_LENGTH('dbo.PRF', 'ApprovedByName') IS NOT NULL
BEGIN
    ALTER TABLE dbo.PRF DROP COLUMN ApprovedByName;
END
GO

PRINT 'Rollback completed: ApprovedByName removed from PRF';
GO
