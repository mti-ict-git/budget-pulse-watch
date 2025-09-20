-- Migration: Rename ChartOfAccounts columns to new standardized names
-- Date: 2025-09-20
-- Description: Rename AccountCode->COACode, AccountName->COAName, AccountType->Category, ParentAccountID->ParentCOAID

USE PRFMonitoringDB;
GO

PRINT 'Starting ChartOfAccounts column rename migration...';

-- Check if old columns exist before renaming
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ChartOfAccounts' AND COLUMN_NAME = 'AccountCode')
BEGIN
    PRINT 'Renaming AccountCode to COACode...';
    EXEC sp_rename 'ChartOfAccounts.AccountCode', 'COACode', 'COLUMN';
END
ELSE
BEGIN
    PRINT 'AccountCode column not found, skipping...';
END

IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ChartOfAccounts' AND COLUMN_NAME = 'AccountName')
BEGIN
    PRINT 'Renaming AccountName to COAName...';
    EXEC sp_rename 'ChartOfAccounts.AccountName', 'COAName', 'COLUMN';
END
ELSE
BEGIN
    PRINT 'AccountName column not found, skipping...';
END

IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ChartOfAccounts' AND COLUMN_NAME = 'AccountType')
BEGIN
    PRINT 'Renaming AccountType to Category...';
    EXEC sp_rename 'ChartOfAccounts.AccountType', 'Category', 'COLUMN';
END
ELSE
BEGIN
    PRINT 'AccountType column not found, skipping...';
END

IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ChartOfAccounts' AND COLUMN_NAME = 'ParentAccountID')
BEGIN
    PRINT 'Renaming ParentAccountID to ParentCOAID...';
    EXEC sp_rename 'ChartOfAccounts.ParentAccountID', 'ParentCOAID', 'COLUMN';
END
ELSE
BEGIN
    PRINT 'ParentAccountID column not found, skipping...';
END

-- Update the vw_BudgetSummary view to use correct column names
PRINT 'Updating vw_BudgetSummary view...';

-- Drop the existing view if it exists
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'vw_BudgetSummary')
BEGIN
    DROP VIEW vw_BudgetSummary;
    PRINT 'Dropped existing vw_BudgetSummary view';
END

-- Create updated view with correct column names
CREATE VIEW vw_BudgetSummary AS
SELECT 
    b.BudgetID,
    b.COAID,
    b.FiscalYear,
    b.Quarter,
    b.Month,
    coa.COACode,
    coa.COAName,
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

PRINT 'Migration completed: ChartOfAccounts columns renamed and vw_BudgetSummary view updated';