-- Update Budget Amounts with New Data
-- This script updates budget allocations with the new billion-scale amounts

USE PRFMonitoringDB;
GO

PRINT 'Updating budget allocations with new amounts...';

-- First, let's see current totals
SELECT 
    'Current Budget Totals Before Update' as Info,
    COUNT(*) as TotalBudgets,
    SUM(AllocatedAmount) as CurrentTotal,
    AVG(AllocatedAmount) as AvgAllocation
FROM Budget;

-- Update budget allocations based on the new data provided
-- Using COALESCE to handle cases where COA codes might not exist

-- Update existing budget allocations or insert new ones
MERGE Budget AS target
USING (
    SELECT 
        coa.COAID,
        2025 as FiscalYear,
        1 as Quarter,
        CASE coa.COACode
            WHEN 'MTIRMRAD496232' THEN 670000000.00    -- Repairs and maintenance
            WHEN 'MTIRMRAD496250' THEN 4410099000.00   -- IT consumables  
            WHEN 'MTIRMRAD496309' THEN 38800000.00     -- Uniforms and safety equipment
            WHEN 'MTIRMRAD496313' THEN 5052600000.00   -- Internet
            WHEN 'MTIRMRAD496314' THEN 1208000000.00   -- Telephone and mobile comms
            WHEN 'MTIRMRAD496326' THEN 291240000.00    -- Other permit & licenses
            WHEN 'MTIRMRAD496328' THEN 2803435000.00   -- Subscriptions
            WHEN 'MTIRMRAD496769' THEN 240200000.00    -- Tools
            WHEN 'MTIRMRAD496014' THEN 108000000.00    -- Training for IT Team
            WHEN 'AMITCM16.6250' THEN 180300000.00     -- Network Device & Ruijie
            WHEN 'AMITCM19.6250' THEN 892602000.00     -- CCP Project
            WHEN 'AMITCM20.6250' THEN 340048000.00     -- 44 Radio HT
            WHEN 'AMITNO1.6250' THEN 248614000.00      -- EA CRO
            WHEN 'AMPLCM01.6250' THEN 143606000.00     -- Server Historian
            WHEN 'AMPLME05.6250' THEN 62100000.00      -- DCS AP
            ELSE 100000000.00  -- Default amount for other codes
        END as NewAllocatedAmount,
        1 as CreatedBy,
        'Updated with new budget data - ' + CONVERT(VARCHAR, GETDATE(), 120) as Notes
    FROM ChartOfAccounts coa
    WHERE coa.COACode IN (
        'MTIRMRAD496232', 'MTIRMRAD496250', 'MTIRMRAD496309', 'MTIRMRAD496313',
        'MTIRMRAD496314', 'MTIRMRAD496326', 'MTIRMRAD496328', 'MTIRMRAD496769',
        'MTIRMRAD496014', 'AMITCM16.6250', 'AMITCM19.6250', 'AMITCM20.6250',
        'AMITNO1.6250', 'AMPLCM01.6250', 'AMPLME05.6250'
    )
) AS source (COAID, FiscalYear, Quarter, NewAllocatedAmount, CreatedBy, Notes)
ON target.COAID = source.COAID AND target.FiscalYear = source.FiscalYear
WHEN MATCHED THEN
    UPDATE SET 
        AllocatedAmount = source.NewAllocatedAmount,
        UpdatedAt = GETDATE(),
        Notes = source.Notes
WHEN NOT MATCHED THEN
    INSERT (COAID, FiscalYear, Quarter, AllocatedAmount, UtilizedAmount, CreatedBy, CreatedAt, UpdatedAt, Notes)
    VALUES (source.COAID, source.FiscalYear, source.Quarter, source.NewAllocatedAmount, 0.00, source.CreatedBy, GETDATE(), GETDATE(), source.Notes);

-- Insert/Update ChartOfAccounts entries for any missing codes
MERGE ChartOfAccounts AS target
USING (
    VALUES 
        ('MTIRMRAD496232', 'Repairs and maintenance', 'MTI RMR AD 496232 - Repairs and maintenance', 'Maintenance'),
        ('MTIRMRAD496250', 'IT consumables', 'MTI RMR AD 496250 - IT consumables', 'IT'),
        ('MTIRMRAD496309', 'Uniforms and safety equipment', 'MTI RMR AD 496309 - Uniforms and safety equipment', 'Safety'),
        ('MTIRMRAD496313', 'Internet', 'MTI RMR AD 496313 - Internet', 'IT'),
        ('MTIRMRAD496314', 'Telephone and mobile comms', 'MTI RMR AD 496314 - Telephone and mobile comms', 'Communications'),
        ('MTIRMRAD496326', 'Other permit & licenses', 'MTI RMR AD 496326 - Other permit & licenses', 'Legal'),
        ('MTIRMRAD496328', 'Subscriptions', 'MTI RMR AD 496328 - Subscriptions', 'Services'),
        ('MTIRMRAD496769', 'Tools', 'MTI RMR AD 496769 - Tools', 'Equipment'),
        ('MTIRMRAD496014', 'Training for IT Team', 'MTI RMR AD 496014 - Training for IT Team', 'Training'),
        ('AMITCM16.6250', 'Network Device & Ruijie', 'AMIT CM16.6250 - Network Device & Ruijie', 'IT'),
        ('AMITCM19.6250', 'CCP Project', 'AMIT CM19.6250 - CCP Project', 'Project'),
        ('AMITCM20.6250', '44 Radio HT', 'AMIT CM20.6250 - 44 Radio HT', 'Communications'),
        ('AMITNO1.6250', 'EA CRO', 'AMIT NO1.6250 - EA CRO', 'Services'),
        ('AMPLCM01.6250', 'Server Historian', 'AMPL CM01.6250 - Server Historian', 'IT'),
        ('AMPLME05.6250', 'DCS AP', 'AMPL ME05.6250 - DCS AP', 'IT')
) AS source (COACode, COAName, Description, Category)
ON target.COACode = source.COACode
WHEN MATCHED THEN
    UPDATE SET 
        COAName = source.COAName,
        Description = source.Description,
        Category = source.Category
WHEN NOT MATCHED THEN
    INSERT (COACode, COAName, Description, Category, CreatedAt)
    VALUES (source.COACode, source.COAName, source.Description, source.Category, GETDATE());

-- Verify the results
PRINT 'Verification of updates:';

SELECT 
    'Updated Budget Totals' as Info,
    COUNT(*) as TotalBudgets,
    SUM(AllocatedAmount) as NewTotal,
    AVG(AllocatedAmount) as AvgAllocation,
    SUM(UtilizedAmount) as TotalUtilized,
    SUM(AllocatedAmount - UtilizedAmount) as TotalRemaining
FROM Budget;

-- Show the updated budget allocations
SELECT 
    coa.COACode,
    coa.COAName,
    FORMAT(b.AllocatedAmount, 'N0') as AllocatedAmount,
    FORMAT(b.UtilizedAmount, 'N0') as UtilizedAmount,
    FORMAT(b.AllocatedAmount - b.UtilizedAmount, 'N0') as RemainingAmount,
    CASE 
        WHEN b.AllocatedAmount > 0 
        THEN ROUND((b.UtilizedAmount / b.AllocatedAmount) * 100, 2)
        ELSE 0 
    END as UtilizationPercentage
FROM Budget b
INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
WHERE coa.COACode IN (
    'MTIRMRAD496232', 'MTIRMRAD496250', 'MTIRMRAD496309', 'MTIRMRAD496313',
    'MTIRMRAD496314', 'MTIRMRAD496326', 'MTIRMRAD496328', 'MTIRMRAD496769',
    'MTIRMRAD496014', 'AMITCM16.6250', 'AMITCM19.6250', 'AMITCM20.6250',
    'AMITNO1.6250', 'AMPLCM01.6250', 'AMPLME05.6250'
)
ORDER BY b.AllocatedAmount DESC;

-- Show total budget summary
SELECT 
    'Total Budget Summary' as Summary,
    FORMAT(SUM(AllocatedAmount), 'N0') as TotalAllocated,
    FORMAT(SUM(UtilizedAmount), 'N0') as TotalUtilized,
    FORMAT(SUM(AllocatedAmount - UtilizedAmount), 'N0') as TotalRemaining,
    CASE 
        WHEN SUM(AllocatedAmount) > 0 
        THEN ROUND((SUM(UtilizedAmount) / SUM(AllocatedAmount)) * 100, 2)
        ELSE 0 
    END as OverallUtilizationPercentage
FROM Budget b
INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID;

PRINT 'Budget amounts update completed successfully!';