IF OBJECT_ID('dbo.BudgetCutoff', 'U') IS NULL
BEGIN
    CREATE TABLE BudgetCutoff (
        FiscalYear INT PRIMARY KEY,
        IsClosed BIT NOT NULL DEFAULT 0,
        ClosedAt DATETIME2 NULL,
        ClosedBy INT NULL,
        ReopenedAt DATETIME2 NULL,
        ReopenedBy INT NULL,
        Notes NVARCHAR(1000) NULL,
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_BudgetCutoff_ClosedBy FOREIGN KEY (ClosedBy) REFERENCES Users(UserID),
        CONSTRAINT FK_BudgetCutoff_ReopenedBy FOREIGN KEY (ReopenedBy) REFERENCES Users(UserID)
    );
END
GO

IF OBJECT_ID('dbo.BudgetCutoffAudit', 'U') IS NULL
BEGIN
    CREATE TABLE BudgetCutoffAudit (
        CutoffAuditID INT IDENTITY(1,1) PRIMARY KEY,
        FiscalYear INT NOT NULL,
        Action NVARCHAR(20) NOT NULL CHECK (Action IN ('CLOSE', 'REOPEN')),
        ActionBy INT NOT NULL,
        ActionAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        Notes NVARCHAR(1000) NULL,
        CONSTRAINT FK_BudgetCutoffAudit_FiscalYear FOREIGN KEY (FiscalYear) REFERENCES BudgetCutoff(FiscalYear),
        CONSTRAINT FK_BudgetCutoffAudit_ActionBy FOREIGN KEY (ActionBy) REFERENCES Users(UserID)
    );
END
GO

IF COL_LENGTH('dbo.PRFItems', 'PickedUpByUserID') IS NULL
BEGIN
    ALTER TABLE PRFItems ADD PickedUpByUserID INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_PRFItems_PickedUpByUserID'
)
BEGIN
    ALTER TABLE PRFItems
    ADD CONSTRAINT FK_PRFItems_PickedUpByUserID
    FOREIGN KEY (PickedUpByUserID) REFERENCES Users(UserID);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_BudgetCutoff_IsClosed'
      AND object_id = OBJECT_ID('dbo.BudgetCutoff')
)
BEGIN
    CREATE INDEX IX_BudgetCutoff_IsClosed ON BudgetCutoff(IsClosed);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_BudgetCutoffAudit_FiscalYear_ActionAt'
      AND object_id = OBJECT_ID('dbo.BudgetCutoffAudit')
)
BEGIN
    CREATE INDEX IX_BudgetCutoffAudit_FiscalYear_ActionAt ON BudgetCutoffAudit(FiscalYear, ActionAt);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_PRFItems_PickedUpByUserID'
      AND object_id = OBJECT_ID('dbo.PRFItems')
)
BEGIN
    CREATE INDEX IX_PRFItems_PickedUpByUserID ON PRFItems(PickedUpByUserID);
END
GO

PRINT 'Migration 008 completed';
