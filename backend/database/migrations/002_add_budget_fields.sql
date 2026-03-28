-- Migration: Add missing fields to Budget table and create vw_BudgetSummary view
-- Date: 2025-01-20
-- Description: Add Department, BudgetType, Status, StartDate, EndDate fields to Budget table and create vw_BudgetSummary view

USE PRFMonitoringDB;
GO

-- Add missing fields to Budget table
IF COL_LENGTH('dbo.Budget', 'Department') IS NULL
  ALTER TABLE dbo.Budget ADD Department NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Budget', 'BudgetType') IS NULL
  ALTER TABLE dbo.Budget ADD BudgetType NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Budget', 'Status') IS NULL
  ALTER TABLE dbo.Budget ADD Status NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Budget', 'StartDate') IS NULL
  ALTER TABLE dbo.Budget ADD StartDate DATETIME2 NULL;
IF COL_LENGTH('dbo.Budget', 'EndDate') IS NULL
  ALTER TABLE dbo.Budget ADD EndDate DATETIME2 NULL;
IF COL_LENGTH('dbo.Budget', 'Description') IS NULL
  ALTER TABLE dbo.Budget ADD Description NVARCHAR(1000) NULL;
GO

-- Update existing records with default values
UPDATE dbo.Budget SET 
  Department = COALESCE(Department, 'IT'),
  BudgetType = COALESCE(BudgetType, 'Annual'),
  Status = COALESCE(Status, 'Active'),
  StartDate = COALESCE(StartDate, DATEFROMPARTS(FiscalYear, 1, 1)),
  EndDate = COALESCE(EndDate, DATEFROMPARTS(FiscalYear, 12, 31))
WHERE Department IS NULL OR BudgetType IS NULL OR Status IS NULL OR StartDate IS NULL OR EndDate IS NULL;
GO

-- Create vw_BudgetSummary view
CREATE OR ALTER VIEW dbo.vw_BudgetSummary AS
SELECT 
    b.BudgetID,
    b.COAID,
    b.FiscalYear,
    b.Quarter,
    b.Month,
    coa.COACode as AccountCode,
    coa.COAName as AccountName,
    coa.Category,
    b.Department,
    b.BudgetType,
    b.AllocatedAmount,
    b.UtilizedAmount,
    b.RemainingAmount,
    b.UtilizationPercentage,
    b.Status,
    b.StartDate,
    b.EndDate,
    b.CreatedAt,
    b.UpdatedAt
FROM dbo.Budget b
INNER JOIN dbo.ChartOfAccounts coa ON b.COAID = coa.COAID;
GO

PRINT 'Migration completed: Added missing fields to Budget table and created vw_BudgetSummary view';
