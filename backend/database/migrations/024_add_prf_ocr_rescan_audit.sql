IF OBJECT_ID('dbo.PRFOCRRescanAudit', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PRFOCRRescanAudit (
        RescanAuditID INT IDENTITY(1,1) PRIMARY KEY,
        PRFID INT NOT NULL,
        FileID INT NOT NULL,
        AppliedBy INT NOT NULL,
        AppliedAt DATETIME2 NOT NULL CONSTRAINT DF_PRFOCRRescanAudit_AppliedAt DEFAULT GETDATE(),
        OCRConfidence DECIMAL(8,6) NULL,
        UpdatedItemCount INT NOT NULL CONSTRAINT DF_PRFOCRRescanAudit_UpdatedItemCount DEFAULT 0,
        AddedItemCount INT NOT NULL CONSTRAINT DF_PRFOCRRescanAudit_AddedItemCount DEFAULT 0,
        PreservedItemCount INT NOT NULL CONSTRAINT DF_PRFOCRRescanAudit_PreservedItemCount DEFAULT 0,
        BeforeSnapshot NVARCHAR(MAX) NOT NULL,
        AfterSnapshot NVARCHAR(MAX) NOT NULL,
        ExtractionSnapshot NVARCHAR(MAX) NOT NULL,
        CONSTRAINT FK_PRFOCRRescanAudit_PRF FOREIGN KEY (PRFID) REFERENCES dbo.PRF(PRFID),
        CONSTRAINT FK_PRFOCRRescanAudit_File FOREIGN KEY (FileID) REFERENCES dbo.PRFFiles(FileID),
        CONSTRAINT FK_PRFOCRRescanAudit_User FOREIGN KEY (AppliedBy) REFERENCES dbo.Users(UserID)
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_PRFOCRRescanAudit_PRFID_AppliedAt'
      AND object_id = OBJECT_ID('dbo.PRFOCRRescanAudit')
)
BEGIN
    CREATE INDEX IX_PRFOCRRescanAudit_PRFID_AppliedAt
        ON dbo.PRFOCRRescanAudit(PRFID, AppliedAt DESC);
END
GO
