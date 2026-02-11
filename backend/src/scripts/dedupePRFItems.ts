import dotenv from 'dotenv';
import { connectDatabase, closeDatabase, executeQuery } from '../config/database';

dotenv.config();

interface DuplicateItemRow {
  PRFItemID: number;
  PRFID: number;
  ItemName: string;
  Description: string;
  UnitPrice: number;
  BudgetYear: number;
  PurchaseCostCode: string;
  rn: number;
}

function parseArgs(): { fix: boolean; prfNo?: string; budgetYear?: number } {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  const prfNoPart = args.find(a => a.startsWith('--prfNo='));
  const budgetYearPart = args.find(a => a.startsWith('--budgetYear='));
  const prfNo = prfNoPart ? prfNoPart.split('=')[1] : undefined;
  const budgetYear = budgetYearPart ? Number(budgetYearPart.split('=')[1]) : undefined;
  return { fix, prfNo, budgetYear };
}

async function findDuplicates(prfNo?: string, budgetYear?: number): Promise<DuplicateItemRow[]> {
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
    SELECT * FROM ItemKey WHERE rn > 1
  `;

  const result = await executeQuery<DuplicateItemRow>(query, {
    PRFNo: prfNo ?? null,
    BudgetYear: budgetYear ?? null,
  });
  return result.recordset;
}

async function deleteDuplicates(prfNo?: string, budgetYear?: number): Promise<number> {
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
    DELETE FROM PRFItems WHERE PRFItemID IN (SELECT PRFItemID FROM ItemKey WHERE rn > 1)
  `;

  const result = await executeQuery(query, {
    PRFNo: prfNo ?? null,
    BudgetYear: budgetYear ?? null,
  });
  // rowsAffected is an array per statement; use first index
  const affectedArray = result.rowsAffected;
  const affected = affectedArray.length > 0 ? affectedArray[0] : 0;
  return affected;
}

async function main(): Promise<void> {
  const { fix, prfNo, budgetYear } = parseArgs();
  await connectDatabase();
  try {
    const duplicates = await findDuplicates(prfNo, budgetYear);

    const total = duplicates.length;
    if (total === 0) {
      console.log('✅ No duplicate PRF items found using the current criteria');
      return;
    }

    // Summarize by PRF and item key
    const summaryMap: Map<string, number> = new Map();
    duplicates.forEach(d => {
      const key = `${d.PRFID}|${d.ItemName}|${d.UnitPrice}|${d.BudgetYear}|${d.PurchaseCostCode}`;
      const current = summaryMap.get(key) || 0;
      summaryMap.set(key, current + 1);
    });

    console.log(`🔍 Found ${total} duplicate item rows`);
    console.log(`📊 Duplicate groups: ${summaryMap.size}`);

    if (!fix) {
      console.log('ℹ️ Dry run. Pass --fix to delete duplicates.');
      // Print a small sample
      const sample = duplicates.slice(0, 10);
      sample.forEach(d => {
        console.log(` - PRFID=${d.PRFID} ItemID=${d.PRFItemID} Name=${d.ItemName} Amount=${d.UnitPrice} BudgetYear=${d.BudgetYear} CostCode=${d.PurchaseCostCode}`);
      });
      return;
    }

    const deleted = await deleteDuplicates(prfNo, budgetYear);
    console.log(`🗑️ Deleted ${deleted} duplicate item rows`);
  } catch (error) {
    console.error('❌ Dedupe operation failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

// Execute
main();
