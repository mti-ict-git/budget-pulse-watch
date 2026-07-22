-- Migration: add explicit carry-forward tracking for annual budget governance
-- Date: 2026-07-22

IF OBJECT_ID('dbo.BudgetCarryForward', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BudgetCarryForward (
        CarryForwardID INT IDENTITY(1,1) PRIMARY KEY,
        COAID INT NOT NULL,
        SourceBudgetID INT NULL,
        SourceFiscalYear INT NOT NULL,
        TargetFiscalYear INT NOT NULL,
        CarryForwardAmount DECIMAL(15,2) NOT NULL CHECK (CarryForwardAmount >= 0),
        CurrencyCode NVARCHAR(3) NOT NULL DEFAULT 'IDR' CHECK (CurrencyCode IN ('IDR', 'USD')),
        ExchangeRateToIDR DECIMAL(18,6) NOT NULL DEFAULT 1 CHECK (ExchangeRateToIDR > 0),
        Notes NVARCHAR(1000) NULL,
        ApprovedBy INT NOT NULL,
        ApprovedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_BudgetCarryForward_COAID FOREIGN KEY (COAID) REFERENCES dbo.ChartOfAccounts(COAID),
        CONSTRAINT FK_BudgetCarryForward_SourceBudgetID FOREIGN KEY (SourceBudgetID) REFERENCES dbo.Budget(BudgetID),
        CONSTRAINT FK_BudgetCarryForward_ApprovedBy FOREIGN KEY (ApprovedBy) REFERENCES dbo.Users(UserID),
        CONSTRAINT FK_BudgetCarryForward_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserID),
        CONSTRAINT UQ_BudgetCarryForward_CoaSourceTarget UNIQUE (COAID, SourceFiscalYear, TargetFiscalYear)
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_BudgetCarryForward_TargetFiscalYear'
      AND object_id = OBJECT_ID('dbo.BudgetCarryForward')
)
BEGIN
    CREATE INDEX IX_BudgetCarryForward_TargetFiscalYear
        ON dbo.BudgetCarryForward(TargetFiscalYear, COAID);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_BudgetCarryForward_SourceFiscalYear'
      AND object_id = OBJECT_ID('dbo.BudgetCarryForward')
)
BEGIN
    CREATE INDEX IX_BudgetCarryForward_SourceFiscalYear
        ON dbo.BudgetCarryForward(SourceFiscalYear, COAID);
END
GO
