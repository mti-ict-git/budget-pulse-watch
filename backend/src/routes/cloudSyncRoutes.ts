import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin, requireContentManager } from '../middleware/auth';
import { PRFModel } from '../models/PRF';
import { pullPRFFromExcel, syncPRFToExcel, testOneDriveAccess } from '../services/onedriveService';

const router = Router();

router.post('/prf/:prfNo', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const { prfNo } = req.params;
    if (!prfNo || prfNo.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'PRF No is required' });
    }
    const prf = await PRFModel.findByPRFNo(prfNo.trim());
    if (!prf) {
      return res.status(404).json({ success: false, message: 'PRF not found' });
    }
    const modeParam = (req.query.mode as string) || 'single';
    const yearParamRaw = req.query.year as string | undefined;
    const yearParam = yearParamRaw && /^\d{4}$/.test(yearParamRaw) ? parseInt(yearParamRaw, 10) : undefined;
    const result = await syncPRFToExcel(prf, { mode: modeParam === 'scan' ? 'scan' : 'single', year: yearParam });
    return res.json({ success: true, message: result.updated ? 'PRF synced to existing row' : 'PRF appended to worksheet', data: result });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, message: errMessage, error: errMessage });
  }
});

router.post('/pull/prf/:prfNo', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const { prfNo } = req.params;
    if (!prfNo || prfNo.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'PRF No is required' });
    }
    const prf = await PRFModel.findByPRFNo(prfNo.trim());
    if (!prf) {
      return res.status(404).json({ success: false, message: 'PRF not found' });
    }
    const modeParam = (req.query.mode as string) || 'single';
    const yearParamRaw = req.query.year as string | undefined;
    const yearParam = yearParamRaw && /^\d{4}$/.test(yearParamRaw) ? parseInt(yearParamRaw, 10) : undefined;
    const result = await pullPRFFromExcel(prf, { mode: modeParam === 'scan' ? 'scan' : 'single', year: yearParam });
    return res.json({ success: true, message: 'PRF synced from cloud workbook', data: result });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, message: errMessage, error: errMessage });
  }
});

router.get('/test', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await testOneDriveAccess();
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Access test failed', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
