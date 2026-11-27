import express, { Request, Response } from 'express';
import { authenticateToken, requireContentManager } from '../middleware/auth';
import { loadQueue, saveQueueSnapshot, validateQueueSnapshot } from '../services/prontoActionQueue';
import {
  claimNextRequest,
  createAcknowledgeRequest,
  finishRequest,
  listRecentRequests,
  validateActionResult,
} from '../services/prontoQueueActions';

const router = express.Router();

/**
 * @route GET /api/pronto-queue
 * @desc Pronto Immediate Action queue (PO M094) limited to POMON PRFs and their split POs
 * @access Authenticated
 */
router.get('/', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const [queue, actions] = await Promise.all([loadQueue(), listRecentRequests()]);
    return res.json({ success: true, data: { ...queue, actions } });
  } catch (error) {
    console.error('Error loading the Pronto action queue:', error);
    return res.status(500).json({ success: false, message: 'Failed to load the Pronto action queue' });
  }
});

/**
 * @route POST /api/pronto-queue/snapshot
 * @desc Replace the stored queue with a fresh read (used by the Pronto worker); rows: null records a failed read only
 * @access Content Manager or API key
 */
router.post('/snapshot', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  const parsed = validateQueueSnapshot(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ success: false, message: parsed.message });
  }
  try {
    const saved = await saveQueueSnapshot(parsed.value);
    return res.json({ success: true, data: { saved, error: parsed.value.error } });
  } catch (error) {
    console.error('Error saving the Pronto action queue:', error);
    return res.status(500).json({ success: false, message: 'Failed to save the Pronto action queue' });
  }
});

/**
 * @route POST /api/pronto-queue/actions/claim
 * @desc Give the Pronto worker the oldest pending acknowledge request (marked running), or null
 * @access Content Manager or API key (the worker)
 */
router.post('/actions/claim', authenticateToken, requireContentManager, async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await claimNextRequest() });
  } catch (error) {
    console.error('Error claiming a Pronto acknowledge request:', error);
    return res.status(500).json({ success: false, message: 'Failed to claim a request' });
  }
});

/**
 * @route POST /api/pronto-queue/actions/:id/result
 * @desc Record the outcome of a running acknowledge request (used by the Pronto worker)
 * @access Content Manager or API key (the worker)
 */
router.post('/actions/:id/result', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid request id' });
  const parsed = validateActionResult(req.body);
  if (!parsed.ok) return res.status(400).json({ success: false, message: parsed.message });
  try {
    const userId = req.user && req.user.UserID > 0 ? req.user.UserID : null;
    const saved = await finishRequest(id, parsed.status, parsed.message, userId);
    if (!saved) {
      return res.status(409).json({ success: false, message: 'Request not found or not running' });
    }
    return res.json({ success: true, data: saved });
  } catch (error) {
    console.error('Error saving a Pronto acknowledge result:', error);
    return res.status(500).json({ success: false, message: 'Failed to save the result' });
  }
});

/**
 * @route POST /api/pronto-queue/:orderNo/acknowledge
 * @desc Ask the Pronto worker to "Acknowledge for approval" a requisition that needs IT action
 * @access Content Manager (admin or doccon); not an API key
 */
router.post('/:orderNo/acknowledge', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user || String(user.Username || '').startsWith('api-key:')) {
    return res.status(403).json({ success: false, message: 'An acknowledge must be requested by a signed-in user' });
  }
  try {
    const result = await createAcknowledgeRequest(String(req.params.orderNo || '').trim(), user);
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    return res.status(201).json({ success: true, data: result.request });
  } catch (error) {
    console.error('Error creating a Pronto acknowledge request:', error);
    return res.status(500).json({ success: false, message: 'Failed to create the request' });
  }
});

export default router;
