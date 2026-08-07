USE PRFMonitoringDB;
GO

IF COL_LENGTH('dbo.PRF', 'ProjectArea') IS NULL
BEGIN
    ALTER TABLE dbo.PRF ADD ProjectArea NVARCHAR(100) NULL;
END;
GO

CREATE OR ALTER VIEW dbo.vw_PRFSummary AS
SELECT
    p.PRFID, p.PRFNo, p.Title, p.Department, p.RequestedAmount, p.ApprovedAmount,
    p.Status, p.Priority, p.RequestDate, p.RequiredDate,
    u.FirstName + ' ' + u.LastName AS RequestorName,
    coa.COACode, coa.COAName, DATEDIFF(day, p.RequestDate, GETDATE()) AS DaysOpen,
    p.DateSubmit, p.SubmitBy, p.SumDescriptionRequested, p.ProjectArea,
    p.PurchaseCostCode, p.RequiredFor, p.BudgetYear, p.Description, p.UpdatedAt,
    p.ApprovedByName
FROM dbo.PRF p
INNER JOIN dbo.Users u ON p.RequestorID = u.UserID
INNER JOIN dbo.ChartOfAccounts coa ON p.COAID = coa.COAID;
GO
