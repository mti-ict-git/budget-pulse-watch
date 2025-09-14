-- Rollback Migration: Remove Excel-based fields from PRF table
-- Date: 2025-09-14
-- Description: Rollback script to remove Excel fields if needed

USE PRFMonitoringDB;
GO

-- Drop indexes first
DROP INDEX IF EXISTS IX_PRF_DateSubmit ON PRF;
DROP INDEX IF EXISTS IX_PRF_SubmitBy ON PRF;
DROP INDEX IF EXISTS IX_PRF_PRFNo ON PRF;
DROP INDEX IF EXISTS IX_PRF_PurchaseCostCode ON PRF;
DROP INDEX IF EXISTS IX_PRF_BudgetYear ON PRF;
GO

-- Remove extended properties (comments)
EXEC sp_dropextendedproperty 
    @name = N'MS_Description', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'DateSubmit';

EXEC sp_dropextendedproperty 
    @name = N'MS_Description', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'SubmitBy';

EXEC sp_dropextendedproperty 
    @name = N'MS_Description', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'PRFNo';

EXEC sp_dropextendedproperty 
    @name = N'MS_Description', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'SumDescriptionRequested';

EXEC sp_dropextendedproperty 
    @name = N'MS_Description', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'PurchaseCostCode';

EXEC sp_dropextendedproperty 
    @name = N'MS_Description', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'RequiredFor';

EXEC sp_dropextendedproperty 
    @name = N'MS_Description', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'PRF', 
    @level2type = N'COLUMN', @level2name = N'BudgetYear';
GO

-- Restore original PRF summary view
DROP VIEW IF EXISTS vw_PRFSummary;
GO

CREATE VIEW vw_PRFSummary AS
SELECT 
    p.PRFID,
    p.PRFNumber,
    p.Title,
    p.Department,
    p.RequestedAmount,
    p.ApprovedAmount,
    p.Status,
    p.Priority,
    p.RequestDate,
    p.RequiredDate,
    u.FirstName + ' ' + u.LastName AS RequestorName,
    coa.COACode,
    coa.COAName,
    DATEDIFF(day, p.RequestDate, GETDATE()) AS DaysOpen
FROM PRF p
INNER JOIN Users u ON p.RequestorID = u.UserID
INNER JOIN ChartOfAccounts coa ON p.COAID = coa.COAID;
GO

-- Remove the Excel fields from PRF table
ALTER TABLE PRF DROP COLUMN 
    DateSubmit,
    SubmitBy,
    PRFNo,
    SumDescriptionRequested,
    PurchaseCostCode,
    RequiredFor,
    BudgetYear;
GO

PRINT 'Rollback completed: Removed Excel fields from PRF table';
GO