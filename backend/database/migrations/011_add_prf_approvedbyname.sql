-- Migration: Add ApprovedByName to PRF
-- Description: Stores external approver display name when user id is unavailable (e.g., Pronto sync)

USE PRFMonitoringDB;
GO

IF COL_LENGTH('dbo.PRF', 'ApprovedByName') IS NULL
BEGIN
    ALTER TABLE dbo.PRF
    ADD ApprovedByName NVARCHAR(200) NULL;
END
GO

BEGIN TRY
    EXEC sys.sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Approver display name from external system when ApprovedBy user id is not available',
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE',  @level1name = N'PRF',
        @level2type = N'COLUMN', @level2name = N'ApprovedByName';
END TRY
BEGIN CATCH
END CATCH
GO

PRINT 'Migration completed: ApprovedByName added to PRF';
GO
