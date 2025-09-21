import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = express.Router();

/**
 * @route   GET /api/reports/dashboard
 * @desc    Get dashboard metrics (budget totals, utilization, PRF counts)
 * @access  Private
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const { fiscalYear = new Date().getFullYear(), department } = req.query;
  
  try {
    const { executeQuery } = await import('../config/database');
    
    let whereClause = 'WHERE b.FiscalYear = @FiscalYear AND b.AllocatedAmount > 0';
    const params: Record<string, unknown> = { FiscalYear: fiscalYear };
    
    if (department && department !== 'all') {
      whereClause += ' AND coa.Department = @Department';
      params.Department = department;
    }
    
    // Get budget metrics (excluding zero allocations)
    const budgetQuery = `
      SELECT 
        SUM(b.AllocatedAmount) as TotalBudget,
        SUM(COALESCE(prf_spent.TotalSpent, 0)) as TotalSpent,
        SUM(b.AllocatedAmount) - SUM(COALESCE(prf_spent.TotalSpent, 0)) as TotalRemaining,
        COUNT(b.BudgetID) as TotalBudgetItems,
        COUNT(CASE WHEN COALESCE(prf_spent.TotalSpent, 0) > b.AllocatedAmount THEN 1 END) as OverBudgetCount,
        CASE 
          WHEN SUM(b.AllocatedAmount) > 0 
          THEN ROUND((SUM(COALESCE(prf_spent.TotalSpent, 0)) * 100.0 / SUM(b.AllocatedAmount)), 2)
          ELSE 0 
        END as OverallUtilization
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN (
        SELECT 
          p.COAID,
          SUM(COALESCE(p.ApprovedAmount, p.RequestedAmount, 0)) as TotalSpent
        FROM PRF p
        WHERE p.Status IN ('Approved', 'Completed')
          AND YEAR(p.RequestDate) = @FiscalYear
        GROUP BY p.COAID
      ) prf_spent ON b.COAID = prf_spent.COAID
      ${whereClause}
    `;
    
    // Get PRF metrics
    const prfQuery = `
      SELECT 
        COUNT(*) as TotalPRFs,
        COUNT(CASE WHEN Status = 'Approved' THEN 1 END) as ApprovedPRFs,
        COUNT(CASE WHEN Status = 'Pending' THEN 1 END) as PendingPRFs,
        COUNT(CASE WHEN Status = 'Rejected' THEN 1 END) as RejectedPRFs
      FROM PRF
      WHERE YEAR(RequestDate) = @FiscalYear
    `;
    
    // Get CAPEX/OPEX breakdown
    const expenseTypeQuery = `
      SELECT 
        coa.ExpenseType,
        SUM(b.AllocatedAmount) as TotalAllocated,
        SUM(COALESCE(prf_spent.TotalSpent, 0)) as TotalSpent,
        COUNT(b.BudgetID) as BudgetCount
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN (
        SELECT 
          p.COAID,
          SUM(COALESCE(p.ApprovedAmount, p.RequestedAmount, 0)) as TotalSpent
        FROM PRF p
        WHERE p.Status IN ('Approved', 'Completed')
          AND YEAR(p.RequestDate) = @FiscalYear
        GROUP BY p.COAID
      ) prf_spent ON b.COAID = prf_spent.COAID
      ${whereClause}
      GROUP BY coa.ExpenseType
    `;
    
    const [budgetResult, prfResult, expenseTypeResult] = await Promise.all([
      executeQuery(budgetQuery, params),
      executeQuery(prfQuery, params),
      executeQuery(expenseTypeQuery, params)
    ]);
    
    const budgetMetrics = (budgetResult.recordset?.[0] || {}) as Record<string, unknown>;
    const prfMetrics = (prfResult.recordset?.[0] || {}) as Record<string, unknown>;
    const expenseBreakdown = (expenseTypeResult.recordset || []) as Record<string, unknown>[];
    
    res.json({
      success: true,
      message: 'Dashboard metrics retrieved successfully',
      data: {
        fiscalYear: parseInt(fiscalYear as string),
        budget: {
          totalBudget: budgetMetrics['TotalBudget'] || 0,
          totalSpent: budgetMetrics['TotalSpent'] || 0,
          totalRemaining: budgetMetrics['TotalRemaining'] || 0,
          overallUtilization: budgetMetrics['OverallUtilization'] || 0,
          totalBudgetItems: budgetMetrics['TotalBudgetItems'] || 0,
          overBudgetCount: budgetMetrics['OverBudgetCount'] || 0
        },
        prfs: {
          totalPRFs: prfMetrics['TotalPRFs'] || 0,
          approvedPRFs: prfMetrics['ApprovedPRFs'] || 0,
          pendingPRFs: prfMetrics['PendingPRFs'] || 0,
          rejectedPRFs: prfMetrics['RejectedPRFs'] || 0
        },
        expenseBreakdown: expenseBreakdown.map((item: Record<string, unknown>) => ({
          expenseType: item['ExpenseType'],
          totalAllocated: item['TotalAllocated'] || 0,
          totalSpent: item['TotalSpent'] || 0,
          budgetCount: item['BudgetCount'] || 0,
          utilization: item['TotalAllocated'] && Number(item['TotalAllocated']) > 0 
            ? Math.round((Number(item['TotalSpent']) / Number(item['TotalAllocated'])) * 100 * 100) / 100 
            : 0
        }))
      }
    });
  } catch (error) {
    console.error('Error getting dashboard metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard metrics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/reports/budget-summary
 * @desc    Get budget vs PRF totals per category
 * @access  Private
 */
router.get('/budget-summary', asyncHandler(async (req, res) => {
  // TODO: Implement budget summary report
  res.json({
    success: true,
    message: 'Get budget summary report endpoint - Coming soon',
    data: []
  });
}));

/**
 * @route   GET /api/reports/unallocated-budgets
 * @desc    Get non-defined allocation budgets and non-IT departments
 * @access  Private
 */
router.get('/unallocated-budgets', asyncHandler(async (req, res) => {
  const { fiscalYear = new Date().getFullYear() } = req.query;
  
  try {
    const { executeQuery } = await import('../config/database');
    
    // Get budgets with zero allocation or non-IT departments
    const unallocatedQuery = `
      SELECT 
        b.BudgetID,
        coa.COACode,
        coa.COAName,
        coa.Category,
        coa.Department,
        b.AllocatedAmount,
        b.FiscalYear,
        COALESCE(prf_spent.TotalSpent, 0) as TotalSpent,
        CASE 
          WHEN b.AllocatedAmount = 0 THEN 'Zero Allocation'
          WHEN coa.Department NOT LIKE '%IT%' AND coa.Department NOT LIKE '%Information Technology%' THEN 'Non-IT Department'
          ELSE 'Other'
        END as ReasonType
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN (
        SELECT 
          p.COAID,
          SUM(COALESCE(p.ApprovedAmount, p.RequestedAmount, 0)) as TotalSpent
        FROM PRF p
        WHERE p.Status IN ('Approved', 'Completed')
          AND YEAR(p.RequestDate) = @FiscalYear
        GROUP BY p.COAID
      ) prf_spent ON b.COAID = prf_spent.COAID
      WHERE b.FiscalYear = @FiscalYear
        AND (
          b.AllocatedAmount = 0 
          OR (coa.Department NOT LIKE '%IT%' AND coa.Department NOT LIKE '%Information Technology%')
        )
      ORDER BY 
        CASE 
          WHEN b.AllocatedAmount = 0 THEN 1
          ELSE 2
        END,
        coa.Department,
        coa.COAName
    `;
    
    // Get summary statistics
    const summaryQuery = `
      SELECT 
        COUNT(CASE WHEN b.AllocatedAmount = 0 THEN 1 END) as ZeroAllocationCount,
        COUNT(CASE WHEN coa.Department NOT LIKE '%IT%' AND coa.Department NOT LIKE '%Information Technology%' AND b.AllocatedAmount > 0 THEN 1 END) as NonITCount,
        SUM(CASE WHEN b.AllocatedAmount = 0 THEN COALESCE(prf_spent.TotalSpent, 0) ELSE 0 END) as ZeroAllocationSpent,
        SUM(CASE WHEN coa.Department NOT LIKE '%IT%' AND coa.Department NOT LIKE '%Information Technology%' THEN b.AllocatedAmount ELSE 0 END) as NonITBudget,
        SUM(CASE WHEN coa.Department NOT LIKE '%IT%' AND coa.Department NOT LIKE '%Information Technology%' THEN COALESCE(prf_spent.TotalSpent, 0) ELSE 0 END) as NonITSpent
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN (
        SELECT 
          p.COAID,
          SUM(COALESCE(p.ApprovedAmount, p.RequestedAmount, 0)) as TotalSpent
        FROM PRF p
        WHERE p.Status IN ('Approved', 'Completed')
          AND YEAR(p.RequestDate) = @FiscalYear
        GROUP BY p.COAID
      ) prf_spent ON b.COAID = prf_spent.COAID
      WHERE b.FiscalYear = @FiscalYear
        AND (
          b.AllocatedAmount = 0 
          OR (coa.Department NOT LIKE '%IT%' AND coa.Department NOT LIKE '%Information Technology%')
        )
    `;
    
    const params = { FiscalYear: fiscalYear };
    
    const [unallocatedResult, summaryResult] = await Promise.all([
      executeQuery(unallocatedQuery, params),
      executeQuery(summaryQuery, params)
    ]);
    
    const unallocatedBudgets = (unallocatedResult.recordset || []) as Record<string, unknown>[];
    const summary = (summaryResult.recordset?.[0] || {}) as Record<string, unknown>;
    
    res.json({
      success: true,
      message: 'Unallocated budgets retrieved successfully',
      data: {
        fiscalYear: parseInt(fiscalYear as string),
        budgets: unallocatedBudgets.map((item: Record<string, unknown>) => ({
          budgetId: item['BudgetID'],
          purchaseCostCode: item['PurchaseCostCode'],
          coaCode: item['COACode'],
          coaName: item['COAName'],
          category: item['Category'],
          department: item['Department'],
          expenseType: item['ExpenseType'],
          allocatedAmount: item['AllocatedAmount'] || 0,
          totalSpent: item['TotalSpent'] || 0,
          reasonType: item['ReasonType']
        })),
        summary: {
          zeroAllocationCount: (summary as Record<string, unknown>)['ZeroAllocationCount'] || 0,
          nonITCount: (summary as Record<string, unknown>)['NonITCount'] || 0,
          zeroAllocationSpent: (summary as Record<string, unknown>)['ZeroAllocationSpent'] || 0,
          nonITBudget: (summary as Record<string, unknown>)['NonITBudget'] || 0,
          nonITSpent: (summary as Record<string, unknown>)['NonITSpent'] || 0,
          totalItems: unallocatedBudgets.length
        }
      }
    });
  } catch (error) {
    console.error('Error getting unallocated budgets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unallocated budgets',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/reports/prf-trend
 * @desc    Get PRF submission and approval trends
 * @access  Private
 */
router.get('/prf-trend', asyncHandler(async (req, res) => {
  // TODO: Implement PRF trend analysis
  const { year, period = 'monthly' } = req.query;
  
  res.json({
    success: true,
    message: 'Get PRF trend report endpoint - Coming soon',
    data: {
      period,
      year,
      trends: []
    }
  });
}));

/**
 * @route   GET /api/reports/utilization
 * @desc    Get utilization data for dashboard charts
 * @access  Private
 */
router.get('/utilization', asyncHandler(async (req, res) => {
  const { fiscalYear = new Date().getFullYear() } = req.query;
  
  try {
    const { executeQuery } = await import('../config/database');
    
    const query = `
      SELECT 
        coa.Category as category,
        coa.ExpenseType as expenseType,
        SUM(b.AllocatedAmount) as allocatedAmount,
        SUM(COALESCE(prf_spent.TotalSpent, 0)) as spentAmount,
        CASE 
          WHEN SUM(b.AllocatedAmount) > 0 
          THEN ROUND((SUM(COALESCE(prf_spent.TotalSpent, 0)) * 100.0 / SUM(b.AllocatedAmount)), 2)
          ELSE 0 
        END as utilizationPercentage
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN (
        SELECT 
          p.COAID,
          SUM(COALESCE(p.ApprovedAmount, p.RequestedAmount, 0)) as TotalSpent
        FROM PRF p
        WHERE p.Status IN ('Approved', 'Completed')
          AND YEAR(p.RequestDate) = @FiscalYear
        GROUP BY p.COAID
      ) prf_spent ON b.COAID = prf_spent.COAID
      WHERE b.FiscalYear = @FiscalYear
        AND b.AllocatedAmount > 0
      GROUP BY coa.Category, coa.ExpenseType
      ORDER BY coa.ExpenseType, coa.Category
    `;
    
    const result = await executeQuery(query, { FiscalYear: fiscalYear });
    
    res.json({
      success: true,
      message: 'Utilization data retrieved successfully',
      data: result.recordset
    });
  } catch (error) {
    console.error('Error getting utilization data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get utilization data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/reports/budget-utilization
 * @desc    Get budget utilization by category and expense type
 * @access  Private
 */
router.get('/budget-utilization', asyncHandler(async (req, res) => {
  const { fiscalYear = new Date().getFullYear(), expenseType } = req.query;
  
  try {
    const { executeQuery } = await import('../config/database');
    
    let whereClause = 'WHERE b.FiscalYear = @FiscalYear';
    const params: Record<string, unknown> = { FiscalYear: fiscalYear };
    
    if (expenseType && (expenseType === 'CAPEX' || expenseType === 'OPEX')) {
      whereClause += ' AND coa.ExpenseType = @ExpenseType';
      params.ExpenseType = expenseType;
    }
    
    const query = `
      SELECT 
        coa.Category,
        coa.ExpenseType,
        coa.Department,
        COUNT(b.BudgetID) as BudgetCount,
        SUM(b.AllocatedAmount) as TotalAllocated,
        SUM(COALESCE(prf_spent.TotalSpent, 0)) as TotalSpent,
        SUM(b.AllocatedAmount) - SUM(COALESCE(prf_spent.TotalSpent, 0)) as TotalRemaining,
        CASE 
          WHEN SUM(b.AllocatedAmount) > 0 
          THEN ROUND((SUM(COALESCE(prf_spent.TotalSpent, 0)) * 100.0 / SUM(b.AllocatedAmount)), 2)
          ELSE 0 
        END as UtilizationPercentage
      FROM Budget b
      INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
      LEFT JOIN (
        SELECT 
          p.COAID,
          SUM(COALESCE(p.ApprovedAmount, p.RequestedAmount, 0)) as TotalSpent
        FROM PRF p
        WHERE p.Status IN ('Approved', 'Completed')
          AND YEAR(p.RequestDate) = @FiscalYear
        GROUP BY p.COAID
      ) prf_spent ON b.COAID = prf_spent.COAID
      ${whereClause}
        AND b.AllocatedAmount > 0
      GROUP BY coa.Category, coa.ExpenseType, coa.Department
      ORDER BY coa.ExpenseType, coa.Category
    `;
    
    const result = await executeQuery(query, params);
    
    res.json({
      success: true,
      message: 'Budget utilization by category retrieved successfully',
      data: result.recordset
    });
  } catch (error) {
    console.error('Error getting budget utilization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get budget utilization data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * @route   GET /api/reports/alerts
 * @desc    Get system alerts (over budget, high utilization)
 * @access  Private
 */
router.get('/alerts', asyncHandler(async (req, res) => {
  // TODO: Implement alerts calculation
  res.json({
    success: true,
    message: 'Get system alerts endpoint - Coming soon',
    data: {
      overBudgetPRFs: [],
      highUtilizationBudgets: [],
      pendingApprovals: [],
      totalAlerts: 0
    }
  });
}));

/**
 * @route   GET /api/reports/export
 * @desc    Export data to CSV/Excel
 * @access  Private
 */
router.get('/export', asyncHandler(async (req, res) => {
  // TODO: Implement data export functionality
  const { type = 'csv', data = 'all', year } = req.query;
  
  res.json({
    success: true,
    message: 'Export data endpoint - Coming soon',
    data: {
      type,
      dataType: data,
      year,
      downloadUrl: null
    }
  });
}));

/**
 * @route   POST /api/reports/custom
 * @desc    Generate custom report
 * @access  Private
 */
router.post('/custom', asyncHandler(async (req, res) => {
  // TODO: Implement custom report generation
  res.json({
    success: true,
    message: 'Generate custom report endpoint - Coming soon',
    data: null
  });
}));

export default router;