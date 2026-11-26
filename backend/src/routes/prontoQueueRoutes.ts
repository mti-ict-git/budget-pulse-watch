import express, { Request, Response } from 'express';
import { authenticateToken, requireContentManager } from '../middleware/auth';
import { loadQueue, saveQueueSnapshot, validateQueueSnapshot } from '../services/prontoActionQueue';

const router = express.Router();

/**
 * @route GET /api/pronto-queue
 * @desc Pronto Immediate Action queue (PO M094) limited to POMON PRFs and their split POs
 * @access Authenticated
 */
router.get('/', authenticateToken, async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await loadQueue() });
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

export default router;
