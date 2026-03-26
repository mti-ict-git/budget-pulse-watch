-- Rollback: Remove Notifications table

USE PRFMonitoringDB;
GO

IF OBJECT_ID('dbo.Notifications', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.Notifications;
END
GO

PRINT 'Rollback completed: Notifications table removed';
GO
