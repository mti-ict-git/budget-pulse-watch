import { executeQuery, connectDatabase } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

async function migrateSchema(): Promise<void> {
  try {
    console.log('🔄 Starting schema migration...');
    await connectDatabase();
    console.log('✅ Database connected');

    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const sqlText = fs.readFileSync(schemaPath, 'utf8');

    const batches = sqlText
      .split(/\bGO\b/gi)
      .map(b => b.trim())
      .filter(b => b.length > 0 && !/^USE\s/i.test(b));

    console.log(`📝 Found ${batches.length} batches`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`⚡ Executing batch ${i + 1}/${batches.length}`);
      try {
        await executeQuery(batch);
        console.log(`✅ Batch ${i + 1} completed`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const benign = msg.includes('already exists') || msg.includes('There is already an object named') || msg.includes('Cannot drop the table') || msg.includes('The index') || msg.includes('Column names in each table must be unique');
        if (benign) {
          console.log(`⚠️ Batch ${i + 1} skipped: ${msg}`);
          continue;
        }
        console.error(`❌ Batch ${i + 1} failed: ${msg}`);
        throw error;
      }
    }

    console.log('🌱 Ensuring default AppSettings row');
    const countRes = await executeQuery<{ Count: number }>('SELECT COUNT(*) AS Count FROM AppSettings');
    const hasRow = (countRes.recordset[0]?.Count || 0) > 0;
    if (!hasRow) {
      await executeQuery(
        'INSERT INTO AppSettings (Provider, GeminiApiKeyEnc, OpenAIApiKeyEnc, Enabled, Model, SharedFolderPath) VALUES (@Provider, NULL, NULL, @Enabled, @Model, NULL)',
        { Provider: 'gemini', Enabled: 0, Model: 'gemini-1.5-flash' }
      );
      console.log('✅ Default AppSettings inserted');
    } else {
      console.log('✅ AppSettings row already present');
    }

    console.log('🎉 Schema migration completed');
  } catch (error) {
    console.error('❌ Migration error', error);
    process.exit(1);
  }
}

if (require.main === module) {
  migrateSchema();
}

export { migrateSchema };
