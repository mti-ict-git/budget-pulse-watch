-- Migration 003: Recreate PRF table without PRFNumber (drop-and-recreate with data preservation)
-- Date: 2025-09-14
-- Description: When dropping PRFNumber column is blocked, recreate PRF table without PRFNumber and preserve data/constraints

USE PRFMonitoringDB;
GO

PRINT 'Starting migration 003: Recreate PRF without PRFNumber...';
GO

-- 1) Drop dependent view if exists (will be recreated later)
IF OBJECT_ID('dbo.vw_PRFSummary', 'V') IS NOT NULL
BEGIN
  DROP VIEW dbo.vw_PRFSummary;
END
GO

-- 2) Drop FKs from known child tables that reference PRF (dynamic to handle unknown FK names)
DECLARE @fkName sysname, @parentSchema sysname, @parentTable sysname, @sql NVARCHAR(MAX);

DECLARE fk_cursor CURSOR FAST_FORWARD FOR
SELECT fk.name, SCHEMA_NAME(t.schema_id) AS parent_schema, t.name AS parent_table
FROM sys.foreign_keys fk
JOIN sys.tables t ON fk.parent_object_id = t.object_id
WHERE fk.referenced_object_id = OBJECT_ID('dbo.PRF')
  AND t.name IN ('PRFItems','PRFApprovals','BudgetTransactions');

OPEN fk_cursor;
FETCH NEXT FROM fk_cursor INTO @fkName, @parentSchema, @parentTable;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'ALTER TABLE ' + QUOTENAME(@parentSchema) + N'.' + QUOTENAME(@parentTable) + N' DROP CONSTRAINT ' + QUOTENAME(@fkName) + N';';
  EXEC sp_executesql @sql;
  FETCH NEXT FROM fk_cursor INTO @fkName, @parentSchema, @parentTable;
END
CLOSE fk_cursor; DEALLOCATE fk_cursor;
GO

-- 3) Create new PRF table with desired schema (without PRFNumber)
IF OBJECT_ID('dbo.PRF_New','U') IS NOT NULL DROP TABLE dbo.PRF_New;
GO

CREATE TABLE dbo.PRF_New (
    PRFID INT IDENTITY(1,1) PRIMARY KEY,
    PRFNo NVARCHAR(50) NOT NULL, -- Business identifier from Excel
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(2000),
    RequestorID INT NOT NULL,
    Department NVARCHAR(100) NOT NULL,
    COAID INT NOT NULL,
    RequestedAmount DECIMAL(15,2) NOT NULL,
    ApprovedAmount DECIMAL(15,2) NULL,
    ActualAmount DECIMAL(15,2) NULL,
    Priority NVARCHAR(20) DEFAULT 'Medium' CHECK (Priority IN ('Low', 'Medium', 'High', 'Critical')),
    Status NVARCHAR(20) DEFAULT 'Draft' CHECK (Status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed', 'Cancelled')),
    RequestDate DATETIME2 NOT NULL DEFAULT GETDATE(),
    RequiredDate DATETIME2,
    ApprovalDate DATETIME2 NULL,
    CompletionDate DATETIME2 NULL,
    ApprovedBy INT NULL,
    Justification NVARCHAR(2000),
    VendorName NVARCHAR(200),
    VendorContact NVARCHAR(500),
    AttachmentPath NVARCHAR(500),
    Notes NVARCHAR(2000),
    DateSubmit DATETIME2 NULL,
    SubmitBy NVARCHAR(200) NULL,
    SumDescriptionRequested NVARCHAR(1000) NULL,
    PurchaseCostCode NVARCHAR(50) NULL,
    RequiredFor NVARCHAR(500) NULL,
    BudgetYear INT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);
GO

-- 4) Copy data from old PRF into PRF_New (preserve PRFID and fallback PRFNo)
SET IDENTITY_INSERT dbo.PRF_New ON;
INSERT INTO dbo.PRF_New (
    PRFID, PRFNo, Title, Description, RequestorID, Department, COAID,
    RequestedAmount, ApprovedAmount, ActualAmount, Priority, Status,
    RequestDate, RequiredDate, ApprovalDate, CompletionDate, ApprovedBy,
    Justification, VendorName, VendorContact, AttachmentPath, Notes,
    DateSubmit, SubmitBy, SumDescriptionRequested, PurchaseCostCode, RequiredFor,
    BudgetYear, CreatedAt, UpdatedAt
)
SELECT
    p.PRFID,
    COALESCE(p.PRFNo, p.PRFNumber, 'MIG-' + CAST(p.PRFID AS NVARCHAR(20))) AS PRFNo,
    p.Title, p.Description, p.RequestorID, p.Department, p.COAID,
    p.RequestedAmount, p.ApprovedAmount, p.ActualAmount, p.Priority, p.Status,
    p.RequestDate, p.RequiredDate, p.ApprovalDate, p.CompletionDate, p.ApprovedBy,
    p.Justification, p.VendorName, p.VendorContact, p.AttachmentPath, p.Notes,
    p.DateSubmit, p.SubmitBy, p.SumDescriptionRequested, p.PurchaseCostCode, p.RequiredFor,
    p.BudgetYear, p.CreatedAt, p.UpdatedAt
FROM dbo.PRF AS p;
SET IDENTITY_INSERT dbo.PRF_New OFF;
GO

-- 5) Ensure PRFNo values are unique and not null (deduplicate if needed)
;WITH d AS (
    SELECT PRFID, PRFNo,
           ROW_NUMBER() OVER (PARTITION BY PRFNo ORDER BY PRFID) AS rn
    FROM dbo.PRF_New
)
UPDATE d
SET PRFNo = CASE WHEN rn = 1 THEN PRFNo ELSE PRFNo + '-' + CAST(rn AS NVARCHAR(10)) END
WHERE rn > 1;

UPDATE dbo.PRF_New SET PRFNo = 'MIG-' + CAST(PRFID AS NVARCHAR(20)) WHERE PRFNo IS NULL OR LTRIM(RTRIM(PRFNo)) = '';
GO

-- 6) Add unique constraint and indexes to PRF_New
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE type = 'UQ' AND name = 'UQ_PRF_PRFNo')
  ALTER TABLE dbo.PRF_New ADD CONSTRAINT UQ_PRF_PRFNo UNIQUE (PRFNo);
GO

CREATE INDEX IX_PRF_New_Status ON dbo.PRF_New(Status);
CREATE INDEX IX_PRF_New_RequestDate ON dbo.PRF_New(RequestDate);
CREATE INDEX IX_PRF_New_Department ON dbo.PRF_New(Department);
CREATE INDEX IX_PRF_New_COAID ON dbo.PRF_New(COAID);
GO

-- 7) Drop old PRF table and rename PRF_New -> PRF
DROP TABLE dbo.PRF;
GO

EXEC sp_rename 'dbo.PRF_New', 'PRF';
GO

-- 8) Recreate FKs on child tables pointing to new PRF
ALTER TABLE dbo.PRFItems WITH CHECK ADD CONSTRAINT FK_PRFItems_PRF FOREIGN KEY (PRFID) REFERENCES dbo.PRF(PRFID) ON DELETE CASCADE;
ALTER TABLE dbo.PRFApprovals WITH CHECK ADD CONSTRAINT FK_PRFApprovals_PRF FOREIGN KEY (PRFID) REFERENCES dbo.PRF(PRFID) ON DELETE CASCADE;
ALTER TABLE dbo.BudgetTransactions WITH CHECK ADD CONSTRAINT FK_BudgetTransactions_PRF FOREIGN KEY (PRFID) REFERENCES dbo.PRF(PRFID);
GO

-- 9) Recreate indexes with standard names on PRF
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRF_Status' AND object_id = OBJECT_ID('dbo.PRF'))
  CREATE INDEX IX_PRF_Status ON dbo.PRF(Status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRF_RequestDate' AND object_id = OBJECT_ID('dbo.PRF'))
  CREATE INDEX IX_PRF_RequestDate ON dbo.PRF(RequestDate);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRF_Department' AND object_id = OBJECT_ID('dbo.PRF'))
  CREATE INDEX IX_PRF_Department ON dbo.PRF(Department);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRF_COAID' AND object_id = OBJECT_ID('dbo.PRF'))
  CREATE INDEX IX_PRF_COAID ON dbo.PRF(COAID);
GO

-- 10) Recreate vw_PRFSummary to reference PRFNo
CREATE OR ALTER VIEW dbo.vw_PRFSummary AS
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

PRINT 'Migration 003 completed: Recreated PRF table without PRFNumber and preserved data.';
GO