-- Migration: Add Excel-based fields to PRF table
-- Date: 2025-09-14
-- Description: Adds new fields from Excel analysis to support historical data import

USE PRFMonitoringDB;
GO

-- Add new columns to PRF table
ALTER TABLE PRF ADD 
    DateSubmit DATETIME2 NULL,                    -- Excel: "Date Submit"
    SubmitBy NVARCHAR(100) NULL,                  -- Excel: "Submit By"
    PRFNo NVARCHAR(50) NULL,                      -- Excel: "PRF No" (different from PRFNumber)
    SumDescriptionRequested NVARCHAR(500) NULL,   -- Excel: "Sum Description Requested"
    PurchaseCostCode NVARCHAR(50) NULL,           -- Excel: "Purchase Cost Code"
    RequiredFor NVARCHAR(200) NULL,               -- Excel: "Required for"
    BudgetYear INT NULL;                          -- Excel: "Budget" (Year)
GO

-- Add indexes for better performance on new fields
CREATE INDEX IX_PRF_DateSubmit ON PRF(DateSubmit);
CREATE INDEX IX_PRF_SubmitBy ON PRF(SubmitBy);
CREATE INDEX IX_PRF_PRFNo ON PRF(PRFNo);
CREATE INDEX IX_PRF_PurchaseCostCode ON PRF(PurchaseCostCode);
CREATE INDEX IX_PRF_BudgetYear ON PRF(BudgetYear);
GO

-- Update the PRF summary view to include new fields
DROP VIEW IF EXISTS vw_PRFSummary;
GO

CREATE VIEW vw_PRFSummary AS
SELECT 
    p.PRFID,
    p.PRFNumber,
    p.PRFNo,                          -- New field
    p.Title,
    p.Department,
    p.RequestedAmount,
    p.ApprovedAmount,
    p.Status,
    p.Priority,
    p.RequestDate,
    p.DateSubmit,                     -- New field
    p.RequiredDate,
    p.SubmitBy,                       -- New field
    p.SumDescriptionRequested,        -- New field
    p.PurchaseCostCode,               -- New field
    p.RequiredFor,                    -- New field
    p.BudgetYear,                     -- New field
    u.FirstName + ' ' + u.LastName AS RequestorName,
    coa.COACode,
    coa.COAName,
    DATEDIFF(day, p.RequestDate, GETDATE()) AS DaysOpen
FROM PRF p
INNER JOIN Users u ON p.RequestorID = u.UserID
INNER JOIN ChartOfAccounts coa ON p.COAID = coa.COAID;
GO

-- Add comments to document the new fields
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Date when PRF was submitted (from Excel import)', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'DateSubmit';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Person who submitted the PRF (from Excel import)', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'SubmitBy';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'PRF number from Excel (may differ from system PRFNumber)', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'PRFNo';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Summary description of requested items (from Excel import)', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'SumDescriptionRequested';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Purchase cost code for budget tracking (from Excel import)', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'PurchaseCostCode';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'What the purchase is required for (from Excel import)', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'RequiredFor';

EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Budget year for the PRF (from Excel import)', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'BudgetYear';

PRINT 'Migration completed: Added Excel fields to PRF table';
GO