-- Migration: Add CAPEX/OPEX and Department fields
-- Date: 2025-09-21
-- Purpose: Add support for CAPEX/OPEX classification and department separation

-- Add CAPEX/OPEX and Department fields to ChartOfAccounts table
ALTER TABLE ChartOfAccounts 
ADD 
    ExpenseType NVARCHAR(10) DEFAULT 'OPEX' CHECK (ExpenseType IN ('CAPEX', 'OPEX')),
    Department NVARCHAR(100) DEFAULT 'IT';

-- Add CAPEX/OPEX and Department fields to Budget table
ALTER TABLE Budget 
ADD 
    ExpenseType NVARCHAR(10) DEFAULT 'OPEX' CHECK (ExpenseType IN ('CAPEX', 'OPEX')),
    Department NVARCHAR(100) DEFAULT 'IT';

-- Add CAPEX/OPEX field to PRF table for consistency
ALTER TABLE PRF 
ADD 
    ExpenseType NVARCHAR(10) DEFAULT 'OPEX' CHECK (ExpenseType IN ('CAPEX', 'OPEX'));

-- Update existing Chart of Accounts with default values
UPDATE ChartOfAccounts 
SET 
    ExpenseType = CASE 
        WHEN Category IN ('IT Equipment', 'Equipment', 'Hardware Equipment', 'Office Equipment') THEN 'CAPEX'
        ELSE 'OPEX'
    END,
    Department = 'IT'
WHERE ExpenseType IS NULL OR Department IS NULL;

-- Update existing Budget records with default values
UPDATE Budget 
SET 
    ExpenseType = CASE 
        WHEN EXISTS (
            SELECT 1 FROM ChartOfAccounts coa 
            WHERE coa.COAID = Budget.COAID 
            AND coa.Category IN ('IT Equipment', 'Equipment', 'Hardware Equipment', 'Office Equipment')
        ) THEN 'CAPEX'
        ELSE 'OPEX'
    END,
    Department = 'IT'
WHERE ExpenseType IS NULL OR Department IS NULL;

-- Update existing PRF records with default values
UPDATE PRF 
SET 
    ExpenseType = CASE 
        WHEN EXISTS (
            SELECT 1 FROM ChartOfAccounts coa 
            WHERE coa.COAID = PRF.COAID 
            AND coa.Category IN ('IT Equipment', 'Equipment', 'Hardware Equipment', 'Office Equipment')
        ) THEN 'CAPEX'
        ELSE 'OPEX'
    END
WHERE ExpenseType IS NULL;

-- Create indexes for better performance
CREATE INDEX IX_ChartOfAccounts_ExpenseType ON ChartOfAccounts(ExpenseType);
CREATE INDEX IX_ChartOfAccounts_Department ON ChartOfAccounts(Department);
CREATE INDEX IX_Budget_ExpenseType ON Budget(ExpenseType);
CREATE INDEX IX_Budget_Department ON Budget(Department);
CREATE INDEX IX_PRF_ExpenseType ON PRF(ExpenseType);

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
INSERT INTO ChartOfAccounts (COACode, COAName, Description, Category, ExpenseType, Department) VALUES
('HR-001', 'HR Software Systems', 'HR management software and tools', 'Software', 'OPEX', 'HR'),
('HR-002', 'HR Equipment', 'HR department equipment and hardware', 'Equipment', 'CAPEX', 'HR'),
('FIN-001', 'Financial Software', 'Accounting and financial software', 'Software', 'OPEX', 'Finance'),
('FIN-002', 'Financial Equipment', 'Finance department equipment', 'Equipment', 'CAPEX', 'Finance'),
('OPS-001', 'Operations Software', 'Operations management software', 'Software', 'OPEX', 'Operations'),
('OPS-002', 'Operations Equipment', 'Operations department equipment', 'Equipment', 'CAPEX', 'Operations');

PRINT 'Migration completed: Added CAPEX/OPEX and Department fields';