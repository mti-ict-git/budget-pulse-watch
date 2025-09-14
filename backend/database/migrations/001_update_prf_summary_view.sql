-- Migration: Update vw_PRFSummary to include Excel import fields
-- Date: 2025-09-14
-- Description: Add Excel import fields to the PRF summary view

USE PRFMonitoringDB;
GO

-- Drop existing view
IF OBJECT_ID('vw_PRFSummary', 'V') IS NOT NULL
    DROP VIEW vw_PRFSummary;
GO

-- Recreate view with Excel import fields
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
    p.UpdatedAt
FROM PRF p
INNER JOIN Users u ON p.RequestorID = u.UserID
INNER JOIN ChartOfAccounts coa ON p.COAID = coa.COAID;
GO

PRINT 'Migration completed: vw_PRFSummary updated with Excel import fields';
GO