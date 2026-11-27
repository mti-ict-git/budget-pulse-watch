-- Requests to "Acknowledge for approval" a requisition in Pronto from the Immediate Action page
-- (Phase 30). The Pronto worker claims pending requests one at a time and records the outcome.
-- RequestedByUserID has no foreign key: LDAP users sign in with an id from LDAPUserAccess.
-- The backend also creates these objects at startup (initializeDatabase.ts).
IF OBJECT_ID('dbo.ProntoQueueActionRequest', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProntoQueueActionRequest (
        RequestID INT IDENTITY(1,1) PRIMARY KEY,
        OrderNo NVARCHAR(20) NOT NULL,
        Action NVARCHAR(30) NOT NULL CONSTRAINT DF_ProntoQueueActionRequest_Action DEFAULT 'acknowledge',
        PRFID INT NULL,
        RequestedByUserID INT NULL,
        RequestedByName NVARCHAR(200) NULL,
        RequestedAt DATETIME2 NOT NULL,
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_ProntoQueueActionRequest_Status DEFAULT 'pending'
            CONSTRAINT CK_ProntoQueueActionRequest_Status
            CHECK (Status IN ('pending', 'running', 'done', 'skipped', 'failed', 'unverified')),
        Message NVARCHAR(1000) NULL,
        StartedAt DATETIME2 NULL,
        FinishedAt DATETIME2 NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProntoQueueActionRequest_Status_RequestedAt'
               AND object_id = OBJECT_ID('dbo.ProntoQueueActionRequest'))
    CREATE INDEX IX_ProntoQueueActionRequest_Status_RequestedAt
        ON dbo.ProntoQueueActionRequest(Status, RequestedAt);
GO
