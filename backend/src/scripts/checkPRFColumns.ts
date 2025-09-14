import { connectDatabase, executeQuery, closeDatabase } from '../config/database';

async function checkPRFColumns() {
  try {
    await connectDatabase();
    console.log('Connected. Checking dbo.PRF columns...');

    const columnsQuery = `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'PRF'
      ORDER BY ORDINAL_POSITION;
    `;

    const result = await executeQuery<{ COLUMN_NAME: string }>(columnsQuery);
    const columns = result.recordset.map(r => r.COLUMN_NAME);
    console.log('Columns on dbo.PRF:', columns);

    const hasPRFNumber = columns.includes('PRFNumber');
    console.log(`PRFNumber present? ${hasPRFNumber}`);

    // Check the PRFSummary view references
    const viewQuery = `
      SELECT definition
      FROM sys.sql_modules m
      JOIN sys.views v ON m.object_id = v.object_id
      WHERE v.object_id = OBJECT_ID('dbo.vw_PRFSummary');
    `;
    try {
      const viewRes = await executeQuery<{ definition: string }>(viewQuery);
      const def = viewRes.recordset[0]?.definition || '';
      if (def) {
        console.log('vw_PRFSummary uses PRFNumber?', /PRFNumber/i.test(def));
        console.log('vw_PRFSummary uses PRFNo?', /PRFNo/i.test(def));
      } else {
        console.log('vw_PRFSummary not found.');
      }
    } catch (e) {
      console.log('Could not inspect vw_PRFSummary:', e);
    }
  } catch (err) {
    console.error('Error checking PRF columns:', err);
    process.exitCode = 1;
  } finally {
    await closeDatabase().catch(() => {});
  }
}

if (require.main === module) {
  checkPRFColumns();
}

export { checkPRFColumns };