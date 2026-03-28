-- Migration: Add CAPEX/OPEX and Department fields
-- Date: 2025-09-21
-- Purpose: Add support for CAPEX/OPEX classification and department separation

USE PRFMonitoringDB;
GO

IF COL_LENGTH('dbo.ChartOfAccounts', 'ExpenseType') IS NULL
BEGIN
  ALTER TABLE dbo.ChartOfAccounts
  ADD ExpenseType NVARCHAR(10) NULL;
END
GO

IF COL_LENGTH('dbo.ChartOfAccounts', 'Department') IS NULL
BEGIN
  ALTER TABLE dbo.ChartOfAccounts
  ADD Department NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.Budget', 'ExpenseType') IS NULL
BEGIN
  ALTER TABLE dbo.Budget
  ADD ExpenseType NVARCHAR(10) NULL;
END
GO

IF COL_LENGTH('dbo.Budget', 'Department') IS NULL
BEGIN
  ALTER TABLE dbo.Budget
  ADD Department NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.PRF', 'ExpenseType') IS NULL
BEGIN
  ALTER TABLE dbo.PRF
  ADD ExpenseType NVARCHAR(10) NULL;
END
GO

-- Update existing Chart of Accounts with default values
UPDATE dbo.ChartOfAccounts 
SET 
    ExpenseType = CASE 
        WHEN Category IN ('IT Equipment', 'Equipment', 'Hardware Equipment', 'Office Equipment') THEN 'CAPEX'
        ELSE 'OPEX'
    END,
    Department = 'IT'
WHERE ExpenseType IS NULL OR Department IS NULL;
GO

-- Update existing Budget records with default values
UPDATE dbo.Budget 
SET 
    ExpenseType = CASE 
        WHEN EXISTS (
            SELECT 1 FROM dbo.ChartOfAccounts coa 
            WHERE coa.COAID = dbo.Budget.COAID 
            AND coa.Category IN ('IT Equipment', 'Equipment', 'Hardware Equipment', 'Office Equipment')
        ) THEN 'CAPEX'
        ELSE 'OPEX'
    END,
    Department = 'IT'
WHERE ExpenseType IS NULL OR Department IS NULL;
GO

-- Update existing PRF records with default values
UPDATE dbo.PRF 
SET 
    ExpenseType = CASE 
        WHEN EXISTS (
            SELECT 1 FROM dbo.ChartOfAccounts coa 
            WHERE coa.COAID = dbo.PRF.COAID 
            AND coa.Category IN ('IT Equipment', 'Equipment', 'Hardware Equipment', 'Office Equipment')
        ) THEN 'CAPEX'
        ELSE 'OPEX'
    END
WHERE ExpenseType IS NULL;
GO

-- Create indexes for better performance
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChartOfAccounts_ExpenseType' AND object_id = OBJECT_ID('dbo.ChartOfAccounts'))
BEGIN
  CREATE INDEX IX_ChartOfAccounts_ExpenseType ON dbo.ChartOfAccounts(ExpenseType);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChartOfAccounts_Department' AND object_id = OBJECT_ID('dbo.ChartOfAccounts'))
BEGIN
  CREATE INDEX IX_ChartOfAccounts_Department ON dbo.ChartOfAccounts(Department);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Budget_ExpenseType' AND object_id = OBJECT_ID('dbo.Budget'))
BEGIN
  CREATE INDEX IX_Budget_ExpenseType ON dbo.Budget(ExpenseType);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Budget_Department' AND object_id = OBJECT_ID('dbo.Budget'))
BEGIN
  CREATE INDEX IX_Budget_Department ON dbo.Budget(Department);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRF_ExpenseType' AND object_id = OBJECT_ID('dbo.PRF'))
BEGIN
  CREATE INDEX IX_PRF_ExpenseType ON dbo.PRF(ExpenseType);
END
GO

-- Update the Budget Utilization view to include CAPEX/OPEX breakdown
DROP VIEW IF EXISTS vw_BudgetUtilization;
GO

CREATE VIEW vw_BudgetUtilization AS
SELECT 
    b.BudgetID,
    b.FiscalYear,
    b.Quarter,
    b.Month,
    coa.COACode,
    coa.COAName,
    coa.Category,
    b.AllocatedAmount,
    b.UtilizedAmount,
    b.RemainingAmount,
    b.UtilizationPercentage,
    b.ExpenseType,
    b.Department,
    coa.ExpenseType as COAExpenseType,
    coa.Department as COADepartment,
    CASE 
        WHEN b.UtilizationPercentage > 90 THEN 'Critical'
        WHEN b.UtilizationPercentage > 75 THEN 'High'
        WHEN b.UtilizationPercentage > 50 THEN 'Medium'
        ELSE 'Low'
    END AS UtilizationLevel
FROM Budget b
INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID;
GO

-- Create new view for CAPEX/OPEX summary
CREATE VIEW vw_CapexOpexSummary AS
SELECT 
    b.FiscalYear,
    b.Quarter,
    b.Department,
    b.ExpenseType,
    COUNT(*) as BudgetCount,
    SUM(b.AllocatedAmount) as TotalAllocated,
    SUM(b.UtilizedAmount) as TotalUtilized,
    SUM(b.RemainingAmount) as TotalRemaining,
    AVG(b.UtilizationPercentage) as AvgUtilization
FROM Budget b
GROUP BY b.FiscalYear, b.Quarter, b.Department, b.ExpenseType;
GO

-- Create view for IT Department budget summary
CREATE VIEW vw_ITBudgetSummary AS
SELECT 
    b.FiscalYear,
    b.Quarter,
    b.ExpenseType,
    COUNT(*) as BudgetCount,
    SUM(b.AllocatedAmount) as TotalAllocated,
    SUM(b.UtilizedAmount) as TotalUtilized,
    SUM(b.RemainingAmount) as TotalRemaining,
    AVG(b.UtilizationPercentage) as AvgUtilization,
    COUNT(CASE WHEN b.UtilizationPercentage > 90 THEN 1 END) as CriticalBudgets,
    COUNT(CASE WHEN b.UtilizationPercentage > 75 THEN 1 END) as HighUtilizationBudgets
FROM Budget b
WHERE b.Department = 'IT'
GROUP BY b.FiscalYear, b.Quarter, b.ExpenseType;
GO

-- Insert sample COA entries for other departments under IT PO
IF NOT EXISTS (SELECT 1 FROM dbo.ChartOfAccounts WHERE COACode = 'HR-001')
  INSERT INTO dbo.ChartOfAccounts (COACode, COAName, Description, Category, ExpenseType, Department)
  VALUES ('HR-001', 'HR Software Systems', 'HR management software and tools', 'Software', 'OPEX', 'HR');
IF NOT EXISTS (SELECT 1 FROM dbo.ChartOfAccounts WHERE COACode = 'HR-002')
  INSERT INTO dbo.ChartOfAccounts (COACode, COAName, Description, Category, ExpenseType, Department)
  VALUES ('HR-002', 'HR Equipment', 'HR department equipment and hardware', 'Equipment', 'CAPEX', 'HR');
IF NOT EXISTS (SELECT 1 FROM dbo.ChartOfAccounts WHERE COACode = 'FIN-001')
  INSERT INTO dbo.ChartOfAccounts (COACode, COAName, Description, Category, ExpenseType, Department)
  VALUES ('FIN-001', 'Financial Software', 'Accounting and financial software', 'Software', 'OPEX', 'Finance');
IF NOT EXISTS (SELECT 1 FROM dbo.ChartOfAccounts WHERE COACode = 'FIN-002')
  INSERT INTO dbo.ChartOfAccounts (COACode, COAName, Description, Category, ExpenseType, Department)
  VALUES ('FIN-002', 'Financial Equipment', 'Finance department equipment', 'Equipment', 'CAPEX', 'Finance');
IF NOT EXISTS (SELECT 1 FROM dbo.ChartOfAccounts WHERE COACode = 'OPS-001')
  INSERT INTO dbo.ChartOfAccounts (COACode, COAName, Description, Category, ExpenseType, Department)
  VALUES ('OPS-001', 'Operations Software', 'Operations management software', 'Software', 'OPEX', 'Operations');
IF NOT EXISTS (SELECT 1 FROM dbo.ChartOfAccounts WHERE COACode = 'OPS-002')
  INSERT INTO dbo.ChartOfAccounts (COACode, COAName, Description, Category, ExpenseType, Department)
  VALUES ('OPS-002', 'Operations Equipment', 'Operations department equipment', 'Equipment', 'CAPEX', 'Operations');
GO

PRINT 'Migration completed: Added CAPEX/OPEX and Department fields';
