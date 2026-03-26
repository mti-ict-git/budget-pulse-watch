-- Migration: Update vw_PRFSummary to include ApprovedByName
-- Description: Expose the new ApprovedByName field in the PRF summary view

USE PRFMonitoringDB;
GO

IF OBJECT_ID('vw_PRFSummary', 'V') IS NOT NULL
    DROP VIEW vw_PRFSummary;
GO

CREATE VIEW vw_PRFSummary AS
SELECT 
    p.PRFID,
    p.PRFNo,
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
    DATEDIFF(day, p.RequestDate, GETDATE()) AS DaysOpen,
    -- Excel import fields
    p.DateSubmit,
    p.SubmitBy,
    p.SumDescriptionRequested,
    p.PurchaseCostCode,
    p.RequiredFor,
    p.BudgetYear,
    p.Description,
    p.UpdatedAt,
    -- Added fields
    p.ApprovedByName
FROM PRF p
INNER JOIN Users u ON p.RequestorID = u.UserID
INNER JOIN ChartOfAccounts coa ON p.COAID = coa.COAID;
GO

PRINT 'Migration completed: vw_PRFSummary updated with ApprovedByName field';
GO
