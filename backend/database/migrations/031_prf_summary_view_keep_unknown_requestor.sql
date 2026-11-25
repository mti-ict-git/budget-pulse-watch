-- vw_PRFSummary inner-joined Users and ChartOfAccounts, so a PRF whose requestor or COA is missing
-- disappeared from the PRF list, the detail view and the Pronto sync. Found 2026-11-25: PRF 50117
-- has RequestorID 0 (no such user). Both joins become LEFT JOINs; RequestorName falls back to SubmitBy.
-- Columns and their order are unchanged. Rollback: re-run migration 025's view definition.
CREATE OR ALTER VIEW dbo.vw_PRFSummary AS
SELECT
    p.PRFID, p.PRFNo, p.Title, p.Department, p.RequestedAmount, p.ApprovedAmount,
    p.Status, p.Priority, p.RequestDate, p.RequiredDate,
    COALESCE(u.FirstName + ' ' + u.LastName, p.SubmitBy) AS RequestorName,
    coa.COACode, coa.COAName, DATEDIFF(day, p.RequestDate, GETDATE()) AS DaysOpen,
    p.DateSubmit, p.SubmitBy, p.SumDescriptionRequested, p.ProjectArea,
    p.PurchaseCostCode, p.RequiredFor, p.BudgetYear, p.Description, p.UpdatedAt,
    p.ApprovedByName
FROM dbo.PRF p
LEFT JOIN dbo.Users u ON p.RequestorID = u.UserID
LEFT JOIN dbo.ChartOfAccounts coa ON p.COAID = coa.COAID;
GO
