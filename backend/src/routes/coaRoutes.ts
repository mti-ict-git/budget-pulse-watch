import { Router, Request, Response } from 'express';
import { ChartOfAccountsModel } from '../models/ChartOfAccounts';
import { CreateCOARequest, UpdateCOARequest, COAQueryParams } from '../models/types';

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
      accountType: req.query.accountType as string,
      department: req.query.department as string,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : true,
      parentAccountId: req.query.parentAccountId ? parseInt(req.query.parentAccountId as string) : undefined,
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
 * @route GET /api/coa/code/:accountCode
 * @desc Get COA by account code
 * @access Public (will be protected later)
 */
router.get('/code/:accountCode', async (req: Request, res: Response) => {
  try {
    const accountCode = req.params.accountCode;
    
    const coa = await ChartOfAccountsModel.findByAccountCode(accountCode);
    
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
 * @access Public (will be protected later)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const coaData: CreateCOARequest = req.body;
    
    // Basic validation
    if (!coaData.AccountCode || !coaData.AccountName || !coaData.AccountType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: AccountCode, AccountName, AccountType'
      });
    }

    // Check if account code already exists
    const existingCOA = await ChartOfAccountsModel.findByAccountCode(coaData.AccountCode);
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
 * @access Public (will be protected later)
 */
router.put('/:id', async (req: Request, res: Response) => {
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
    if (updateData.AccountCode) {
      const codeExists = await ChartOfAccountsModel.accountCodeExists(updateData.AccountCode, coaId);
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
 * @access Public (will be protected later)
 */
router.delete('/:id', async (req: Request, res: Response) => {
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
 * @access Public (will be protected later)
 */
router.delete('/:id/hard', async (req: Request, res: Response) => {
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
    const parentAccountId = parseInt(req.params.id);
    
    if (isNaN(parentAccountId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent account ID'
      });
    }

    const children = await ChartOfAccountsModel.getChildAccounts(parentAccountId);
    
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
 * @route GET /api/coa/type/:accountType
 * @desc Get accounts by type
 * @access Public (will be protected later)
 */
router.get('/type/:accountType', async (req: Request, res: Response) => {
  try {
    const accountType = req.params.accountType;
    
    const accounts = await ChartOfAccountsModel.getAccountsByType(accountType);
    
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
 * @route GET /api/coa/department/:department
 * @desc Get accounts by department
 * @access Public (will be protected later)
 */
router.get('/department/:department', async (req: Request, res: Response) => {
  try {
    const department = req.params.department;
    
    const accounts = await ChartOfAccountsModel.getAccountsByDepartment(department);
    
    return res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('Error fetching accounts by department:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch accounts by department',
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
 * @access Public (will be protected later)
 */
router.post('/bulk-import', async (req: Request, res: Response) => {
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
      if (!account.AccountCode || !account.AccountName || !account.AccountType) {
        return res.status(400).json({
          success: false,
          message: 'Each account must have AccountCode, AccountName, and AccountType'
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
 * @access Public (will be protected later)
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

export default router;