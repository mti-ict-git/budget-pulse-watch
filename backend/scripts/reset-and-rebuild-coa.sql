-- =====================================================
-- Reset and Rebuild COA Structure
-- This script will completely clear and rebuild the COA
-- =====================================================

USE PRFMonitoringDB;
GO

PRINT 'Starting COA Reset and Rebuild Process...';
GO

-- Step 1: Clear existing data
PRINT 'Step 1: Clearing existing Budget and ChartOfAccounts data...';
DELETE FROM Budget;
DELETE FROM ChartOfAccounts;
GO

-- Reset identity seeds
DBCC CHECKIDENT ('Budget', RESEED, 0);
DBCC CHECKIDENT ('ChartOfAccounts', RESEED, 0);
GO

PRINT 'Existing data cleared successfully.';
GO

-- Step 2: Insert baseline COA entries from the image
PRINT 'Step 2: Inserting baseline COA entries...';

-- Insert COA entries based on the PRF data analysis
INSERT INTO ChartOfAccounts (COACode, COAName, Category, CreatedAt) VALUES
-- MTIR codes
('MTIRMRAD496232', 'Repairs and maintenance', 'Maintenance', GETDATE()),
('MTIRMRAD496250', 'IT consumables', 'IT', GETDATE()),
('MTIRMRAD496309', 'Uniforms and safety equipment', 'Safety', GETDATE()),
('MTIRMRAD496313', 'Internet', 'Communications', GETDATE()),
('MTIRMRAD496314', 'Telephone and mobile comms', 'Communications', GETDATE()),
('MTIRMRAD496326', 'Other permit & licenses', 'Legal', GETDATE()),
('MTIRMRAD496328', 'Subscriptions', 'Services', GETDATE()),
('MTIRMRAD496769', 'Tools', 'Equipment', GETDATE()),
('MTIRMRAD496014', 'Training for IT Team', 'Training', GETDATE()),
-- AMIT codes from PRF data
('AMITBD01', 'AMIT BD01', 'Budget', GETDATE()),
('AMITCM14.6718', 'AMIT CM14.6718', 'Budget', GETDATE()),
('AMITCM16', 'AMIT CM16', 'Budget', GETDATE()),
('AMITCM16.6250', 'Network Cisco and Ruijie', 'IT', GETDATE()),
('AMITCM18.6250', 'AMIT CM18.6250', 'Budget', GETDATE()),
('AMITCM19.6250', 'CCP Project', 'Project', GETDATE()),
('AMITCM20.6250', '44 Radio HT', 'Communications', GETDATE()),
('AMITCM21', 'AMIT CM21', 'Budget', GETDATE()),
('AMITCM21.6250', 'AMIT CM21.6250', 'Budget', GETDATE()),
('AMITCM22.6250', 'AMIT CM22.6250', 'Budget', GETDATE()),
('AMITCM23', 'AMIT CM23', 'Budget', GETDATE()),
('AMITINO1.6250', 'EA CRO', 'Budget', GETDATE()),
-- AMPL codes
('AMPLCM01.6250', 'Server Historian', 'IT', GETDATE()),
('AMPLME05.6250', 'DCS AP', 'IT', GETDATE());
GO

-- Step 3: Insert initial budget allocations for each COA
PRINT 'Step 3: Creating initial budget allocations...';

INSERT INTO Budget (COAID, FiscalYear, Quarter, AllocatedAmount, UtilizedAmount, CreatedBy, BudgetType, CreatedAt, UpdatedAt, Status)
SELECT 
    COAID,
    2024 as FiscalYear,
    1 as Quarter,
    CASE 
        -- MTIR codes with existing budget amounts
        WHEN COACode = 'MTIRMRAD496232' THEN 670000000.00
        WHEN COACode = 'MTIRMRAD496250' THEN 4410099000.00
        WHEN COACode = 'MTIRMRAD496309' THEN 38800000.00
        WHEN COACode = 'MTIRMRAD496313' THEN 5052600000.00
        WHEN COACode = 'MTIRMRAD496314' THEN 1208000000.00
        WHEN COACode = 'MTIRMRAD496326' THEN 291240000.00
        WHEN COACode = 'MTIRMRAD496328' THEN 2803435000.00
        WHEN COACode = 'MTIRMRAD496769' THEN 240200000.00
        WHEN COACode = 'MTIRMRAD496014' THEN 108000000.00
        -- AMIT codes with existing budget amounts
        WHEN COACode = 'AMITCM16.6250' THEN 180300000.00
        WHEN COACode = 'AMITCM19.6250' THEN 892602000.00
        WHEN COACode = 'AMITCM20.6250' THEN 340048000.00
        WHEN COACode = 'AMITINO1.6250' THEN 248614000.00
        -- New AMIT codes with default budget amounts
        WHEN COACode = 'AMITBD01' THEN 100000000.00
        WHEN COACode = 'AMITCM14.6718' THEN 100000000.00
        WHEN COACode = 'AMITCM16' THEN 100000000.00
        WHEN COACode = 'AMITCM18.6250' THEN 100000000.00
        WHEN COACode = 'AMITCM21' THEN 100000000.00
        WHEN COACode = 'AMITCM21.6250' THEN 100000000.00
        WHEN COACode = 'AMITCM22.6250' THEN 100000000.00
        WHEN COACode = 'AMITCM23' THEN 100000000.00
        -- AMPL codes
        WHEN COACode = 'AMPLCM01.6250' THEN 143606000.00
        WHEN COACode = 'AMPLME05.6250' THEN 62100000.00
        ELSE 0.00
    END as AllocatedAmount,
    0.00 as UtilizedAmount,
    1 as CreatedBy,
    'Annual' as BudgetType,
    GETDATE() as CreatedAt,
    GETDATE() as UpdatedAt,
    'Active' as Status
FROM ChartOfAccounts;
GO

-- Step 4: Verification
PRINT 'Step 4: Verification...';

DECLARE @COACount INT, @BudgetCount INT;
SELECT @COACount = COUNT(*) FROM ChartOfAccounts;
SELECT @BudgetCount = COUNT(*) FROM Budget;

PRINT 'COA entries created: ' + CAST(@COACount AS VARCHAR(10));
PRINT 'Budget entries created: ' + CAST(@BudgetCount AS VARCHAR(10));

-- Show summary
PRINT 'Summary of created COA entries:';
SELECT 
    c.COACode, 
    c.COAName, 
    c.Category,
    FORMAT(b.AllocatedAmount, 'N0') as InitialBudget,
    FORMAT(b.RemainingAmount, 'N0') as RemainingBudget
FROM ChartOfAccounts c
LEFT JOIN Budget b ON c.COAID = b.COAID
ORDER BY c.COACode;
GO

PRINT 'COA Reset and Rebuild completed successfully!';
GO