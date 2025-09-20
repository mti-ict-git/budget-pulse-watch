-- Migration: Add missing fields to Budget table and create vw_BudgetSummary view
-- Date: 2025-01-20
-- Description: Add Department, BudgetType, Status, StartDate, EndDate fields to Budget table and create vw_BudgetSummary view

USE PRFMonitoringDB;
GO

-- Add missing fields to Budget table
ALTER TABLE Budget ADD 
    Department NVARCHAR(100) NULL,
    BudgetType NVARCHAR(50) DEFAULT 'Annual' NOT NULL,
    Status NVARCHAR(50) DEFAULT 'Active' NOT NULL,
    StartDate DATETIME2 NULL,
    EndDate DATETIME2 NULL,
    Description NVARCHAR(1000) NULL;
GO

-- Update existing records with default values
UPDATE Budget SET 
    Department = 'IT',
    BudgetType = 'Annual',
    Status = 'Active',
    StartDate = DATEFROMPARTS(FiscalYear, 1, 1),
    EndDate = DATEFROMPARTS(FiscalYear, 12, 31)
WHERE Department IS NULL;
GO

-- Create vw_BudgetSummary view
CREATE VIEW vw_BudgetSummary AS
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
FROM Budget b
INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID;
GO

PRINT 'Migration completed: Added missing fields to Budget table and created vw_BudgetSummary view';