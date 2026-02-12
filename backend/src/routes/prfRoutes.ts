import { Router, Request, Response } from 'express';
import { PRFModel } from '../models/PRF';
import { CreatePRFRequest, UpdatePRFRequest, PRFQueryParams, CreatePRFItemRequest } from '../models/types';
import { authenticateToken, requireContentManager } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/prfs
 * @desc Get all PRFs with filtering and pagination
 * @access Public (will be protected later)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const queryParams: PRFQueryParams = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      Status: req.query.status as string,
      Department: req.query.department as string,
      Priority: req.query.priority as string,
      RequestorID: req.query.requestorId ? parseInt(req.query.requestorId as string) : undefined,
      COAID: req.query.coaId ? parseInt(req.query.coaId as string) : undefined,
      DateFrom: req.query.dateFrom as string,
      DateTo: req.query.dateTo as string,
      Search: req.query.search as string
    };

    const result = await PRFModel.findAll(queryParams);
    
    return res.json({
      success: true,
      data: result.prfs,
      pagination: {
        page: queryParams.page,
        limit: queryParams.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / queryParams.limit!)
      }
    });
  } catch (error) {
    console.error('Error fetching PRFs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch PRFs',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/prfs/with-items
 * @desc Get all PRFs with their items
 * @access Public (will be protected later)
 */
router.get('/with-items', async (req: Request, res: Response) => {
  try {
    const queryParams: PRFQueryParams = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      Status: req.query.status as string,
      Department: req.query.department as string,
      Priority: req.query.priority as string,
      RequestorID: req.query.requestorId ? parseInt(req.query.requestorId as string) : undefined,
      COAID: req.query.coaId ? parseInt(req.query.coaId as string) : undefined,
      DateFrom: req.query.dateFrom as string,
      DateTo: req.query.dateTo as string,
      Search: req.query.search as string
    };

    const result = await PRFModel.findAllWithItems(queryParams);
    
    return res.json({
      success: true,
      data: result.prfs,
      pagination: {
        page: queryParams.page,
        limit: queryParams.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / queryParams.limit!)
      }
    });
  } catch (error) {
    console.error('Error fetching PRFs with items:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch PRFs with items',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/prfs/search
 * @desc Search PRFs (lightweight endpoint for filter search box)
 * @access Public (will be protected later)
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 20;
    const limit = Number.isFinite(limitRaw) ? limitRaw : 20;

    const data = await PRFModel.searchSummaries(q, limit);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error searching PRFs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search PRFs',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route DELETE /api/prfs/bulk
 * @desc Delete multiple PRFs
 * @access Content Manager (admin or doccon)
 */
router.delete('/bulk', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or empty IDs array'
      });
    }

    // Validate all IDs are numbers
    const prfIds = ids.map(id => {
      const numId = parseInt(id);
      if (isNaN(numId)) {
        throw new Error(`Invalid PRF ID: ${id}`);
      }
      return numId;
    });

    let deletedCount = 0;
    const errors: string[] = [];

    // Delete each PRF individually to handle errors gracefully
    for (const prfId of prfIds) {
      try {
        const deleted = await PRFModel.delete(prfId);
        if (deleted) {
          deletedCount++;
        } else {
          errors.push(`PRF ID ${prfId} not found`);
        }
      } catch (error) {
        errors.push(`Failed to delete PRF ID ${prfId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} of ${prfIds.length} PRFs`,
      data: {
        deletedCount,
        totalRequested: prfIds.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error in bulk delete:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete PRFs',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/prfs/:id
 * @desc Get PRF by ID
 * @access Public (will be protected later)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const prfId = parseInt(req.params.id);
    
    if (isNaN(prfId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PRF ID'
      });
    }

    const prf = await PRFModel.findById(prfId);
    
    if (!prf) {
      return res.status(404).json({
        success: false,
        message: 'PRF not found'
      });
    }

    return res.json({
      success: true,
      data: prf
    });
  } catch (error) {
    console.error('Error fetching PRF:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch PRF',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/prfs/:id/with-items
 * @desc Get PRF by ID with items
 * @access Public (will be protected later)
 */
router.get('/:id/with-items', async (req: Request, res: Response) => {
  try {
    const prfId = parseInt(req.params.id);
    
    if (isNaN(prfId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PRF ID'
      });
    }

    const prf = await PRFModel.findByIdWithItems(prfId);
    
    if (!prf) {
      return res.status(404).json({
        success: false,
        message: 'PRF not found'
      });
    }

    return res.json({
      success: true,
      data: prf
    });
  } catch (error) {
    console.error('Error fetching PRF with items:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch PRF with items',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/prfs/prfno/:prfNo
 * @desc Get PRF by PRFNo
 * @access Public (will be protected later)
 */
router.get('/prfno/:prfNo', async (req: Request, res: Response) => {
  try {
    const prfNo = req.params.prfNo;
    
    const prf = await PRFModel.findByPRFNo(prfNo);
    
    if (!prf) {
      return res.status(404).json({
        success: false,
        message: 'PRF not found'
      });
    }

    return res.json({
      success: true,
      data: prf
    });
  } catch (error) {
    console.error('Error fetching PRF by number:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch PRF',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/prfs
 * @desc Create new PRF
 * @access Content Manager (admin or doccon)
 */
router.post('/', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const prfData: CreatePRFRequest = req.body;
    
    // Basic validation
    if (!prfData.Title || !prfData.Department || !prfData.COAID || !prfData.RequestedAmount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: Title, Department, COAID, RequestedAmount'
      });
    }

    // Use authenticated user as requestor
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const requestorId = req.user.UserID;
    
    // If SubmitBy is not provided, use the authenticated user's name
    if (!prfData.SubmitBy) {
      const userDisplayName = req.user.FirstName && req.user.LastName 
        ? `${req.user.FirstName} ${req.user.LastName}` 
        : req.user.Username;
      prfData.SubmitBy = userDisplayName;
    }
    
    const prf = await PRFModel.create(prfData, requestorId);
    
    return res.status(201).json({
      success: true,
      message: 'PRF created successfully',
      data: prf
    });
  } catch (error) {
    console.error('Error creating PRF:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create PRF',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route PUT /api/prfs/:id
 * @desc Update PRF
 * @access Content Manager (admin or doccon)
 */
router.put('/:id', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const prfId = parseInt(req.params.id);
    const updateData: UpdatePRFRequest = req.body;
    
    if (isNaN(prfId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PRF ID'
      });
    }

    // Check if PRF exists
    const existingPRF = await PRFModel.findById(prfId);
    if (!existingPRF) {
      return res.status(404).json({
        success: false,
        message: 'PRF not found'
      });
    }
    
    const updatedPRF = await PRFModel.update(prfId, updateData);
    
    return res.json({
      success: true,
      message: 'PRF updated successfully',
      data: updatedPRF
    });
  } catch (error) {
    console.error('Error updating PRF:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update PRF',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route DELETE /api/prfs/:id
 * @desc Delete PRF
 * @access Content Manager (admin or doccon)
 */
router.delete('/:id', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const prfId = parseInt(req.params.id);
    
    if (isNaN(prfId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PRF ID'
      });
    }

    // Check if PRF exists
    const existingPRF = await PRFModel.findById(prfId);
    if (!existingPRF) {
      return res.status(404).json({
        success: false,
        message: 'PRF not found'
      });
    }
    
    const deleted = await PRFModel.delete(prfId);
    
    if (deleted) {
      return res.json({
        success: true,
        message: 'PRF deleted successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete PRF'
      });
    }
  } catch (error) {
    console.error('Error deleting PRF:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete PRF',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/prfs/:id/items
 * @desc Add items to PRF
 * @access Content Manager (admin or doccon)
 */
router.post('/:id/items', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const prfId = parseInt(req.params.id);
    const items: CreatePRFItemRequest[] = req.body.items;
    
    if (isNaN(prfId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PRF ID'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required'
      });
    }

    // Validate required fields for each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.ItemName || !item.Quantity || !item.UnitPrice) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: ItemName, Quantity, and UnitPrice are required`
        });
      }
      if (!item.PurchaseCostCode || !item.COAID || !item.BudgetYear) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: PurchaseCostCode, COAID, and BudgetYear are required`
        });
      }
    }

    // Check if PRF exists
    const existingPRF = await PRFModel.findById(prfId);
    if (!existingPRF) {
      return res.status(404).json({
        success: false,
        message: 'PRF not found'
      });
    }
    
    const addedItems = await PRFModel.addItems(prfId, items);
    
    return res.status(201).json({
      success: true,
      message: 'Items added successfully',
      data: addedItems
    });
  } catch (error) {
    console.error('Error adding PRF items:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add PRF items',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/prfs/:id/items
 * @desc Get PRF items
 * @access Public (will be protected later)
 */
router.get('/:id/items', async (req: Request, res: Response) => {
  try {
    const prfId = parseInt(req.params.id);
    
    if (isNaN(prfId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PRF ID'
      });
    }

    const items = await PRFModel.getItems(prfId);
    
    return res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error fetching PRF items:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch PRF items',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route PUT /api/prfs/items/:itemId
 * @desc Update PRF item
 * @access Content Manager (admin or doccon)
 */
router.put('/items/:itemId', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const updateData: Partial<CreatePRFItemRequest> = req.body;
    
    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID'
      });
    }
    
    const updatedItem = await PRFModel.updateItem(itemId, updateData);
    
    return res.json({
      success: true,
      message: 'PRF item updated successfully',
      data: updatedItem
    });
  } catch (error) {
    console.error('Error updating PRF item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update PRF item',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route DELETE /api/prfs/items/:itemId
 * @desc Delete PRF item
 * @access Content Manager (admin or doccon)
 */
router.delete('/items/:itemId', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.itemId);
    
    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID'
      });
    }
    
    const deleted = await PRFModel.deleteItem(itemId);
    
    if (deleted) {
      return res.json({
        success: true,
        message: 'PRF item deleted successfully'
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'PRF item not found'
      });
    }
  } catch (error) {
    console.error('Error deleting PRF item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete PRF item',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/prfs/statistics
 * @desc Get PRF statistics
 * @access Public (will be protected later)
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const stats = await PRFModel.getStatistics();
    
    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching PRF statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch PRF statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/prfs/filters/status
 * @desc Get unique status values from database
 * @access Public
 */
router.get('/filters/status', async (req: Request, res: Response) => {
  try {
    const statusValues = await PRFModel.getUniqueStatusValues();
    
    return res.json({
      success: true,
      data: statusValues
    });
  } catch (error) {
    console.error('Error fetching status values:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch status values',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
