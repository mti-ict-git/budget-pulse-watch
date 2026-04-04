import express from 'express';
import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { executeQuery } from '../config/database';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { isRunningInDocker } from '../utils/networkAuth';

const router = express.Router();

const SETTINGS_FILE = path.join(__dirname, '../../data/settings.json');
const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'default-key-change-in-production';

interface OCRSettings {
  provider: 'gemini' | 'openai';
  geminiApiKey?: string;
  openaiApiKey?: string;
  enabled: boolean;
  model?: string;
}

interface GeneralSettings {
  sharedFolderPath?: string;
}

interface ProntoSyncSettings {
  enabled: boolean;
  headerEnabled: boolean;
  itemsEnabled: boolean;
  budgetYear: number | null;
  intervalMinutes: number;
  apply: boolean;
  maxPrfs: number | null;
  limit: number;
  logEvery: number;
  headless: boolean;
  captureScreenshots: boolean;
  writePerPoJson: boolean;
  timeZone?: string | null;
  runNowRequestedAt?: string | null;
  runNowRequestedBy?: string | null;
  lastRunStartedAt?: string | null;
  lastRunFinishedAt?: string | null;
  lastRunExitCode?: number | null;
}

interface AppSettings {
  ocr: OCRSettings;
  general?: GeneralSettings;
  prontoSync?: ProntoSyncSettings;
}

interface DbAppSettingsRow {
  Provider: 'gemini' | 'openai';
  GeminiApiKeyEnc: string | null;
  OpenAIApiKeyEnc: string | null;
  Enabled: number;
  Model: string | null;
  SharedFolderPath: string | null;
  ProntoSyncEnabled: number | null;
  ProntoSyncHeaderEnabled: number | null;
  ProntoSyncItemsEnabled: number | null;
  ProntoSyncBudgetYear: number | null;
  ProntoSyncIntervalMinutes: number | null;
  ProntoSyncApply: number | null;
  ProntoSyncMaxPrfs: number | null;
  ProntoSyncLimit: number | null;
  ProntoSyncLogEvery: number | null;
  ProntoHeadless: number | null;
  ProntoCaptureScreenshots: number | null;
  ProntoWritePerPoJson: number | null;
  ProntoSyncRunNowRequestedAt: Date | null;
  ProntoSyncRunNowRequestedBy: string | null;
  ProntoSyncLastRunStartedAt: Date | null;
  ProntoSyncLastRunFinishedAt: Date | null;
  ProntoSyncLastRunExitCode: number | null;
  ProntoSyncTimeZone: string | null;
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const s = value.trim();
    return s.length > 0 ? s : null;
  }
  return null;
}

function parseIsoDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

type FolderMountInfo = {
  inDocker: boolean;
  mountPoint: string | null;
  fsType: string | null;
  isCifs: boolean;
};

type FileSystemUsage = {
  sizeBytes: number;
  usedBytes: number;
  availBytes: number;
  usePercent: number;
};

type FileSystemMountStatus = {
  path: string;
  inDocker: boolean;
  mounted: boolean;
  source: string | null;
  mountPoint: string | null;
  fsType: string | null;
  isCifs: boolean;
  usage: FileSystemUsage | null;
};

function convertWindowsNetworkPathToDockerPath(windowsPath: string): string {
  const dockerMountPath = '/app/shared-documents';
  let relativePath = windowsPath
    .replace(/^\\\\[^\\]+\\shared\\PR_Document\\?/, '')
    .replace(/^\\\\[^\\]+\\shared\\?/, '')
    .replace(/\\/g, '/');

  if (!relativePath.startsWith('PT Merdeka Tsingshan Indonesia')) {
    if (relativePath && !relativePath.startsWith('/')) {
      relativePath = `PT Merdeka Tsingshan Indonesia/${relativePath}`;
    }
  }

  return path.posix.join(dockerMountPath, relativePath);
}

type ProcMountEntry = {
  source: string;
  mountPoint: string;
  fsType: string;
};

async function getProcMountEntry(resolvedPath: string): Promise<ProcMountEntry | null> {
  if (process.platform !== 'linux') {
    return null;
  }

  try {
    const mountsText = await fs.readFile('/proc/mounts', 'utf-8');
    const mounts = mountsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.split(/\s+/))
      .filter((parts) => parts.length >= 3)
      .map((parts) => ({ source: parts[0], mountPoint: parts[1], fsType: parts[2] }));

    const match = mounts
      .filter((entry) => resolvedPath === entry.mountPoint || resolvedPath.startsWith(`${entry.mountPoint}/`))
      .sort((a, b) => b.mountPoint.length - a.mountPoint.length)[0];

    return match ?? null;
  } catch {
    return null;
  }
}

async function getFileSystemUsage(targetPath: string): Promise<FileSystemUsage | null> {
  try {
    const stats = await fs.statfs(targetPath);
    const sizeBytes = stats.bsize * stats.blocks;
    const usedBytes = stats.bsize * (stats.blocks - stats.bfree);
    const availBytes = stats.bsize * stats.bavail;
    const denominator = usedBytes + availBytes;
    const usePercent = denominator > 0 ? Math.round((usedBytes / denominator) * 1000) / 10 : 0;

    return { sizeBytes, usedBytes, availBytes, usePercent };
  } catch {
    return null;
  }
}

async function getFileSystemMountStatus(targetPath: string): Promise<FileSystemMountStatus> {
  const inDocker = isRunningInDocker();
  if (!inDocker || process.platform !== 'linux') {
    return {
      path: targetPath,
      inDocker,
      mounted: false,
      source: null,
      mountPoint: null,
      fsType: null,
      isCifs: false,
      usage: null
    };
  }

  const entry = await getProcMountEntry(targetPath);
  const mounted = entry !== null;
  const isCifs = entry?.fsType === 'cifs';
  const usage = await getFileSystemUsage(targetPath);

  return {
    path: targetPath,
    inDocker,
    mounted,
    source: entry?.source ?? null,
    mountPoint: entry?.mountPoint ?? null,
    fsType: entry?.fsType ?? null,
    isCifs,
    usage
  };
}

async function getFolderMountInfo(resolvedPath: string): Promise<FolderMountInfo> {
  const inDocker = isRunningInDocker();
  if (!inDocker || process.platform !== 'linux') {
    return { inDocker, mountPoint: null, fsType: null, isCifs: false };
  }

  try {
    const match = await getProcMountEntry(resolvedPath);

    if (!match) {
      return { inDocker, mountPoint: null, fsType: null, isCifs: false };
    }

    return {
      inDocker,
      mountPoint: match.mountPoint,
      fsType: match.fsType,
      isCifs: match.fsType === 'cifs'
    };
  } catch {
    return { inDocker, mountPoint: null, fsType: null, isCifs: false };
  }
}

// Encryption helpers
function encrypt(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.SETTINGS_ENCRYPTION_KEY || ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.SETTINGS_ENCRYPTION_KEY || ENCRYPTION_KEY, 'salt', 32);
  
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encrypted = textParts.join(':');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function ensureDataDirectory() {
  const dataDir = path.dirname(SETTINGS_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const result = await executeQuery<DbAppSettingsRow>(
      'SELECT TOP 1 Provider, GeminiApiKeyEnc, OpenAIApiKeyEnc, Enabled, Model, SharedFolderPath, ProntoSyncEnabled, ProntoSyncHeaderEnabled, ProntoSyncItemsEnabled, ProntoSyncBudgetYear, ProntoSyncIntervalMinutes, ProntoSyncApply, ProntoSyncMaxPrfs, ProntoSyncLimit, ProntoSyncLogEvery, ProntoHeadless, ProntoCaptureScreenshots, ProntoWritePerPoJson, ProntoSyncRunNowRequestedAt, ProntoSyncRunNowRequestedBy, ProntoSyncLastRunStartedAt, ProntoSyncLastRunFinishedAt, ProntoSyncLastRunExitCode, ProntoSyncTimeZone FROM AppSettings ORDER BY SettingsID DESC'
    );
    const row = result.recordset[0];
    if (row) {
      const geminiKey = row.GeminiApiKeyEnc ? decrypt(row.GeminiApiKeyEnc) : '';
      const openaiKey = row.OpenAIApiKeyEnc ? decrypt(row.OpenAIApiKeyEnc) : '';
      const prontoBudgetYear = typeof row.ProntoSyncBudgetYear === 'number' ? row.ProntoSyncBudgetYear : null;
      const prontoMaxPrfs = typeof row.ProntoSyncMaxPrfs === 'number' ? row.ProntoSyncMaxPrfs : null;
      const settings: AppSettings = {
        ocr: {
          provider: row.Provider,
          geminiApiKey: geminiKey,
          openaiApiKey: openaiKey,
          enabled: !!row.Enabled,
          model: row.Model || (row.Provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash')
        },
        general: {
          sharedFolderPath: row.SharedFolderPath || ''
        },
        prontoSync: {
          enabled: !!row.ProntoSyncEnabled,
          headerEnabled: row.ProntoSyncHeaderEnabled === null ? true : !!row.ProntoSyncHeaderEnabled,
          itemsEnabled: row.ProntoSyncItemsEnabled === null ? true : !!row.ProntoSyncItemsEnabled,
          budgetYear: prontoBudgetYear,
          intervalMinutes:
            typeof row.ProntoSyncIntervalMinutes === 'number' && row.ProntoSyncIntervalMinutes > 0
              ? row.ProntoSyncIntervalMinutes
              : 60,
          apply: !!row.ProntoSyncApply,
          maxPrfs: prontoMaxPrfs,
          limit:
            typeof row.ProntoSyncLimit === 'number' && row.ProntoSyncLimit > 0
              ? row.ProntoSyncLimit
              : 1000,
          logEvery:
            typeof row.ProntoSyncLogEvery === 'number' && row.ProntoSyncLogEvery > 0
              ? row.ProntoSyncLogEvery
              : 25,
          headless: row.ProntoHeadless === null ? true : !!row.ProntoHeadless,
          captureScreenshots: !!row.ProntoCaptureScreenshots,
          writePerPoJson: !!row.ProntoWritePerPoJson,
          timeZone: typeof row.ProntoSyncTimeZone === 'string' && row.ProntoSyncTimeZone.trim().length > 0 ? row.ProntoSyncTimeZone.trim() : null,
          runNowRequestedAt: toIsoOrNull(row.ProntoSyncRunNowRequestedAt),
          runNowRequestedBy: typeof row.ProntoSyncRunNowRequestedBy === 'string' ? row.ProntoSyncRunNowRequestedBy : null,
          lastRunStartedAt: toIsoOrNull(row.ProntoSyncLastRunStartedAt),
          lastRunFinishedAt: toIsoOrNull(row.ProntoSyncLastRunFinishedAt),
          lastRunExitCode: typeof row.ProntoSyncLastRunExitCode === 'number' ? row.ProntoSyncLastRunExitCode : null
        }
      };
      return settings;
    }
    try {
      await ensureDataDirectory();
      const data = await fs.readFile(SETTINGS_FILE, 'utf8');
      const fileSettings = JSON.parse(data) as AppSettings;
      return {
        ocr: {
          provider: fileSettings.ocr.provider || 'gemini',
          geminiApiKey: fileSettings.ocr.geminiApiKey ? decrypt(fileSettings.ocr.geminiApiKey) : '',
          openaiApiKey: fileSettings.ocr.openaiApiKey ? decrypt(fileSettings.ocr.openaiApiKey) : '',
          enabled: fileSettings.ocr.enabled || false,
          model: fileSettings.ocr.model || 'gemini-1.5-flash'
        },
        general: fileSettings.general ? { sharedFolderPath: fileSettings.general.sharedFolderPath || '' } : { sharedFolderPath: '' },
        prontoSync: fileSettings.prontoSync
          ? fileSettings.prontoSync
          : {
              enabled: false,
              headerEnabled: true,
              itemsEnabled: true,
              budgetYear: null,
              intervalMinutes: 60,
              apply: false,
              maxPrfs: null,
              limit: 1000,
              logEvery: 25,
              headless: true,
              captureScreenshots: false,
              writePerPoJson: false,
              timeZone: 'Asia/Jakarta'
            }
      };
    } catch {
      return {
        ocr: {
          enabled: false,
          provider: 'gemini',
          model: 'gemini-1.5-flash'
        },
        general: { sharedFolderPath: '' },
        prontoSync: {
          enabled: false,
          headerEnabled: true,
          itemsEnabled: true,
          budgetYear: null,
          intervalMinutes: 60,
          apply: false,
          maxPrfs: null,
          limit: 1000,
          logEvery: 25,
          headless: true,
          captureScreenshots: false,
          writePerPoJson: false,
          timeZone: 'Asia/Jakarta'
        }
      };
    }
  } catch {
    return {
      ocr: {
        enabled: false,
        provider: 'gemini',
        model: 'gemini-1.5-flash'
      },
      general: { sharedFolderPath: '' },
      prontoSync: {
        enabled: false,
        headerEnabled: true,
        itemsEnabled: true,
        budgetYear: null,
        intervalMinutes: 60,
        apply: false,
        maxPrfs: null,
        limit: 1000,
        logEvery: 25,
        headless: true,
        captureScreenshots: false,
        writePerPoJson: false,
        timeZone: 'Asia/Jakarta'
      }
    };
  }
}

async function saveSettings(settings: AppSettings): Promise<void> {
  const encGemini = settings.ocr.geminiApiKey ? encrypt(settings.ocr.geminiApiKey) : null;
  const encOpenAI = settings.ocr.openaiApiKey ? encrypt(settings.ocr.openaiApiKey) : null;
  const pronto = settings.prontoSync || {
    enabled: false,
    headerEnabled: true,
    itemsEnabled: true,
    budgetYear: null,
    intervalMinutes: 60,
    apply: false,
    maxPrfs: null,
    limit: 1000,
    logEvery: 25,
    headless: true,
    captureScreenshots: false,
    writePerPoJson: false,
    timeZone: 'Asia/Jakarta'
  };
  const existing = await executeQuery<{ Count: number }>('SELECT COUNT(*) AS Count FROM AppSettings');
  const hasRow = (existing.recordset[0]?.Count || 0) > 0;
  if (hasRow) {
    await executeQuery(
      'UPDATE AppSettings SET Provider=@Provider, GeminiApiKeyEnc=@GeminiApiKeyEnc, OpenAIApiKeyEnc=@OpenAIApiKeyEnc, Enabled=@Enabled, Model=@Model, SharedFolderPath=@SharedFolderPath, ProntoSyncEnabled=@ProntoSyncEnabled, ProntoSyncHeaderEnabled=@ProntoSyncHeaderEnabled, ProntoSyncItemsEnabled=@ProntoSyncItemsEnabled, ProntoSyncBudgetYear=@ProntoSyncBudgetYear, ProntoSyncIntervalMinutes=@ProntoSyncIntervalMinutes, ProntoSyncApply=@ProntoSyncApply, ProntoSyncMaxPrfs=@ProntoSyncMaxPrfs, ProntoSyncLimit=@ProntoSyncLimit, ProntoSyncLogEvery=@ProntoSyncLogEvery, ProntoHeadless=@ProntoHeadless, ProntoCaptureScreenshots=@ProntoCaptureScreenshots, ProntoWritePerPoJson=@ProntoWritePerPoJson, ProntoSyncTimeZone=@ProntoSyncTimeZone, UpdatedAt=GETDATE()',
      {
        Provider: settings.ocr.provider,
        GeminiApiKeyEnc: encGemini,
        OpenAIApiKeyEnc: encOpenAI,
        Enabled: settings.ocr.enabled ? 1 : 0,
        Model: settings.ocr.model || null,
        SharedFolderPath: settings.general?.sharedFolderPath || null,
        ProntoSyncEnabled: pronto.enabled ? 1 : 0,
        ProntoSyncHeaderEnabled: pronto.headerEnabled ? 1 : 0,
        ProntoSyncItemsEnabled: pronto.itemsEnabled ? 1 : 0,
        ProntoSyncBudgetYear: pronto.budgetYear,
        ProntoSyncIntervalMinutes: pronto.intervalMinutes,
        ProntoSyncApply: pronto.apply ? 1 : 0,
        ProntoSyncMaxPrfs: pronto.maxPrfs,
        ProntoSyncLimit: pronto.limit,
        ProntoSyncLogEvery: pronto.logEvery,
        ProntoHeadless: pronto.headless ? 1 : 0,
        ProntoCaptureScreenshots: pronto.captureScreenshots ? 1 : 0,
        ProntoWritePerPoJson: pronto.writePerPoJson ? 1 : 0,
        ProntoSyncTimeZone: pronto.timeZone || null
      }
    );
  } else {
    await executeQuery(
      'INSERT INTO AppSettings (Provider, GeminiApiKeyEnc, OpenAIApiKeyEnc, Enabled, Model, SharedFolderPath, ProntoSyncEnabled, ProntoSyncHeaderEnabled, ProntoSyncItemsEnabled, ProntoSyncBudgetYear, ProntoSyncIntervalMinutes, ProntoSyncApply, ProntoSyncMaxPrfs, ProntoSyncLimit, ProntoSyncLogEvery, ProntoHeadless, ProntoCaptureScreenshots, ProntoWritePerPoJson, ProntoSyncTimeZone) VALUES (@Provider, @GeminiApiKeyEnc, @OpenAIApiKeyEnc, @Enabled, @Model, @SharedFolderPath, @ProntoSyncEnabled, @ProntoSyncHeaderEnabled, @ProntoSyncItemsEnabled, @ProntoSyncBudgetYear, @ProntoSyncIntervalMinutes, @ProntoSyncApply, @ProntoSyncMaxPrfs, @ProntoSyncLimit, @ProntoSyncLogEvery, @ProntoHeadless, @ProntoCaptureScreenshots, @ProntoWritePerPoJson, @ProntoSyncTimeZone)',
      {
        Provider: settings.ocr.provider,
        GeminiApiKeyEnc: encGemini,
        OpenAIApiKeyEnc: encOpenAI,
        Enabled: settings.ocr.enabled ? 1 : 0,
        Model: settings.ocr.model || null,
        SharedFolderPath: settings.general?.sharedFolderPath || null,
        ProntoSyncEnabled: pronto.enabled ? 1 : 0,
        ProntoSyncHeaderEnabled: pronto.headerEnabled ? 1 : 0,
        ProntoSyncItemsEnabled: pronto.itemsEnabled ? 1 : 0,
        ProntoSyncBudgetYear: pronto.budgetYear,
        ProntoSyncIntervalMinutes: pronto.intervalMinutes,
        ProntoSyncApply: pronto.apply ? 1 : 0,
        ProntoSyncMaxPrfs: pronto.maxPrfs,
        ProntoSyncLimit: pronto.limit,
        ProntoSyncLogEvery: pronto.logEvery,
        ProntoHeadless: pronto.headless ? 1 : 0,
        ProntoCaptureScreenshots: pronto.captureScreenshots ? 1 : 0,
        ProntoWritePerPoJson: pronto.writePerPoJson ? 1 : 0,
        ProntoSyncTimeZone: pronto.timeZone || null
      }
    );
  }
}

// GET /api/settings/ocr - Get OCR settings
router.get('/ocr', async (req: Request, res: Response) => {
  try {
    const settings = await loadSettings();
    
    // Return settings without the actual API key for security
    res.json({
      enabled: settings.ocr.enabled,
      provider: settings.ocr.provider || 'gemini',
      geminiApiKey: settings.ocr.geminiApiKey ? '***masked***' : '',
      openaiApiKey: settings.ocr.openaiApiKey ? '***masked***' : '',
      model: settings.ocr.model || (settings.ocr.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash')
    });
  } catch (error) {
    console.error('Failed to load OCR settings:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// POST /api/settings/ocr - Save OCR settings
router.post('/ocr', async (req: Request, res: Response) => {
  try {
    const { provider, geminiApiKey, openaiApiKey, enabled, model } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    
    if (provider && !['gemini', 'openai'].includes(provider)) {
      return res.status(400).json({ error: 'provider must be either "gemini" or "openai"' });
    }
    
    if (geminiApiKey && typeof geminiApiKey !== 'string') {
      return res.status(400).json({ error: 'geminiApiKey must be a string' });
    }
    
    if (openaiApiKey && typeof openaiApiKey !== 'string') {
      return res.status(400).json({ error: 'openaiApiKey must be a string' });
    }
    
    const currentSettings = await loadSettings();
    currentSettings.ocr = {
      enabled,
      provider: provider || currentSettings.ocr.provider || 'gemini',
      geminiApiKey: geminiApiKey || currentSettings.ocr.geminiApiKey || '',
      openaiApiKey: openaiApiKey || currentSettings.ocr.openaiApiKey || '',
      model: model || currentSettings.ocr.model || (provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash')
    };
    await saveSettings(currentSettings);
    
    return res.json({ 
      message: 'OCR settings saved successfully',
      enabled: currentSettings.ocr.enabled
    });
  } catch (error) {
    console.error('Failed to save OCR settings:', error);
    return res.status(500).json({ error: 'Failed to save settings' });
  }
});

// POST /api/settings/ocr/test - Test OCR API key
router.post('/ocr/test', async (req: Request, res: Response) => {
  try {
    const { apiKey, provider } = req.body;
    
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'API key is required' 
      });
    }

    if (provider && !['gemini', 'openai'].includes(provider)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Provider must be either "gemini" or "openai"' 
      });
    }

    // Import OCR service for testing
    const { ocrService } = await import('../services/ocrService');
    const testResult = await ocrService.testConnection(apiKey, provider || 'gemini');
    
    return res.json(testResult);
  } catch (error) {
    console.error('OCR API test failed:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'OCR test failed'
    });
  }
});

// GET /api/settings/ocr/key - Get actual API key (for internal use)
router.get('/ocr/key', async (req: Request, res: Response) => {
  try {
    const settings = await loadSettings();
    const provider = settings.ocr.provider || 'gemini';
    const apiKey = provider === 'openai' ? settings.ocr.openaiApiKey : settings.ocr.geminiApiKey;
    
    res.json({ 
      apiKey: apiKey || '',
      provider: provider,
      enabled: settings.ocr.enabled
    });
  } catch (error) {
    console.error('Failed to load OCR API key:', error);
    res.status(500).json({ error: 'Failed to load API key' });
  }
});

// GET /api/settings/general - Get general settings
router.get('/general', async (req: Request, res: Response) => {
  try {
    const settings = await loadSettings();
    const envSharedFolderPath =
      typeof process.env.SHARED_FOLDER_PATH === 'string' ? process.env.SHARED_FOLDER_PATH.trim() : '';
    const settingsSharedFolderPath = settings.general?.sharedFolderPath || '';
    const effectiveSharedFolderPath = envSharedFolderPath || settingsSharedFolderPath;
    const effectiveSharedFolderPathSource = envSharedFolderPath.length > 0 ? 'env' : 'settings';
    const dockerShareMount = await getFileSystemMountStatus('/app/shared-documents');
    const rootFsMount = await getFileSystemMountStatus('/');

    res.json({
      sharedFolderPath: settingsSharedFolderPath,
      effectiveSharedFolderPath,
      effectiveSharedFolderPathSource,
      envSharedFolderPath: envSharedFolderPath.length > 0 ? envSharedFolderPath : '',
      dockerShareMount,
      rootFsMount
    });
  } catch (error) {
    console.error('Failed to load general settings:', error);
    res.status(500).json({ error: 'Failed to load general settings' });
  }
});

// POST /api/settings/general - Save general settings
router.post('/general', async (req: Request, res: Response) => {
  try {
    const { sharedFolderPath } = req.body;
    
    if (sharedFolderPath && typeof sharedFolderPath !== 'string') {
      return res.status(400).json({ error: 'sharedFolderPath must be a string' });
    }
    
    const currentSettings = await loadSettings();
    currentSettings.general = {
      sharedFolderPath: sharedFolderPath || ''
    };
    await saveSettings(currentSettings);
    
    return res.json({ 
      message: 'General settings saved successfully',
      sharedFolderPath: currentSettings.general.sharedFolderPath
    });
  } catch (error) {
    console.error('Failed to save general settings:', error);
    return res.status(500).json({ error: 'Failed to save general settings' });
  }
});

router.get('/pronto-sync', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await loadSettings();
    const pronto = settings.prontoSync || {
      enabled: false,
      headerEnabled: true,
      itemsEnabled: true,
      budgetYear: null,
      intervalMinutes: 60,
      apply: false,
      maxPrfs: null,
      limit: 1000,
      logEvery: 25,
      headless: true,
      captureScreenshots: false,
      writePerPoJson: false
    };
    res.json(pronto);
  } catch (error) {
    console.error('Failed to load pronto sync settings:', error);
    res.status(500).json({ error: 'Failed to load pronto sync settings' });
  }
});

router.post('/pronto-sync', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      enabled,
      headerEnabled,
      itemsEnabled,
      budgetYear,
      intervalMinutes,
      apply,
      maxPrfs,
      limit,
      logEvery,
      headless,
      captureScreenshots,
      writePerPoJson,
      timeZone
    } = req.body as Record<string, unknown>;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    if (typeof headerEnabled !== 'boolean') {
      return res.status(400).json({ error: 'headerEnabled must be a boolean' });
    }
    if (typeof itemsEnabled !== 'boolean') {
      return res.status(400).json({ error: 'itemsEnabled must be a boolean' });
    }
    if (!(budgetYear === null || typeof budgetYear === 'number')) {
      return res.status(400).json({ error: 'budgetYear must be a number or null' });
    }
    if (typeof intervalMinutes !== 'number' || !Number.isFinite(intervalMinutes) || intervalMinutes < 1) {
      return res.status(400).json({ error: 'intervalMinutes must be a number >= 1' });
    }
    if (typeof apply !== 'boolean') {
      return res.status(400).json({ error: 'apply must be a boolean' });
    }
    if (!(maxPrfs === null || typeof maxPrfs === 'number')) {
      return res.status(400).json({ error: 'maxPrfs must be a number or null' });
    }
    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 1) {
      return res.status(400).json({ error: 'limit must be a number >= 1' });
    }
    if (typeof logEvery !== 'number' || !Number.isFinite(logEvery) || logEvery < 1) {
      return res.status(400).json({ error: 'logEvery must be a number >= 1' });
    }
    if (typeof headless !== 'boolean') {
      return res.status(400).json({ error: 'headless must be a boolean' });
    }
    if (typeof captureScreenshots !== 'boolean') {
      return res.status(400).json({ error: 'captureScreenshots must be a boolean' });
    }
    if (typeof writePerPoJson !== 'boolean') {
      return res.status(400).json({ error: 'writePerPoJson must be a boolean' });
    }
    if (!(timeZone === null || typeof timeZone === 'string' || typeof timeZone === 'undefined')) {
      return res.status(400).json({ error: 'timeZone must be a string or null' });
    }
    const tz = typeof timeZone === 'string' ? timeZone.trim() : '';
    const normalizedTimeZone = tz.length > 0 ? tz.slice(0, 64) : null;

    const normalizedBudgetYear = budgetYear === null ? null : Math.trunc(budgetYear);
    const normalizedMaxPrfs = maxPrfs === null ? null : Math.trunc(maxPrfs);

    const currentSettings = await loadSettings();
    currentSettings.prontoSync = {
      enabled,
      headerEnabled,
      itemsEnabled,
      budgetYear: normalizedBudgetYear,
      intervalMinutes: Math.trunc(intervalMinutes),
      apply,
      maxPrfs: normalizedMaxPrfs,
      limit: Math.trunc(limit),
      logEvery: Math.trunc(logEvery),
      headless,
      captureScreenshots,
      writePerPoJson,
      timeZone: normalizedTimeZone
    };
    await saveSettings(currentSettings);
    return res.json({ message: 'Pronto sync settings saved successfully' });
  } catch (error) {
    console.error('Failed to save pronto sync settings:', error);
    return res.status(500).json({ error: 'Failed to save pronto sync settings' });
  }
});

router.post('/pronto-sync/run-now', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const requestedBy = typeof req.user?.Username === 'string' ? req.user.Username : 'unknown';
    await executeQuery(
      'UPDATE AppSettings SET ProntoSyncRunNowRequestedAt=SYSUTCDATETIME(), ProntoSyncRunNowRequestedBy=@RequestedBy, UpdatedAt=SYSUTCDATETIME()',
      { RequestedBy: requestedBy }
    );
    return res.json({ message: 'Run requested' });
  } catch (error) {
    console.error('Failed to request pronto sync run:', error);
    return res.status(500).json({ error: 'Failed to request run' });
  }
});

router.post('/pronto-sync/run-now/complete', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { exitCode, startedAt, finishedAt } = req.body as Record<string, unknown>;
    if (typeof exitCode !== 'number' || !Number.isFinite(exitCode)) {
      return res.status(400).json({ error: 'exitCode must be a number' });
    }
    if (typeof startedAt !== 'string' || startedAt.trim().length === 0) {
      return res.status(400).json({ error: 'startedAt must be a non-empty string' });
    }
    if (typeof finishedAt !== 'string' || finishedAt.trim().length === 0) {
      return res.status(400).json({ error: 'finishedAt must be a non-empty string' });
    }
    const started = parseIsoDate(startedAt);
    const finished = parseIsoDate(finishedAt);
    if (!started) {
      return res.status(400).json({ error: 'startedAt must be a valid ISO date string' });
    }
    if (!finished) {
      return res.status(400).json({ error: 'finishedAt must be a valid ISO date string' });
    }
    await executeQuery(
      'UPDATE AppSettings SET ProntoSyncRunNowRequestedAt=NULL, ProntoSyncRunNowRequestedBy=NULL, ProntoSyncLastRunStartedAt=@StartedAt, ProntoSyncLastRunFinishedAt=@FinishedAt, ProntoSyncLastRunExitCode=@ExitCode, UpdatedAt=SYSUTCDATETIME()',
      {
        StartedAt: started,
        FinishedAt: finished,
        ExitCode: Math.trunc(exitCode)
      }
    );
    return res.json({ message: 'Run recorded' });
  } catch (error) {
    console.error('Failed to record pronto sync run:', error);
    return res.status(500).json({ error: 'Failed to record run' });
  }
});

router.get('/pronto-sync/progress', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await executeQuery<{ ProntoSyncProgressJson: string | null; ProntoSyncProgressUpdatedAt: Date | null }>(
      'SELECT TOP 1 ProntoSyncProgressJson, ProntoSyncProgressUpdatedAt FROM AppSettings ORDER BY SettingsID DESC'
    );
    const row = result.recordset[0];
    const jsonRaw = row?.ProntoSyncProgressJson ?? null;
    let progress: unknown = null;
    if (typeof jsonRaw === 'string' && jsonRaw.trim().length > 0) {
      try {
        progress = JSON.parse(jsonRaw);
      } catch {
        progress = jsonRaw;
      }
    }
    return res.json({
      success: true,
      data: {
        progress,
        updatedAt: toIsoOrNull(row?.ProntoSyncProgressUpdatedAt ?? null)
      }
    });
  } catch (error) {
    console.error('Failed to load pronto sync progress:', error);
    return res.status(500).json({ success: false, error: 'Failed to load progress' });
  }
});

router.post('/pronto-sync/progress', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { step, event, index, total, payload } = req.body as Record<string, unknown>;
    if (typeof step !== 'string' || step.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'step must be a non-empty string' });
    }
    if (typeof event !== 'string' || event.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'event must be a non-empty string' });
    }
    const normalizedIndex = typeof index === 'number' && Number.isFinite(index) ? Math.trunc(index) : null;
    const normalizedTotal = typeof total === 'number' && Number.isFinite(total) ? Math.trunc(total) : null;
    const receivedBy = typeof req.user?.Username === 'string' ? req.user.Username : 'unknown';
    const progressObj = {
      step: step.trim().slice(0, 32),
      event: event.trim().slice(0, 32),
      index: normalizedIndex,
      total: normalizedTotal,
      payload: typeof payload === 'object' ? payload : null,
      receivedBy,
      receivedAt: new Date().toISOString()
    };
    const json = JSON.stringify(progressObj);
    if (json.length > 200000) {
      return res.status(400).json({ success: false, error: 'payload too large' });
    }
    await executeQuery(
      'UPDATE AppSettings SET ProntoSyncProgressJson=@Json, ProntoSyncProgressUpdatedAt=SYSUTCDATETIME(), UpdatedAt=SYSUTCDATETIME()',
      { Json: json }
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to save pronto sync progress:', error);
    return res.status(500).json({ success: false, error: 'Failed to save progress' });
  }
});

router.get('/time', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const serverNow = new Date();
    const tzEnv = typeof process.env.TZ === 'string' ? process.env.TZ : null;
    const dbResult = await executeQuery<{ UtcNow: Date; LocalNow: Date }>('SELECT SYSUTCDATETIME() AS UtcNow, SYSDATETIME() AS LocalNow');
    const row = dbResult.recordset[0];
    const dbUtc = row?.UtcNow instanceof Date ? row.UtcNow : null;
    const dbLocal = row?.LocalNow instanceof Date ? row.LocalNow : null;
    const prontoResult = await executeQuery<{
      RunRequestedAt: Date | null;
      RunRequestedBy: string | null;
      RunRequestedAgeSec: number | null;
      LastRunStartedAt: Date | null;
      LastRunFinishedAt: Date | null;
      LastRunExitCode: number | null;
    }>(
      "SELECT TOP 1 ProntoSyncRunNowRequestedAt AS RunRequestedAt, ProntoSyncRunNowRequestedBy AS RunRequestedBy, CASE WHEN ProntoSyncRunNowRequestedAt IS NULL THEN NULL ELSE DATEDIFF_BIG(second, ProntoSyncRunNowRequestedAt, SYSUTCDATETIME()) END AS RunRequestedAgeSec, ProntoSyncLastRunStartedAt AS LastRunStartedAt, ProntoSyncLastRunFinishedAt AS LastRunFinishedAt, ProntoSyncLastRunExitCode AS LastRunExitCode FROM AppSettings ORDER BY SettingsID DESC"
    );
    const p = prontoResult.recordset[0];
    return res.json({
      server: {
        nowIso: serverNow.toISOString(),
        nowEpochMs: serverNow.getTime(),
        tzEnv,
        offsetMinutes: -serverNow.getTimezoneOffset()
      },
      database: {
        utcIso: dbUtc ? dbUtc.toISOString() : null,
        utcEpochMs: dbUtc ? dbUtc.getTime() : null,
        localIso: dbLocal ? dbLocal.toISOString() : null,
        localEpochMs: dbLocal ? dbLocal.getTime() : null
      },
      prontoSync: {
        runNowRequestedAtIso: p?.RunRequestedAt instanceof Date ? p.RunRequestedAt.toISOString() : null,
        runNowRequestedBy: typeof p?.RunRequestedBy === 'string' ? p.RunRequestedBy : null,
        runNowRequestedAgeSec: typeof p?.RunRequestedAgeSec === 'number' ? p.RunRequestedAgeSec : null,
        lastRunStartedAtIso: p?.LastRunStartedAt instanceof Date ? p.LastRunStartedAt.toISOString() : null,
        lastRunFinishedAtIso: p?.LastRunFinishedAt instanceof Date ? p.LastRunFinishedAt.toISOString() : null,
        lastRunExitCode: typeof p?.LastRunExitCode === 'number' ? p.LastRunExitCode : null
      }
    });
  } catch (error) {
    console.error('Failed to read server time:', error);
    return res.status(500).json({ error: 'Failed to read server time' });
  }
});

// POST /api/settings/test-folder-path - Test shared folder path accessibility
router.post('/test-folder-path', async (req: Request, res: Response) => {
  try {
    const { path: folderPath } = req.body;
    
    if (!folderPath || typeof folderPath !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Folder path is required' 
      });
    }

    const trimmedPath = folderPath.trim();
    const resolvedPath =
      isRunningInDocker() && trimmedPath.startsWith('\\\\')
        ? convertWindowsNetworkPathToDockerPath(trimmedPath)
        : trimmedPath;

    const mount = await getFolderMountInfo(resolvedPath);
    const isExpectedDockerShare =
      mount.inDocker &&
      (resolvedPath === '/app/shared-documents' || resolvedPath.startsWith('/app/shared-documents/'));

    if (isExpectedDockerShare && !mount.isCifs) {
      return res.json({
        success: false,
        error: 'Network share is not mounted at /app/shared-documents (CIFS mount missing)',
        resolvedPath,
        mount
      });
    }

    // Test folder accessibility
    try {
      const stats = await fs.stat(resolvedPath);
      
      if (!stats.isDirectory()) {
        return res.json({
          success: false,
          error: 'Path exists but is not a directory',
          resolvedPath,
          mount
        });
      }

      // Try to read the directory to check permissions
      const files = await fs.readdir(resolvedPath);
      
      return res.json({
        success: true,
        message: 'Folder path is accessible',
        fileCount: files.length,
        resolvedPath,
        mount
      });
    } catch (fsError: unknown) {
      let errorMessage = 'Failed to access folder path';
      const error = fsError as { code?: string };
      
      if (error.code === 'ENOENT') {
        errorMessage = 'Folder path does not exist';
      } else if (error.code === 'EACCES' || error.code === 'EPERM') {
        errorMessage = 'Permission denied. Check network permissions and credentials.';
      } else if (error.code === 'ENOTDIR') {
        errorMessage = 'Path exists but is not a directory';
      } else if (error.code === 'ENETUNREACH' || error.code === 'EHOSTUNREACH') {
        errorMessage = 'Network unreachable. Check network connectivity.';
      }
      
      return res.json({
        success: false,
        error: errorMessage,
        resolvedPath,
        mount
      });
    }
  } catch (error) {
    console.error('Folder path test failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while testing folder path'
    });
  }
});

// POST /api/settings/maintenance/dedupe-prf-items - Remove duplicate PRF items
router.post('/maintenance/dedupe-prf-items', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { fix = false, prfNo, budgetYear } = req.body as { fix?: boolean; prfNo?: string; budgetYear?: number };

    const params = {
      PRFNo: prfNo && prfNo.trim().length > 0 ? prfNo.trim() : null,
      BudgetYear: typeof budgetYear === 'number' ? budgetYear : null
    };

    if (!fix) {
      const query = `
        WITH ItemKey AS (
          SELECT 
            pi.PRFItemID, pi.PRFID,
            UPPER(LTRIM(RTRIM(pi.ItemName))) AS ItemName,
            UPPER(LTRIM(RTRIM(ISNULL(pi.Description,'')))) AS Description,
            ISNULL(pi.UnitPrice,0) AS UnitPrice,
            ISNULL(pi.BudgetYear,0) AS BudgetYear,
            UPPER(LTRIM(RTRIM(ISNULL(pi.PurchaseCostCode,'')))) AS PurchaseCostCode,
            ROW_NUMBER() OVER (
              PARTITION BY pi.PRFID, UPPER(LTRIM(RTRIM(pi.ItemName))), UPPER(LTRIM(RTRIM(ISNULL(pi.Description,'')))), ISNULL(pi.UnitPrice,0), ISNULL(pi.BudgetYear,0), UPPER(LTRIM(RTRIM(ISNULL(pi.PurchaseCostCode,''))))
              ORDER BY pi.PRFItemID
            ) AS rn
          FROM PRFItems pi
          INNER JOIN PRF p ON p.PRFID = pi.PRFID
          WHERE (@PRFNo IS NULL OR p.PRFNo = @PRFNo)
            AND (@BudgetYear IS NULL OR ISNULL(pi.BudgetYear,0) = @BudgetYear)
        )
        SELECT TOP 10 * FROM ItemKey WHERE rn > 1
      `;
      const result = await executeQuery(query, params);
      const sampleCount = result.recordset?.length || 0;
      const countQuery = `
        WITH ItemKey AS (
          SELECT 
            pi.PRFItemID, pi.PRFID,
            UPPER(LTRIM(RTRIM(pi.ItemName))) AS ItemName,
            UPPER(LTRIM(RTRIM(ISNULL(pi.Description,'')))) AS Description,
            ISNULL(pi.UnitPrice,0) AS UnitPrice,
            ISNULL(pi.BudgetYear,0) AS BudgetYear,
            UPPER(LTRIM(RTRIM(ISNULL(pi.PurchaseCostCode,'')))) AS PurchaseCostCode,
            ROW_NUMBER() OVER (
              PARTITION BY pi.PRFID, UPPER(LTRIM(RTRIM(pi.ItemName))), UPPER(LTRIM(RTRIM(ISNULL(pi.Description,'')))), ISNULL(pi.UnitPrice,0), ISNULL(pi.BudgetYear,0), UPPER(LTRIM(RTRIM(ISNULL(pi.PurchaseCostCode,''))))
              ORDER BY pi.PRFItemID
            ) AS rn
          FROM PRFItems pi
          INNER JOIN PRF p ON p.PRFID = pi.PRFID
          WHERE (@PRFNo IS NULL OR p.PRFNo = @PRFNo)
            AND (@BudgetYear IS NULL OR ISNULL(pi.BudgetYear,0) = @BudgetYear)
        )
        SELECT COUNT(1) AS Total FROM ItemKey WHERE rn > 1
      `;
      const totalResult = await executeQuery<{ Total: number }>(countQuery, params);
      const total = totalResult.recordset?.[0]?.Total || 0;
      return res.json({ success: true, fix: false, totalDuplicates: total, sampleCount });
    }

    const deleteQuery = `
      WITH ItemKey AS (
        SELECT 
          pi.PRFItemID, pi.PRFID,
          UPPER(LTRIM(RTRIM(pi.ItemName))) AS ItemName,
          UPPER(LTRIM(RTRIM(ISNULL(pi.Description,'')))) AS Description,
          ISNULL(pi.UnitPrice,0) AS UnitPrice,
          ISNULL(pi.BudgetYear,0) AS BudgetYear,
          UPPER(LTRIM(RTRIM(ISNULL(pi.PurchaseCostCode,'')))) AS PurchaseCostCode,
          ROW_NUMBER() OVER (
            PARTITION BY pi.PRFID, UPPER(LTRIM(RTRIM(pi.ItemName))), UPPER(LTRIM(RTRIM(ISNULL(pi.Description,'')))), ISNULL(pi.UnitPrice,0), ISNULL(pi.BudgetYear,0), UPPER(LTRIM(RTRIM(ISNULL(pi.PurchaseCostCode,''))))
            ORDER BY pi.PRFItemID
          ) AS rn
        FROM PRFItems pi
        INNER JOIN PRF p ON p.PRFID = pi.PRFID
        WHERE (@PRFNo IS NULL OR p.PRFNo = @PRFNo)
          AND (@BudgetYear IS NULL OR ISNULL(pi.BudgetYear,0) = @BudgetYear)
      )
      DELETE FROM PRFItems WHERE PRFItemID IN (SELECT PRFItemID FROM ItemKey WHERE rn > 1)
    `;

    const deleteResult = await executeQuery(deleteQuery, params);
    const affectedArray = deleteResult.rowsAffected as number[];
    const deleted = affectedArray.length > 0 ? affectedArray[0] : 0;
    return res.json({ success: true, fix: true, deleted });
  } catch (error) {
    console.error('Dedupe PRF items error:', error);
    return res.status(500).json({ success: false, message: 'Failed to dedupe PRF items' });
  }
});

export default router;
export { loadSettings, saveSettings, OCRSettings, GeneralSettings, AppSettings };
