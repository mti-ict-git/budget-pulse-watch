import express from 'express';
import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const router = express.Router();

// Settings file path
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

interface AppSettings {
  ocr: OCRSettings;
  general?: GeneralSettings;
}

// Encryption helpers
function encrypt(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encrypted = textParts.join(':');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.dirname(SETTINGS_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Load settings from file
async function loadSettings(): Promise<AppSettings> {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data) as AppSettings;
    
    // Decrypt API key if it exists
    if (settings.ocr?.geminiApiKey) {
      try {
        settings.ocr.geminiApiKey = decrypt(settings.ocr.geminiApiKey);
      } catch (error) {
        console.error('Failed to decrypt API key:', error);
        settings.ocr.geminiApiKey = '';
      }
    }
    
    return settings;
  } catch (error) {
    // Return default settings if file doesn't exist or is corrupted
    return {
      ocr: {
        enabled: false,
        provider: 'gemini' as const,
        model: 'gemini-1.5-flash'
      }
    };
  }
}

// Save settings to file
async function saveSettings(settings: AppSettings): Promise<void> {
  await ensureDataDirectory();
  
  // Create a copy for encryption
  const settingsToSave = JSON.parse(JSON.stringify(settings));
  
  // Encrypt API key before saving
  if (settingsToSave.ocr?.geminiApiKey) {
    settingsToSave.ocr.geminiApiKey = encrypt(settingsToSave.ocr.geminiApiKey);
  }
  
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settingsToSave, null, 2));
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
    
    // Update OCR settings
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
    
    res.json({
      sharedFolderPath: settings.general?.sharedFolderPath || ''
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
    
    // Update general settings
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

    // Test folder accessibility
    try {
      const stats = await fs.stat(folderPath);
      
      if (!stats.isDirectory()) {
        return res.json({
          success: false,
          error: 'Path exists but is not a directory'
        });
      }

      // Try to read the directory to check permissions
      const files = await fs.readdir(folderPath);
      
      return res.json({
        success: true,
        message: 'Folder path is accessible',
        fileCount: files.length
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
        error: errorMessage
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

export default router;
export { loadSettings, saveSettings, OCRSettings, GeneralSettings, AppSettings };