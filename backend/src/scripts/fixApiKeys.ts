import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.production') });

const SETTINGS_FILE = path.join(__dirname, '../../data/settings.json');
const ENCRYPTION_KEY = process.env.SETTINGS_ENCRYPTION_KEY || 'default-key-change-in-production';

// Encryption function (same as in settingsRoutes.ts)
function encrypt(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.SETTINGS_ENCRYPTION_KEY || ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

// Decryption function (same as in settingsRoutes.ts)
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

async function fixApiKeys() {
  try {
    console.log('🔄 Starting API key fix...');
    console.log('📁 Settings file:', SETTINGS_FILE);
    console.log('🔑 Using encryption key:', ENCRYPTION_KEY ? 'Set' : 'Not set');
    
    // Read current settings
    const data = await fs.readFile(SETTINGS_FILE, 'utf8');
    const settings = JSON.parse(data);
    
    console.log('📋 Current settings structure:', {
      hasOcr: !!settings.ocr,
      hasGeminiKey: !!settings.ocr?.geminiApiKey,
      hasOpenaiKey: !!settings.ocr?.openaiApiKey,
      geminiKeyLength: settings.ocr?.geminiApiKey?.length || 0,
      openaiKeyLength: settings.ocr?.openaiApiKey?.length || 0
    });
    
    // Try to decrypt existing keys to see if they work
    let geminiDecrypted = false;
    let openaiDecrypted = false;
    
    if (settings.ocr?.geminiApiKey) {
      try {
        const decrypted = decrypt(settings.ocr.geminiApiKey);
        console.log('✅ Gemini API key decryption successful');
        geminiDecrypted = true;
      } catch (error) {
        console.log('❌ Gemini API key decryption failed:', error instanceof Error ? error.message : String(error));
      }
    }
    
    if (settings.ocr?.openaiApiKey) {
      try {
        const decrypted = decrypt(settings.ocr.openaiApiKey);
        console.log('✅ OpenAI API key decryption successful');
        openaiDecrypted = true;
      } catch (error) {
        console.log('❌ OpenAI API key decryption failed:', error instanceof Error ? error.message : String(error));
      }
    }
    
    if (geminiDecrypted && openaiDecrypted) {
      console.log('🎉 All API keys are working correctly!');
      return;
    }
    
    // If decryption failed, we need to prompt for new keys
    console.log('\n⚠️  API key decryption failed. This usually means:');
    console.log('   1. The encryption key has changed');
    console.log('   2. The encrypted data is corrupted');
    console.log('   3. The data was encrypted with a different key');
    console.log('\n🔧 To fix this, you need to:');
    console.log('   1. Get the original API keys from your provider');
    console.log('   2. Update the settings through the web interface');
    console.log('   3. Or manually update this script with the plain text keys');
    
    // For now, clear the broken encrypted keys
    if (!geminiDecrypted && settings.ocr?.geminiApiKey) {
      console.log('🧹 Clearing broken Gemini API key...');
      settings.ocr.geminiApiKey = '';
    }
    
    if (!openaiDecrypted && settings.ocr?.openaiApiKey) {
      console.log('🧹 Clearing broken OpenAI API key...');
      settings.ocr.openaiApiKey = '';
    }
    
    // Save updated settings
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    console.log('💾 Settings file updated');
    
    console.log('\n📝 Next steps:');
    console.log('   1. Start the application');
    console.log('   2. Go to Settings > OCR Configuration');
    console.log('   3. Enter your API keys again');
    console.log('   4. The keys will be encrypted with the current encryption key');
    
  } catch (error) {
    console.error('❌ Failed to fix API keys:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  fixApiKeys();
}

export { fixApiKeys };