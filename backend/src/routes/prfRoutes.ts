import { Router, Request, Response } from 'express';
import { PRFModel } from '../models/PRF';
import { CreatePRFRequest, UpdatePRFRequest, PRFQueryParams, CreatePRFItemRequest, UpdatePRFItemParams } from '../models/types';
import { executeQuery } from '../config/database';
import { authenticateToken, requireContentManager } from '../middleware/auth';
import { NotificationModel } from '../models/Notification';

const router = Router();

type ParseNullableIntResult = { ok: true; value: number | null } | { ok: false };

const parseNullableInt = (value: unknown): ParseNullableIntResult => {
  if (value === null) return { ok: true, value: null };
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) return { ok: false };
    return { ok: true, value };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return { ok: true, value: null };
    if (!/^-?\d+$/.test(trimmed)) return { ok: false };
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? { ok: false } : { ok: true, value: parsed };
  }
  return { ok: false };
};

type ParseNullableStringResult = { ok: true; value: string | null } | { ok: false };

const parseNullableString = (value: unknown): ParseNullableStringResult => {
  if (value === null) return { ok: true, value: null };
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? { ok: true, value: null } : { ok: true, value: trimmed };
  }
  return { ok: false };
};

const isProntoSyncRequest = (req: Request): boolean => {
  const syncSourceHeader = req.headers['x-sync-source'];
  const syncSource = typeof syncSourceHeader === 'string' ? syncSourceHeader.trim().toLowerCase() : '';
  const isApiKeyAuth = Boolean(req.user && req.user.UserID === 0 && req.user.Username.startsWith('api-key:'));
  return syncSource === 'pronto' || isApiKeyAuth;
};

const valuesEqualForNotification = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  return false;
};

const getChangedKeys = (existing: unknown, updated: unknown, update: unknown): string[] => {
  const existingRec = existing as Record<string, unknown>;
  const updatedRec = updated as Record<string, unknown>;
  const updateRec = update as Record<string, unknown>;
  return Object.keys(updateRec)
    .filter((k) => updateRec[k] !== undefined)
    .filter((k) => !valuesEqualForNotification(existingRec[k], updatedRec[k]));
};

const resolveAuditActorUserId = async (req: Request): Promise<number> => {
  if (req.user && typeof req.user.UserID === 'number' && req.user.UserID > 0) return req.user.UserID;
  const raw = process.env.PRONTO_SYNC_CHANGED_BY_USER_ID || process.env.SYSTEM_SYNC_USER_ID || '';
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isInteger(parsed) && parsed > 0) return parsed;

  const fallback = await executeQuery<{ UserID: number }>(
    `
      SELECT TOP 1 UserID
      FROM Users
      WHERE IsActive = 1
        AND Role IN ('admin', 'doccon')
      ORDER BY Role DESC, UserID ASC
    `
  );
  const userId = fallback.recordset[0]?.UserID;
  return typeof userId === 'number' && userId > 0 ? userId : 1;
};

const insertProntoAuditLog = async (
  req: Request,
  prf: { PRFID: number; PRFNo: string },
  existing: unknown,
  updated: unknown,
  changedKeys: string[]
): Promise<void> => {
  if (changedKeys.length === 0) return;
  const existingRec = existing as Record<string, unknown>;
  const updatedRec = updated as Record<string, unknown>;

  const oldChanges: Record<string, unknown> = {};
  const newChanges: Record<string, unknown> = {};
  changedKeys.forEach((k) => {
    oldChanges[k] = existingRec[k];
    newChanges[k] = updatedRec[k];
  });

  const oldValues = JSON.stringify({ source: 'pronto', prfNo: prf.PRFNo, changes: oldChanges });
  const newValues = JSON.stringify({ source: 'pronto', prfNo: prf.PRFNo, changes: newChanges });
  const changedBy = await resolveAuditActorUserId(req);

  await executeQuery(
    `
      INSERT INTO AuditLog (TableName, RecordID, Action, OldValues, NewValues, ChangedBy)
      VALUES ('PRF', @RecordID, 'UPDATE', @OldValues, @NewValues, @ChangedBy)
    `,
    {
      RecordID: prf.PRFID,
      OldValues: oldValues,
      NewValues: newValues,
      ChangedBy: changedBy
    }
  );
};

const notifyProntoUpdate = async (
  prf: { PRFID: number; PRFNo: string; RequestorID: number },
  updated: unknown,
  changedKeys: string[]
): Promise<void> => {
  const relevant = changedKeys.filter((k) => k === 'Status' || k === 'ApprovedByName');
  if (relevant.length === 0) return;
  const updatedRec = updated as Record<string, unknown>;
  const status = typeof updatedRec.Status === 'string' ? updatedRec.Status : undefined;
  const approvedByName = typeof updatedRec.ApprovedByName === 'string' ? updatedRec.ApprovedByName : undefined;

  const parts: string[] = [];
  if (relevant.includes('Status')) parts.push(`Status -> ${status || '—'}`);
  if (relevant.includes('ApprovedByName')) parts.push(`Approved By -> ${approvedByName || '—'}`);

  const title = 'PRF Updated from Pronto';
  const message = `PRF ${prf.PRFNo}: ${parts.join(', ')}`;

  const recipients = new Set<number>();
  if (prf.RequestorID > 0) recipients.add(prf.RequestorID);
  const admins = await executeQuery<{ UserID: number }>(
    `
      SELECT UserID
      FROM Users
      WHERE IsActive = 1
        AND Role IN ('admin', 'doccon')
    `
  );
  admins.recordset.forEach((u) => {
    if (u.UserID > 0) recipients.add(u.UserID);
  });

  await Promise.all(
    Array.from(recipients).map((userId) =>
      NotificationModel.create({
        UserID: userId,
        Title: title,
        Message: message,
        ReferenceType: 'PRF',
        ReferenceID: prf.PRFID
      })
    )
  );
};

/**
 * @route GET /api/prfs
 * @desc Get all PRFs with filtering and pagination
 * @access Public (will be protected later)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const yearParam = req.query.year as string | undefined;
    const parsedYear = yearParam && /^\d{4}$/.test(yearParam) ? parseInt(yearParam, 10) : undefined;
    const queryParams: PRFQueryParams = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      Year: parsedYear,
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
    const yearParam = req.query.year as string | undefined;
    const parsedYear = yearParam && /^\d{4}$/.test(yearParam) ? parseInt(yearParam, 10) : undefined;
    const queryParams: PRFQueryParams = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      Year: parsedYear,
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

router.get('/picking-pic-users', authenticateToken, requireContentManager, async (_req: Request, res: Response) => {
  try {
    const result = await executeQuery<{
      UserID: number;
      Username: string;
      FirstName: string;
      LastName: string;
      Role: 'admin' | 'doccon' | 'user';
    }>(
      `
      SELECT UserID, Username, FirstName, LastName, Role
      FROM Users
      WHERE IsActive = 1
        AND Role IN ('admin', 'doccon')
      ORDER BY Role DESC, FirstName ASC, LastName ASC
      `
    );

    return res.json({
      success: true,
      data: result.recordset.map((user) => ({
        userId: user.UserID,
        username: user.Username,
        displayName: `${user.FirstName} ${user.LastName}`.trim(),
        role: user.Role
      }))
    });
  } catch (error) {
    console.error('Error fetching picking PIC users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch picking PIC users',
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
    if (prfData.CurrencyCode && !['IDR', 'USD'].includes(prfData.CurrencyCode)) {
      return res.status(400).json({
        success: false,
        message: 'CurrencyCode must be IDR or USD'
      });
    }
    if (prfData.ExchangeRateToIDR !== undefined && prfData.ExchangeRateToIDR <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ExchangeRateToIDR must be greater than 0'
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
    if (updateData.ApprovedBy !== undefined) {
      const parsedApprovedBy = parseNullableInt(updateData.ApprovedBy);
      if (!parsedApprovedBy.ok) {
        return res.status(400).json({
          success: false,
          message: 'ApprovedBy must be an integer or null'
        });
      }
      updateData.ApprovedBy = parsedApprovedBy.value;
    }
    if (updateData.ApprovedByName !== undefined) {
      const parsedApprovedByName = parseNullableString(updateData.ApprovedByName);
      if (!parsedApprovedByName.ok) {
        return res.status(400).json({
          success: false,
          message: 'ApprovedByName must be a string or null'
        });
      }
      updateData.ApprovedByName = parsedApprovedByName.value;
    }
    if (updateData.CurrencyCode && !['IDR', 'USD'].includes(updateData.CurrencyCode)) {
      return res.status(400).json({
        success: false,
        message: 'CurrencyCode must be IDR or USD'
      });
    }
    if (updateData.ExchangeRateToIDR !== undefined && updateData.ExchangeRateToIDR <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ExchangeRateToIDR must be greater than 0'
      });
    }
    
    const updatedPRF = await PRFModel.update(prfId, updateData);
    if (isProntoSyncRequest(req) && existingPRF.PRFID && existingPRF.PRFNo && existingPRF.RequestorID) {
      const changedKeys = getChangedKeys(existingPRF, updatedPRF, updateData);
      try {
        await insertProntoAuditLog(req, { PRFID: existingPRF.PRFID, PRFNo: existingPRF.PRFNo }, existingPRF, updatedPRF, changedKeys);
        await notifyProntoUpdate(
          { PRFID: existingPRF.PRFID, PRFNo: existingPRF.PRFNo, RequestorID: existingPRF.RequestorID },
          updatedPRF,
          changedKeys
        );
      } catch (e) {
        console.error('Failed to create Pronto notifications:', e);
      }
    }
    
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
 * @route PUT /api/prfs/prfno/:prfNo
 * @desc Update PRF by business number (PRFNo)
 * @access Content Manager (admin or doccon)
 */
router.put('/prfno/:prfNo', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const prfNo = req.params.prfNo;
    const updateData: UpdatePRFRequest = req.body;

    if (!prfNo || prfNo.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PRF number'
      });
    }

    const existingPRF = await PRFModel.findByPRFNo(prfNo);
    if (!existingPRF) {
      return res.status(404).json({
        success: false,
        message: 'PRF not found'
      });
    }

    if (updateData.ApprovedBy !== undefined) {
      const parsedApprovedBy = parseNullableInt(updateData.ApprovedBy);
      if (!parsedApprovedBy.ok) {
        return res.status(400).json({
          success: false,
          message: 'ApprovedBy must be an integer or null'
        });
      }
      updateData.ApprovedBy = parsedApprovedBy.value;
    }
    if (updateData.ApprovedByName !== undefined) {
      const parsedApprovedByName = parseNullableString(updateData.ApprovedByName);
      if (!parsedApprovedByName.ok) {
        return res.status(400).json({
          success: false,
          message: 'ApprovedByName must be a string or null'
        });
      }
      updateData.ApprovedByName = parsedApprovedByName.value;
    }
    if (updateData.CurrencyCode && !['IDR', 'USD'].includes(updateData.CurrencyCode)) {
      return res.status(400).json({
        success: false,
        message: 'CurrencyCode must be IDR or USD'
      });
    }
    if (updateData.ExchangeRateToIDR !== undefined && updateData.ExchangeRateToIDR <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ExchangeRateToIDR must be greater than 0'
      });
    }

    const updatedPRF = await PRFModel.update(existingPRF.PRFID, updateData);
    if (isProntoSyncRequest(req) && existingPRF.PRFID && existingPRF.PRFNo && existingPRF.RequestorID) {
      const changedKeys = getChangedKeys(existingPRF, updatedPRF, updateData);
      try {
        await insertProntoAuditLog(req, { PRFID: existingPRF.PRFID, PRFNo: existingPRF.PRFNo }, existingPRF, updatedPRF, changedKeys);
        await notifyProntoUpdate(
          { PRFID: existingPRF.PRFID, PRFNo: existingPRF.PRFNo, RequestorID: existingPRF.RequestorID },
          updatedPRF,
          changedKeys
        );
      } catch (e) {
        console.error('Failed to create Pronto notifications:', e);
      }
    }
    return res.json({
      success: true,
      message: 'PRF updated successfully',
      data: updatedPRF
    });
  } catch (error) {
    console.error('Error updating PRF by number:', error);
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

type PrfActivityEventType = 'prf' | 'document';

type PrfActivityEvent = {
  id: string;
  type: PrfActivityEventType;
  title: string;
  detail: string | undefined;
  occurredAt: string;
  actor: string | undefined;
};

type AuditLogRow = {
  AuditID: number;
  Action: 'INSERT' | 'UPDATE' | 'DELETE';
  ChangedAt: Date;
  ChangedByName: string | null;
  OldValues: string | null;
  NewValues: string | null;
};

type PrfFileRow = {
  FileID: number;
  OriginalFileName: string;
  UploadDate: Date;
  UploadedByName: string | null;
  Description: string | null;
};

const truncateText = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
};
router.get('/:id/activity', async (req: Request, res: Response) => {
  try {
    const prfId = parseInt(req.params.id);
    if (isNaN(prfId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PRF ID'
      });
    }

    const limit = parseInt(String(req.query.limit ?? '25'));
    const safeLimit = Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 25;

    const auditQuery = `
      SELECT TOP (@Limit)
        a.AuditID,
        a.Action,
        a.ChangedAt,
        a.OldValues,
        a.NewValues,
        u.FirstName + ' ' + u.LastName as ChangedByName
      FROM AuditLog a
      LEFT JOIN Users u ON a.ChangedBy = u.UserID
      WHERE a.TableName = 'PRF' AND a.RecordID = @PRFID
      ORDER BY a.ChangedAt DESC
    `;

    const filesQuery = `
      SELECT TOP (@Limit)
        f.FileID,
        f.OriginalFileName,
        f.UploadDate,
        f.Description,
        u.FirstName + ' ' + u.LastName as UploadedByName
      FROM PRFFiles f
      LEFT JOIN Users u ON f.UploadedBy = u.UserID
      WHERE f.PRFID = @PRFID
      ORDER BY f.UploadDate DESC
    `;

    const params = { PRFID: prfId, Limit: safeLimit };

    const [auditResult, filesResult] = await Promise.all([
      executeQuery<AuditLogRow>(auditQuery, params),
      executeQuery<PrfFileRow>(filesQuery, params)
    ]);

    const auditEvents: PrfActivityEvent[] = auditResult.recordset.map((row) => {
      const title =
        row.Action === 'INSERT'
          ? 'PRF created'
          : row.Action === 'DELETE'
            ? 'PRF deleted'
            : 'PRF updated';

      const detailSource = row.Action === 'DELETE' ? row.OldValues : row.NewValues;
      const detail = typeof detailSource === 'string' && detailSource.trim().length > 0 ? truncateText(detailSource, 220) : undefined;

      return {
        id: `audit-${row.AuditID}`,
        type: 'prf',
        title,
        detail,
        occurredAt: row.ChangedAt.toISOString(),
        actor: row.ChangedByName ?? undefined
      };
    });

    const fileEvents: PrfActivityEvent[] = filesResult.recordset.map((row) => {
      const detail = typeof row.Description === 'string' && row.Description.trim().length > 0 ? truncateText(row.Description, 220) : undefined;
      return {
        id: `file-${row.FileID}`,
        type: 'document',
        title: `Document uploaded: ${row.OriginalFileName}`,
        detail,
        occurredAt: row.UploadDate.toISOString(),
        actor: row.UploadedByName ?? undefined
      };
    });

    const combined = [...auditEvents, ...fileEvents].sort((a, b) => {
      const aTime = new Date(a.occurredAt).getTime();
      const bTime = new Date(b.occurredAt).getTime();
      return bTime - aTime;
    });

    return res.json({
      success: true,
      data: combined.slice(0, safeLimit)
    });
  } catch (error) {
    console.error('Error fetching PRF activity:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch PRF activity',
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
    const updateData: Partial<UpdatePRFItemParams> = req.body;
    
    if (isNaN(itemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID'
      });
    }

    delete updateData.Status;
    delete updateData.StatusOverridden;

    const pickedUpBy = typeof updateData.PickedUpBy === 'string' ? updateData.PickedUpBy.trim() : '';
    const hasPickedUpName = pickedUpBy.length > 0;
    const hasPickedUpUserId = typeof updateData.PickedUpByUserID === 'number' && Number.isInteger(updateData.PickedUpByUserID) && updateData.PickedUpByUserID > 0;
    const hasPickedUpDate = updateData.PickedUpDate !== undefined && updateData.PickedUpDate !== null;
    const wantsPickup = hasPickedUpName || hasPickedUpUserId || hasPickedUpDate;

    if (wantsPickup) {
      if (!hasPickedUpName && !hasPickedUpUserId) {
        return res.status(400).json({
          success: false,
          message: 'Picking PIC wajib diisi jika set PickedUpDate'
        });
      }

      if (!hasPickedUpDate) {
        return res.status(400).json({
          success: false,
          message: 'PickedUpDate wajib diisi jika set Picking PIC'
        });
      }
    }

    if (updateData.PickedUpByUserID !== undefined) {
      if (!Number.isInteger(updateData.PickedUpByUserID) || updateData.PickedUpByUserID <= 0) {
        return res.status(400).json({
          success: false,
          message: 'PickedUpByUserID must be a valid user ID'
        });
      }

      const pickedUserResult = await executeQuery<{ UserID: number; Role: string }>(
        'SELECT UserID, Role FROM Users WHERE UserID = @UserID AND IsActive = 1',
        { UserID: updateData.PickedUpByUserID }
      );
      const pickedUser = pickedUserResult.recordset[0];

      if (!pickedUser) {
        return res.status(400).json({
          success: false,
          message: 'Selected Picking PIC user not found or inactive'
        });
      }

      if (pickedUser.Role !== 'doccon' && pickedUser.Role !== 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Picking PIC must be a DocCon or Admin user'
        });
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Status PRF item mengikuti status PO dan tidak bisa diubah per item'
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

router.get('/filters/years', async (_req: Request, res: Response) => {
  try {
    const yearValues = await PRFModel.getUniqueSubmitYears();
    return res.json({
      success: true,
      data: yearValues
    });
  } catch (error) {
    console.error('Error fetching submit years:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch submit years',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
