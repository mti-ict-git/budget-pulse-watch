-- Pronto Approval Status history per PO (original and split), synced by the Pronto worker
-- from PO E001 > Approval Status. Replaced per (PRFID, PONumber) on every sync.
IF OBJECT_ID('dbo.PRFProntoApprovalHistory', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PRFProntoApprovalHistory (
        HistoryID INT IDENTITY(1,1) PRIMARY KEY,
        PRFID INT NOT NULL,
        PONumber NVARCHAR(20) NOT NULL,
        EntrySeq INT NOT NULL,
        ApprovalUser NVARCHAR(200) NOT NULL,
        ActionAt DATETIME2 NULL,
        ActionAtRaw NVARCHAR(40) NULL,
        Status NVARCHAR(100) NOT NULL,
        Comment NVARCHAR(1000) NULL,
        SyncedAt DATETIME2 NOT NULL CONSTRAINT DF_PRFProntoApprovalHistory_SyncedAt DEFAULT GETDATE(),
        CONSTRAINT FK_PRFProntoApprovalHistory_PRF FOREIGN KEY (PRFID) REFERENCES dbo.PRF(PRFID) ON DELETE CASCADE,
        CONSTRAINT UQ_PRFProntoApprovalHistory_Entry UNIQUE (PRFID, PONumber, EntrySeq)
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_PRFProntoApprovalHistory_PRFID_ActionAt'
      AND object_id = OBJECT_ID('dbo.PRFProntoApprovalHistory')
)
BEGIN
    CREATE INDEX IX_PRFProntoApprovalHistory_PRFID_ActionAt
        ON dbo.PRFProntoApprovalHistory(PRFID, ActionAt);
END
GO
