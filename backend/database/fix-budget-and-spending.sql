-- Fix Budget Amounts and Spending Calculation
-- This script addresses two main issues:
-- 1. Budget allocations should be in billions, not millions
-- 2. Spending calculation should use RequestedAmount when ApprovedAmount is null

USE PRFMonitoringDB;
GO

-- 1. Update budget allocations to 3 billion scale
-- Current total is 33M, we want 3B total
-- So we need to multiply by approximately 90 (3,000M / 33M ≈ 90.9)

PRINT 'Updating budget allocations to 3 billion scale...';

-- First, let's see current totals
SELECT 
    'Current Budget Totals' as Info,
    COUNT(*) as TotalBudgets,
    SUM(AllocatedAmount) as CurrentTotal,
    AVG(AllocatedAmount) as AvgAllocation
FROM Budget;

-- Update all budget allocations to be in billions
-- We'll set each major cost code to have substantial allocations
UPDATE Budget 
SET AllocatedAmount = CASE 
    -- Major cost codes get larger allocations (500M - 1B each)
    WHEN COAID IN (
        SELECT TOP 10 COAID FROM Budget 
        ORDER BY AllocatedAmount DESC
    ) THEN AllocatedAmount * 150  -- 3M becomes 450M, larger ones become 500M-1B
    
    -- Medium cost codes get moderate allocations (100M - 300M each)
    WHEN COAID IN (
        SELECT COAID FROM Budget 
        WHERE COAID NOT IN (
            SELECT TOP 10 COAID FROM Budget 
            ORDER BY AllocatedAmount DESC
        )
        AND COAID NOT IN (
            SELECT TOP 10 COAID FROM Budget 
            ORDER BY AllocatedAmount ASC
        )
    ) THEN AllocatedAmount * 100  -- 3M becomes 300M
    
    -- Smaller cost codes get smaller but still substantial allocations (50M - 100M each)
    ELSE AllocatedAmount * 50  -- 3M becomes 150M
END;

-- 2. Update ApprovedAmount for PRFs that have been approved/completed
-- Use RequestedAmount as ApprovedAmount for approved/completed PRFs
PRINT 'Updating PRF approved amounts for completed/approved requests...';

UPDATE PRF 
SET ApprovedAmount = RequestedAmount
WHERE ApprovedAmount IS NULL 
  AND Status IN (
    'Completed', 
    'Req. Approved', 
    'Approved', 
    'On order',
    'Delivered',
    'Paid',
    'Closed'
  );

-- 3. Update UtilizedAmount in Budget table based on actual PRF spending
PRINT 'Updating budget utilization based on PRF spending...';

-- Reset utilization amounts first
UPDATE Budget SET UtilizedAmount = 0;

-- Update utilization based on approved PRF amounts
UPDATE b 
SET UtilizedAmount = ISNULL(prf_totals.TotalApproved, 0)
FROM Budget b
LEFT JOIN (
    SELECT 
        p.COAID, 
        SUM(COALESCE(p.ApprovedAmount, p.RequestedAmount, 0)) as TotalApproved
    FROM PRF p 
    WHERE p.COAID IS NOT NULL
      AND p.Status IN (
        'Completed', 
        'Req. Approved', 
        'Approved', 
        'On order',
        'Delivered',
        'Paid',
        'Closed'
      )
    GROUP BY p.COAID
) prf_totals ON b.COAID = prf_totals.COAID;

-- 4. Verify the results
PRINT 'Verification of updates:';

SELECT 
    'Updated Budget Totals' as Info,
    COUNT(*) as TotalBudgets,
    SUM(AllocatedAmount) as NewTotal,
    AVG(AllocatedAmount) as AvgAllocation,
    SUM(UtilizedAmount) as TotalUtilized,
    SUM(AllocatedAmount - UtilizedAmount) as TotalRemaining
FROM Budget;

-- Show top 10 budget allocations
SELECT TOP 10
    coa.COACode,
    coa.COAName,
    b.AllocatedAmount,
    b.UtilizedAmount,
    (b.AllocatedAmount - b.UtilizedAmount) as RemainingAmount,
    CASE 
        WHEN b.AllocatedAmount > 0 
        THEN ROUND((b.UtilizedAmount / b.AllocatedAmount) * 100, 2)
        ELSE 0 
    END as UtilizationPercentage
FROM Budget b
INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
ORDER BY b.AllocatedAmount DESC;

-- Show PRF approved amounts summary
SELECT 
    'PRF Approved Amounts Summary' as Info,
    COUNT(*) as TotalPRFs,
    COUNT(CASE WHEN ApprovedAmount IS NOT NULL THEN 1 END) as PRFsWithApprovedAmount,
    SUM(RequestedAmount) as TotalRequested,
    SUM(COALESCE(ApprovedAmount, 0)) as TotalApproved,
    COUNT(DISTINCT Status) as UniqueStatuses
FROM PRF;

-- Show unique status values
SELECT DISTINCT Status, COUNT(*) as Count
FROM PRF 
GROUP BY Status
ORDER BY Count DESC;

PRINT 'Budget and spending fixes completed successfully!';