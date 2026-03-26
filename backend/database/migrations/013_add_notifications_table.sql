-- Migration: Add Notifications table
-- Description: Creates a Notifications table for user alerts (e.g. PRF updates from Pronto)

USE PRFMonitoringDB;
GO

IF OBJECT_ID('dbo.Notifications', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Notifications (
        NotificationID INT IDENTITY(1,1) PRIMARY KEY,
        UserID INT NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Message NVARCHAR(1000) NOT NULL,
        ReferenceType NVARCHAR(50) NOT NULL, -- e.g., 'PRF'
        ReferenceID INT NULL,                -- e.g., PRFID
        IsRead BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
    );

    CREATE NONCLUSTERED INDEX IX_Notifications_UserID_IsRead ON dbo.Notifications(UserID, IsRead);
END
GO

PRINT 'Migration completed: Notifications table added';
GO
