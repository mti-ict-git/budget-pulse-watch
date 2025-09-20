-- Sample Budget Data Setup
-- This script adds real cost codes from PRF data to ChartOfAccounts and creates budget allocations

-- Add real cost codes to ChartOfAccounts
INSERT INTO ChartOfAccounts (COACode, COAName, Description, Category) VALUES
('MTIRMRAD416769', 'Cost Code MTIRMRAD416769', 'MTI RMR AD 416769 - Equipment/Services', 'Equipment'),
('MTIRMRHS606250', 'Cost Code MTIRMRHS606250', 'MTI RMR HS 606250 - Equipment/Services', 'Equipment'),
('AMITBD01', 'Cost Code AMITBD01', 'AMIT BD01 - Business Development', 'Services'),
('AMITCM14.6718', 'Cost Code AMITCM14.6718', 'AMIT CM14.6718 - Commercial Management', 'Services'),
('AMITCM16', 'Cost Code AMITCM16', 'AMIT CM16 - Commercial Management', 'Services'),
('AMITCM16.6250', 'Cost Code AMITCM16.6250', 'AMIT CM16.6250 - Commercial Management', 'Services'),
('AMITCM18.6250', 'Cost Code AMITCM18.6250', 'AMIT CM18.6250 - Commercial Management', 'Services'),
('AMITCM19.6250', 'Cost Code AMITCM19.6250', 'AMIT CM19.6250 - Commercial Management', 'Services'),
('AMITCM20.6250', 'Cost Code AMITCM20.6250', 'AMIT CM20.6250 - Commercial Management', 'Services'),
('AMITCM21', 'Cost Code AMITCM21', 'AMIT CM21 - Commercial Management', 'Services');

-- Create budget allocations for 2025 (current fiscal year)
-- Using realistic budget amounts based on the request amounts we saw in the API

-- Get COAID values for budget inserts
DECLARE @COAID_MTIRMRAD416769 INT = (SELECT COAID FROM ChartOfAccounts WHERE COACode = 'MTIRMRAD416769');
DECLARE @COAID_MTIRMRHS606250 INT = (SELECT COAID FROM ChartOfAccounts WHERE COACode = 'MTIRMRHS606250');
DECLARE @COAID_AMITBD01 INT = (SELECT COAID FROM ChartOfAccounts WHERE COACode = 'AMITBD01');
DECLARE @COAID_AMITCM14 INT = (SELECT COAID FROM ChartOfAccounts WHERE COACode = 'AMITCM14.6718');
DECLARE @COAID_AMITCM16 INT = (SELECT COAID FROM ChartOfAccounts WHERE COACode = 'AMITCM16');
DECLARE @COAID_AMITCM16_6250 INT = (SELECT COAID FROM ChartOfAccounts WHERE COACode = 'AMITCM16.6250');
DECLARE @COAID_AMITCM18 INT = (SELECT COAID FROM ChartOfAccounts WHERE COACode = 'AMITCM18.6250');
DECLARE @COAID_AMITCM19 INT = (SELECT COAID FROM ChartOfAccounts WHERE COACode = 'AMITCM19.6250');
DECLARE @COAID_AMITCM20 INT = (SELECT COAID FROM ChartOfAccounts WHERE COACode = 'AMITCM20.6250');
DECLARE @COAID_AMITCM21 INT = (SELECT COAID FROM ChartOfAccounts WHERE COACode = 'AMITCM21');

-- Get a user ID for CreatedBy (assuming user ID 1 exists)
DECLARE @UserID INT = 1;

-- Insert budget allocations for Q1 2025
INSERT INTO Budget (COAID, FiscalYear, Quarter, AllocatedAmount, UtilizedAmount, CreatedBy, Notes) VALUES
(@COAID_MTIRMRAD416769, 2025, 1, 1000000.00, 0.00, @UserID, 'Q1 2025 allocation for MTIRMRAD416769'),
(@COAID_MTIRMRHS606250, 2025, 1, 3900000.00, 0.00, @UserID, 'Q1 2025 allocation for MTIRMRHS606250'),
(@COAID_AMITBD01, 2025, 1, 908962000.00, 0.00, @UserID, 'Q1 2025 allocation for AMITBD01'),
(@COAID_AMITCM14, 2025, 1, 10660000.00, 0.00, @UserID, 'Q1 2025 allocation for AMITCM14.6718'),
(@COAID_AMITCM16, 2025, 1, 15000000.00, 0.00, @UserID, 'Q1 2025 allocation for AMITCM16'),
(@COAID_AMITCM16_6250, 2025, 1, 407550000.00, 0.00, @UserID, 'Q1 2025 allocation for AMITCM16.6250'),
(@COAID_AMITCM18, 2025, 1, 50000000.00, 0.00, @UserID, 'Q1 2025 allocation for AMITCM18.6250'),
(@COAID_AMITCM19, 2025, 1, 75000000.00, 0.00, @UserID, 'Q1 2025 allocation for AMITCM19.6250'),
(@COAID_AMITCM20, 2025, 1, 100000000.00, 0.00, @UserID, 'Q1 2025 allocation for AMITCM20.6250'),
(@COAID_AMITCM21, 2025, 1, 25000000.00, 0.00, @UserID, 'Q1 2025 allocation for AMITCM21');

-- Verify the data was inserted
SELECT 'ChartOfAccounts entries added:' as Result;
SELECT COACode, COAName, Category FROM ChartOfAccounts WHERE COACode IN (
    'MTIRMRAD416769', 'MTIRMRHS606250', 'AMITBD01', 'AMITCM14.6718', 'AMITCM16', 
    'AMITCM16.6250', 'AMITCM18.6250', 'AMITCM19.6250', 'AMITCM20.6250', 'AMITCM21'
);

SELECT 'Budget allocations added:' as Result;
SELECT 
    coa.COACode,
    b.FiscalYear,
    b.Quarter,
    b.AllocatedAmount,
    b.UtilizedAmount,
    b.RemainingAmount
FROM Budget b
JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
WHERE coa.COACode IN (
    'MTIRMRAD416769', 'MTIRMRHS606250', 'AMITBD01', 'AMITCM14.6718', 'AMITCM16', 
    'AMITCM16.6250', 'AMITCM18.6250', 'AMITCM19.6250', 'AMITCM20.6250', 'AMITCM21'
)
ORDER BY coa.COACode;