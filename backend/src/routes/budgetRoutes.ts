import { Router, Request, Response } from 'express';
import { BudgetModel } from '../models/Budget';
import { CreateBudgetRequest, UpdateBudgetRequest, BudgetQueryParams } from '../models/types';
import { authenticateToken, requireContentManager } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/budgets
 * @desc Get all budgets with filtering and pagination
 * @access Public (will be protected later)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const queryParams: BudgetQueryParams = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      fiscalYear: req.query.fiscalYear ? parseInt(req.query.fiscalYear as string) : undefined,
      department: req.query.department as string,
      budgetType: req.query.budgetType as string,
      status: req.query.status as string,
      coaId: req.query.coaId ? parseInt(req.query.coaId as string) : undefined,
      search: req.query.search as string
    };

    const result = await BudgetModel.findAll(queryParams);
    
    return res.json({
      success: true,
      data: result.budgets,
      pagination: {
        page: queryParams.page,
        limit: queryParams.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / queryParams.limit!)
      }
    });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budgets',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/:id
 * @desc Get budget by ID
 * @access Public (will be protected later)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const budgetId = parseInt(req.params.id);
    
    if (isNaN(budgetId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid budget ID'
      });
    }

    const budget = await BudgetModel.findById(budgetId);
    
    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    return res.json({
      success: true,
      data: budget
    });
  } catch (error) {
    console.error('Error fetching budget:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/coa/:coaId/year/:fiscalYear
 * @desc Get budget by COA and fiscal year
 * @access Public (will be protected later)
 */
router.get('/coa/:coaId/year/:fiscalYear', async (req: Request, res: Response) => {
  try {
    const coaId = parseInt(req.params.coaId);
    const fiscalYear = parseInt(req.params.fiscalYear);
    
    if (isNaN(coaId) || isNaN(fiscalYear)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid COA ID or fiscal year'
      });
    }

    const budget = await BudgetModel.findByCOAAndYear(coaId, fiscalYear);
    
    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    return res.json({
      success: true,
      data: budget
    });
  } catch (error) {
    console.error('Error fetching budget by COA and year:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/budgets
 * @desc Create new budget
 * @access Content Manager (admin or doccon)
 */
router.post('/', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const budgetData: CreateBudgetRequest = req.body;
    
    // Basic validation
    if (!budgetData.COAID || !budgetData.FiscalYear || !budgetData.AllocatedAmount || !budgetData.Department) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: COAID, FiscalYear, AllocatedAmount, Department'
      });
    }

    // Check if budget already exists for this COA and fiscal year
    const existingBudget = await BudgetModel.findByCOAAndYear(budgetData.COAID, budgetData.FiscalYear);
    if (existingBudget) {
      return res.status(409).json({
        success: false,
        message: 'Budget already exists for this COA and fiscal year'
      });
    }
    
    const budget = await BudgetModel.create(budgetData);
    
    return res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data: budget
    });
  } catch (error) {
    console.error('Error creating budget:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create budget',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route PUT /api/budgets/:id
 * @desc Update budget
 * @access Content Manager (admin or doccon)
 */
router.put('/:id', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const budgetId = parseInt(req.params.id);
    const updateData: UpdateBudgetRequest = req.body;
    
    if (isNaN(budgetId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid budget ID'
      });
    }

    // Check if budget exists
    const existingBudget = await BudgetModel.findById(budgetId);
    if (!existingBudget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }
    
    const updatedBudget = await BudgetModel.update(budgetId, updateData);
    
    return res.json({
      success: true,
      message: 'Budget updated successfully',
      data: updatedBudget
    });
  } catch (error) {
    console.error('Error updating budget:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update budget',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route DELETE /api/budgets/:id
 * @desc Delete budget
 * @access Content Manager (admin or doccon)
 */
router.delete('/:id', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const budgetId = parseInt(req.params.id);
    
    if (isNaN(budgetId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid budget ID'
      });
    }

    // Check if budget exists
    const existingBudget = await BudgetModel.findById(budgetId);
    if (!existingBudget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }
    
    const deleted = await BudgetModel.delete(budgetId);
    
    if (deleted) {
      return res.json({
        success: true,
        message: 'Budget deleted successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete budget'
      });
    }
  } catch (error) {
    console.error('Error deleting budget:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete budget',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/:id/utilization
 * @desc Get budget utilization for a specific budget
 * @access Public (will be protected later)
 */
router.get('/:id/utilization', async (req: Request, res: Response) => {
  try {
    const budgetId = parseInt(req.params.id);
    
    if (isNaN(budgetId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid budget ID'
      });
    }

    const utilization = await BudgetModel.getBudgetUtilization(budgetId);
    
    if (!utilization) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    return res.json({
      success: true,
      data: utilization
    });
  } catch (error) {
    console.error('Error fetching budget utilization:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget utilization',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/utilization/department/:department
 * @desc Get budget utilization by department
 * @access Public (will be protected later)
 */
router.get('/utilization/department/:department', async (req: Request, res: Response) => {
  try {
    const department = req.params.department;
    const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear as string) : undefined;

    const utilization = await BudgetModel.getBudgetUtilizationByDepartment(department, fiscalYear);
    
    return res.json({
      success: true,
      data: utilization
    });
  } catch (error) {
    console.error('Error fetching budget utilization by department:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget utilization by department',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/utilization/summary/:fiscalYear
 * @desc Get budget utilization summary by fiscal year
 * @access Public (will be protected later)
 */
router.get('/utilization/summary/:fiscalYear', async (req: Request, res: Response) => {
  try {
    const fiscalYear = parseInt(req.params.fiscalYear);
    
    if (isNaN(fiscalYear)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fiscal year'
      });
    }

    const summary = await BudgetModel.getBudgetUtilizationSummary(fiscalYear);
    
    return res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching budget utilization summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget utilization summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route PUT /api/budgets/:id/update-utilization
 * @desc Update budget utilization (recalculate from PRF data)
 * @access Content Manager (admin or doccon)
 */
router.put('/:id/update-utilization', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const budgetId = parseInt(req.params.id);
    
    if (isNaN(budgetId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid budget ID'
      });
    }

    // Check if budget exists
    const existingBudget = await BudgetModel.findById(budgetId);
    if (!existingBudget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }
    
    const updatedBudget = await BudgetModel.updateUtilization(budgetId);
    
    return res.json({
      success: true,
      message: 'Budget utilization updated successfully',
      data: updatedBudget
    });
  } catch (error) {
    console.error('Error updating budget utilization:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update budget utilization',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/alerts
 * @desc Get budget alerts (over-utilized or near limit)
 * @access Public (will be protected later)
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const thresholdPercentage = req.query.threshold ? parseInt(req.query.threshold as string) : 90;
    
    const alerts = await BudgetModel.getBudgetAlerts(thresholdPercentage);
    
    return res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error fetching budget alerts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget alerts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/statistics
 * @desc Get budget statistics
 * @access Public (will be protected later)
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear as string) : undefined;
    
    const statistics = await BudgetModel.getStatistics(fiscalYear);
    
    return res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error fetching budget statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;