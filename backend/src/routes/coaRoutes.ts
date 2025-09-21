import { Router, Request, Response } from 'express';
import { ChartOfAccountsModel } from '../models/ChartOfAccounts';
import { CreateCOARequest, UpdateCOARequest, COAQueryParams, BulkUpdateCOARequest, BulkDeleteCOARequest } from '../models/types';
import { authenticateToken, requireContentManager } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/coa
 * @desc Get all Chart of Accounts with filtering and pagination
 * @access Public (will be protected later)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const queryParams: COAQueryParams = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      category: req.query.category as string,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : true,
      parentCOAID: req.query.parentCOAID ? parseInt(req.query.parentCOAID as string) : undefined,
      expenseType: req.query.expenseType as 'CAPEX' | 'OPEX',
      department: req.query.department as string,
      search: req.query.search as string
    };

    const result = await ChartOfAccountsModel.findAll(queryParams);
    
    return res.json({
      success: true,
      data: result.accounts,
      pagination: {
        page: queryParams.page,
        limit: queryParams.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / queryParams.limit!)
      }
    });
  } catch (error) {
    console.error('Error fetching Chart of Accounts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Chart of Accounts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/coa/:id
 * @desc Get COA by ID
 * @access Public (will be protected later)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const coaId = parseInt(req.params.id);
    
    if (isNaN(coaId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid COA ID'
      });
    }

    const coa = await ChartOfAccountsModel.findById(coaId);
    
    if (!coa) {
      return res.status(404).json({
        success: false,
        message: 'Chart of Account not found'
      });
    }

    return res.json({
      success: true,
      data: coa
    });
  } catch (error) {
    console.error('Error fetching COA:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Chart of Account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/coa/code/:coaCode
 * @desc Get COA by account code
 * @access Public (will be protected later)
 */
router.get('/code/:coaCode', async (req: Request, res: Response) => {
  try {
    const coaCode = req.params.coaCode;
    
    const coa = await ChartOfAccountsModel.findByAccountCode(coaCode);
    
    if (!coa) {
      return res.status(404).json({
        success: false,
        message: 'Chart of Account not found'
      });
    }

    return res.json({
      success: true,
      data: coa
    });
  } catch (error) {
    console.error('Error fetching COA by code:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch Chart of Account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/coa
 * @desc Create new COA
 * @access Content Manager (admin or doccon)
 */
router.post('/', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const coaData: CreateCOARequest = req.body;
    
    // Basic validation
    if (!coaData.COACode || !coaData.COAName || !coaData.Category) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: COACode, COAName, Category'
      });
    }

    // Check if account code already exists
    const existingCOA = await ChartOfAccountsModel.findByAccountCode(coaData.COACode);
    if (existingCOA) {
      return res.status(409).json({
        success: false,
        message: 'Account code already exists'
      });
    }
    
    const coa = await ChartOfAccountsModel.create(coaData);
    
    return res.status(201).json({
      success: true,
      message: 'Chart of Account created successfully',
      data: coa
    });
  } catch (error) {
    console.error('Error creating COA:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create Chart of Account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route PUT /api/coa/:id
 * @desc Update COA
 * @access Content Manager (admin or doccon)
 */
router.put('/:id', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const coaId = parseInt(req.params.id);
    const updateData: UpdateCOARequest = req.body;
    
    if (isNaN(coaId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid COA ID'
      });
    }

    // Check if COA exists
    const existingCOA = await ChartOfAccountsModel.findById(coaId);
    if (!existingCOA) {
      return res.status(404).json({
        success: false,
        message: 'Chart of Account not found'
      });
    }

    // Check if account code already exists (if being updated)
    if (updateData.COACode) {
      const codeExists = await ChartOfAccountsModel.accountCodeExists(updateData.COACode, coaId);
      if (codeExists) {
        return res.status(409).json({
          success: false,
          message: 'Account code already exists'
        });
      }
    }
    
    const updatedCOA = await ChartOfAccountsModel.update(coaId, updateData);
    
    return res.json({
      success: true,
      message: 'Chart of Account updated successfully',
      data: updatedCOA
    });
  } catch (error) {
    console.error('Error updating COA:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Chart of Account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route DELETE /api/coa/:id
 * @desc Delete COA (soft delete)
 * @access Content Manager (admin or doccon)
 */
router.delete('/:id', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const coaId = parseInt(req.params.id);
    
    if (isNaN(coaId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid COA ID'
      });
    }

    // Check if COA exists
    const existingCOA = await ChartOfAccountsModel.findById(coaId);
    if (!existingCOA) {
      return res.status(404).json({
        success: false,
        message: 'Chart of Account not found'
      });
    }
    
    const deleted = await ChartOfAccountsModel.delete(coaId);
    
    if (deleted) {
      return res.json({
        success: true,
        message: 'Chart of Account deactivated successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to deactivate Chart of Account'
      });
    }
  } catch (error) {
    console.error('Error deleting COA:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete Chart of Account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route DELETE /api/coa/:id/hard
 * @desc Hard delete COA (permanent deletion)
 * @access Content Manager (admin or doccon)
 */
router.delete('/:id/hard', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const coaId = parseInt(req.params.id);
    
    if (isNaN(coaId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid COA ID'
      });
    }

    // Check if COA exists
    const existingCOA = await ChartOfAccountsModel.findById(coaId);
    if (!existingCOA) {
      return res.status(404).json({
        success: false,
        message: 'Chart of Account not found'
      });
    }
    
    const deleted = await ChartOfAccountsModel.hardDelete(coaId);
    
    if (deleted) {
      return res.json({
        success: true,
        message: 'Chart of Account permanently deleted'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete Chart of Account'
      });
    }
  } catch (error) {
    console.error('Error hard deleting COA:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete Chart of Account',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/coa/hierarchy
 * @desc Get COA hierarchy (parent-child relationships)
 * @access Public (will be protected later)
 */
router.get('/hierarchy', async (req: Request, res: Response) => {
  try {
    const hierarchy = await ChartOfAccountsModel.getHierarchy();
    
    return res.json({
      success: true,
      data: hierarchy
    });
  } catch (error) {
    console.error('Error fetching COA hierarchy:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch COA hierarchy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/coa/:id/children
 * @desc Get child accounts of a parent account
 * @access Public (will be protected later)
 */
router.get('/:id/children', async (req: Request, res: Response) => {
  try {
    const parentCOAID = parseInt(req.params.id);
    
    if (isNaN(parentCOAID)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent COA ID'
      });
    }

    const children = await ChartOfAccountsModel.getChildAccounts(parentCOAID);
    
    return res.json({
      success: true,
      data: children
    });
  } catch (error) {
    console.error('Error fetching child accounts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch child accounts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/coa/roots
 * @desc Get root accounts (accounts with no parent)
 * @access Public (will be protected later)
 */
router.get('/roots', async (req: Request, res: Response) => {
  try {
    const roots = await ChartOfAccountsModel.getRootAccounts();
    
    return res.json({
      success: true,
      data: roots
    });
  } catch (error) {
    console.error('Error fetching root accounts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch root accounts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/coa/category/:category
 * @desc Get accounts by category
 * @access Public (will be protected later)
 */
router.get('/category/:category', async (req: Request, res: Response) => {
  try {
    const category = req.params.category;
    
    const accounts = await ChartOfAccountsModel.getAccountsByType(category);
    
    return res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('Error fetching accounts by type:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch accounts by type',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/coa/:id/usage
 * @desc Get account usage statistics
 * @access Public (will be protected later)
 */
router.get('/:id/usage', async (req: Request, res: Response) => {
  try {
    const coaId = parseInt(req.params.id);
    
    if (isNaN(coaId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid COA ID'
      });
    }

    const usage = await ChartOfAccountsModel.getAccountUsage(coaId);
    
    return res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Error fetching account usage:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch account usage',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/coa/bulk-import
 * @desc Bulk import COA data
 * @access Content Manager (admin or doccon)
 */
router.post('/bulk-import', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const accounts: CreateCOARequest[] = req.body.accounts;
    
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Accounts array is required'
      });
    }

    // Basic validation for each account
    for (const account of accounts) {
      if (!account.COACode || !account.COAName || !account.Category) {
        return res.status(400).json({
          success: false,
          message: 'Each account must have COACode, COAName, and Category'
        });
      }
    }
    
    const importedAccounts = await ChartOfAccountsModel.bulkImport(accounts);
    
    return res.status(201).json({
      success: true,
      message: `${importedAccounts.length} accounts imported successfully`,
      data: importedAccounts
    });
  } catch (error) {
    console.error('Error bulk importing COA:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk import accounts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/coa/statistics
 * @desc Get COA statistics
 * @access Public
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const statistics = await ChartOfAccountsModel.getStatistics();
    return res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error fetching COA statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch COA statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route PUT /api/coa/bulk-update
 * @desc Bulk update multiple COA records
 * @access Protected (Content Manager)
 */
router.put('/bulk-update', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const bulkData: BulkUpdateCOARequest = req.body;

    // Validate request
    if (!bulkData.accountIds || !Array.isArray(bulkData.accountIds) || bulkData.accountIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Account IDs are required and must be a non-empty array'
      });
    }

    if (!bulkData.updates || Object.keys(bulkData.updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates are required'
      });
    }

    const updatedAccounts = await ChartOfAccountsModel.bulkUpdate(bulkData);

    return res.json({
      success: true,
      message: `Successfully updated ${updatedAccounts.length} accounts`,
      data: updatedAccounts
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk update accounts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route DELETE /api/coa/bulk-delete
 * @desc Bulk delete multiple COA records
 * @access Protected (Content Manager)
 */
router.delete('/bulk-delete', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const bulkData: BulkDeleteCOARequest = req.body;

    // Validate request
    if (!bulkData.accountIds || !Array.isArray(bulkData.accountIds) || bulkData.accountIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Account IDs are required and must be a non-empty array'
      });
    }

    const deletedCount = await ChartOfAccountsModel.bulkDelete(bulkData);

    const action = bulkData.hard ? 'permanently deleted' : 'deactivated';
    return res.json({
      success: true,
      message: `Successfully ${action} ${deletedCount} accounts`,
      data: { deletedCount, hard: bulkData.hard || false }
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk delete accounts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;