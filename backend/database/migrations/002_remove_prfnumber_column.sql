-- Migration: Remove redundant PRFNumber column
-- Date: 2025-09-14
-- Description: Remove PRFNumber column and use PRFNo as the primary business identifier
-- Reason: PRFID serves as primary key, PRFNo from Excel is the business identifier

USE PRFMonitoringDB;
GO

-- Step 1: Update any existing data to ensure PRFNo is populated
-- Copy PRFNumber to PRFNo where PRFNo is null (backup existing data)
UPDATE PRF 
SET PRFNo = PRFNumber 
WHERE PRFNo IS NULL AND PRFNumber IS NOT NULL;
GO

-- Step 2: Drop the unique constraint on PRFNumber (compat-friendly)
IF EXISTS (SELECT 1 FROM sys.objects WHERE type = 'UQ' AND name = 'UQ_PRF_PRFNumber')
BEGIN
  ALTER TABLE dbo.PRF DROP CONSTRAINT UQ_PRF_PRFNumber;
END
GO

-- Step 3: Update views that reference PRFNumber (use CREATE OR ALTER)
IF OBJECT_ID('dbo.vw_PRFSummary', 'V') IS NOT NULL
BEGIN
  DROP VIEW dbo.vw_PRFSummary;
END
GO

CREATE OR ALTER VIEW dbo.vw_PRFSummary AS
SELECT 
    p.PRFID,
    p.PRFNo,                          -- Use PRFNo instead of PRFNumber
    p.Title,
    p.Department,
    p.RequestedAmount,
    p.ApprovedAmount,
    p.Status,
    p.Priority,
    p.RequestDate,
    p.DateSubmit,
    p.SubmitBy,
    p.SumDescriptionRequested,
    p.PurchaseCostCode,
    p.RequiredFor,
    p.BudgetYear,
    u.FirstName + ' ' + u.LastName AS RequestorName,
    coa.COACode,
    coa.COAName,
    DATEDIFF(day, p.RequestDate, GETDATE()) AS DaysOpen
FROM dbo.PRF p
INNER JOIN dbo.Users u ON p.RequestorID = u.UserID
INNER JOIN dbo.ChartOfAccounts coa ON p.COAID = coa.COAID;
GO

-- Step 4: Remove the PRFNumber column if it exists
IF EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'PRFNumber' AND Object_ID = Object_ID(N'dbo.PRF'))
BEGIN
  ALTER TABLE dbo.PRF DROP COLUMN PRFNumber;
END
GO

-- Step 5: Add unique constraint on PRFNo (business identifier) if missing
IF NOT EXISTS (
  SELECT 1 FROM sys.objects WHERE type = 'UQ' AND name = 'UQ_PRF_PRFNo'
)
BEGIN
  ALTER TABLE dbo.PRF ADD CONSTRAINT UQ_PRF_PRFNo UNIQUE (PRFNo);
END
GO

-- Step 6: Create index on PRFNo for performance if missing
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'IX_PRF_PRFNo_Lookup' AND object_id = OBJECT_ID('dbo.PRF')
)
BEGIN
  CREATE INDEX IX_PRF_PRFNo_Lookup ON dbo.PRF(PRFNo);
END
GO

PRINT 'Migration completed: Removed redundant PRFNumber column, using PRFNo as business identifier';
GO