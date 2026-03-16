import { Router, Request, Response } from 'express';
import { BudgetModel } from '../models/Budget';
import { CreateBudgetRequest, UpdateBudgetRequest, BudgetQueryParams } from '../models/types';
import { authenticateToken, requireContentManager } from '../middleware/auth';
import { executeQuery } from '../config/database';
import { isAdmin } from '../utils/rolePermissions';
import https from 'https';

const router = Router();

type BudgetCutoffRow = {
  FiscalYear: number;
  IsClosed: boolean | number;
  ClosedAt: Date | null;
  ClosedBy: number | null;
  ReopenedAt: Date | null;
  ReopenedBy: number | null;
  Notes: string | null;
  UpdatedAt: Date;
};

type OpexImportItem = {
  coaCode?: string;
  coaId?: number;
  allocatedAmount: number;
  department: string;
  budgetType?: string;
  notes?: string;
  currencyCode?: 'IDR' | 'USD';
  exchangeRateToIDR?: number;
};

type ExchangeRateApiResponse = {
  result?: string;
  base_code?: string;
  time_last_update_utc?: string;
  rates?: Record<string, number>;
};

const parseFiscalYearParam = (raw: string): number | null => {
  const fiscalYear = parseInt(raw, 10);
  if (!Number.isInteger(fiscalYear)) {
    return null;
  }
  return fiscalYear;
};

const getBudgetCutoff = async (fiscalYear: number): Promise<BudgetCutoffRow | null> => {
  const result = await executeQuery<BudgetCutoffRow>(
    'SELECT FiscalYear, IsClosed, ClosedAt, ClosedBy, ReopenedAt, ReopenedBy, Notes, UpdatedAt FROM BudgetCutoff WHERE FiscalYear = @FiscalYear',
    { FiscalYear: fiscalYear }
  );
  return result.recordset[0] || null;
};

const ensureFiscalYearWritable = async (fiscalYear: number): Promise<{ blocked: boolean; message?: string }> => {
  const cutoff = await getBudgetCutoff(fiscalYear);
  const isClosed = cutoff ? Boolean(cutoff.IsClosed) : false;
  if (isClosed) {
    return {
      blocked: true,
      message: `Budget write is blocked. Fiscal year ${fiscalYear} is closed`
    };
  }
  return { blocked: false };
};

const fetchJson = async (url: string): Promise<unknown> => {
  return new Promise<unknown>((resolve, reject) => {
    const request = https.get(url, { timeout: 7000 }, (response) => {
      if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`HTTP status ${response.statusCode ?? 'unknown'}`));
        response.resume();
        return;
      }

      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body) as unknown);
        } catch {
          reject(new Error('Failed to parse exchange-rate response'));
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Exchange-rate request timed out'));
    });
    request.on('error', (error) => reject(error));
  });
};

const resolveTodayUsdToIdrRate = async (): Promise<number> => {
  const envRateRaw = typeof process.env.FX_USD_TO_IDR === 'string' ? process.env.FX_USD_TO_IDR.trim() : '';
  const envRate = Number(envRateRaw);
  if (Number.isFinite(envRate) && envRate > 0) {
    return envRate;
  }

  const responseRaw = await fetchJson('https://open.er-api.com/v6/latest/USD');
  if (typeof responseRaw !== 'object' || responseRaw === null) {
    throw new Error('Invalid exchange-rate response');
  }

  const response = responseRaw as ExchangeRateApiResponse;
  const idrRate = response.rates?.IDR;
  if (typeof idrRate !== 'number' || !Number.isFinite(idrRate) || idrRate <= 0) {
    throw new Error('USD to IDR rate unavailable');
  }
  return idrRate;
};

/**
 * @route GET /api/budgets
 * @desc Get all budgets with filtering and pagination
 * @access Public (will be protected later)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const queryParams: BudgetQueryParams = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      fiscalYear: req.query.fiscalYear ? parseInt(req.query.fiscalYear as string) : undefined,
      department: req.query.department as string,
      budgetType: req.query.budgetType as string,
      expenseType: req.query.expenseType as 'CAPEX' | 'OPEX',
      status: req.query.status as string,
      coaId: req.query.coaId ? parseInt(req.query.coaId as string) : undefined,
      search: req.query.search as string
    };

    const result = await BudgetModel.findAll(queryParams);
    
    return res.json({
      success: true,
      data: result.budgets,
      pagination: {
        page: queryParams.page,
        limit: queryParams.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / queryParams.limit!)
      }
    });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budgets',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Interface for cost code budget query result
interface CostCodeBudgetRow {
  CostCode: string;
  Description: string;
  PRFCount: number;
  AllocatedAmount: number;
  UtilizedAmount: number;
  RemainingAmount: number;
  UtilizationPercent: number;
  Status: string;
}

/**
 * @route GET /api/budgets/prf/:prfId/cost-codes
 * @desc Get cost code budget information for a specific PRF
 * @access Public (will be protected later)
 */
router.get('/prf/:prfId/cost-codes', async (req: Request, res: Response) => {
  try {
    const prfId = req.params.prfId;
    
    const query = `
      WITH PRFCostCodes AS (
        -- Get all cost codes from PRF items (from JSON specifications)
        SELECT DISTINCT
          COALESCE(
            JSON_VALUE(pi.Specifications, '$.PurchaseCostCode'),
            JSON_VALUE(pi.Specifications, '$.purchaseCostCode'),
            pi.PurchaseCostCode, 
            p.PurchaseCostCode
          ) as CostCode,
          CAST(
            COALESCE(pi.TotalPrice, p.RequestedAmount, 0) * 
            CASE
              WHEN COALESCE(p.CurrencyCode, 'IDR') = 'USD' THEN COALESCE(NULLIF(p.ExchangeRateToIDR, 0), 1)
              ELSE 1
            END
            AS DECIMAL(18,2)
          ) as ItemAmountIDR,
          pi.ItemName,
          pi.PRFItemID
        FROM PRF p
        LEFT JOIN PRFItems pi ON p.PRFID = pi.PRFID
        WHERE p.PRFNo = @PRFId
          AND (
            JSON_VALUE(pi.Specifications, '$.PurchaseCostCode') IS NOT NULL OR
            JSON_VALUE(pi.Specifications, '$.purchaseCostCode') IS NOT NULL OR
            pi.PurchaseCostCode IS NOT NULL OR 
            p.PurchaseCostCode IS NOT NULL
          )
      ),
      CostCodeBudgets AS (
        -- Get budget information for each cost code
        SELECT 
          coa.COACode as CostCode,
          coa.COAName,
          SUM(
            CAST(
              b.AllocatedAmount *
              CASE
                WHEN COALESCE(b.CurrencyCode, 'IDR') = 'USD' THEN COALESCE(NULLIF(b.ExchangeRateToIDR, 0), 1)
                ELSE 1
              END
              AS DECIMAL(18,2)
            )
          ) as TotalAllocated,
          SUM(
            CAST(
              b.UtilizedAmount *
              CASE
                WHEN COALESCE(b.CurrencyCode, 'IDR') = 'USD' THEN COALESCE(NULLIF(b.ExchangeRateToIDR, 0), 1)
                ELSE 1
              END
              AS DECIMAL(18,2)
            )
          ) as TotalUtilized
        FROM ChartOfAccounts coa
        LEFT JOIN Budget b ON coa.COAID = b.COAID AND b.FiscalYear = YEAR(GETDATE())
        WHERE coa.COACode IN (SELECT DISTINCT CostCode FROM PRFCostCodes WHERE CostCode IS NOT NULL)
        GROUP BY coa.COACode, coa.COAName
      ),
      CostCodeSpending AS (
        -- Get total spending for each cost code across all PRFs (from JSON specifications)
        SELECT 
          COALESCE(
            JSON_VALUE(pi.Specifications, '$.PurchaseCostCode'),
            JSON_VALUE(pi.Specifications, '$.purchaseCostCode'),
            pi.PurchaseCostCode, 
            p.PurchaseCostCode
          ) as CostCode,
          SUM(
            CAST(
              COALESCE(pi.TotalPrice, p.RequestedAmount, 0) *
              CASE
                WHEN COALESCE(p.CurrencyCode, 'IDR') = 'USD' THEN COALESCE(NULLIF(p.ExchangeRateToIDR, 0), 1)
                ELSE 1
              END
              AS DECIMAL(18,2)
            )
          ) as TotalSpent
        FROM PRF p
        LEFT JOIN PRFItems pi ON p.PRFID = pi.PRFID
        WHERE (
          JSON_VALUE(pi.Specifications, '$.PurchaseCostCode') IS NOT NULL OR
          JSON_VALUE(pi.Specifications, '$.purchaseCostCode') IS NOT NULL OR
          pi.PurchaseCostCode IS NOT NULL OR 
          p.PurchaseCostCode IS NOT NULL
        )
          AND p.Status IN ('Approved', 'Completed')
        GROUP BY COALESCE(
          JSON_VALUE(pi.Specifications, '$.PurchaseCostCode'),
          JSON_VALUE(pi.Specifications, '$.purchaseCostCode'),
          pi.PurchaseCostCode, 
          p.PurchaseCostCode
        )
      ),
      PRFCostCodeSummary AS (
        -- Get spending for this specific PRF by cost code
        SELECT 
          CostCode,
          SUM(ItemAmountIDR) as PRFSpent,
          COUNT(*) as ItemCount,
          STRING_AGG(ItemName, ', ') as ItemNames
        FROM PRFCostCodes
        WHERE CostCode IS NOT NULL
        GROUP BY CostCode
      )
      SELECT 
        ccb.CostCode,
        ccb.COAName,
        COALESCE(ccb.TotalAllocated, 0) as TotalBudget,
        COALESCE(ccs.TotalSpent, 0) as TotalSpent,
        COALESCE(ccb.TotalAllocated, 0) - COALESCE(ccs.TotalSpent, 0) as RemainingBudget,
        COALESCE(pcs.PRFSpent, 0) as PRFSpent,
        COALESCE(pcs.ItemCount, 0) as ItemCount,
        COALESCE(pcs.ItemNames, '') as ItemNames,
        CASE 
          WHEN ccb.TotalAllocated > 0 
          THEN ROUND((ccs.TotalSpent / ccb.TotalAllocated) * 100, 2)
          ELSE 0 
        END as UtilizationPercentage
      FROM CostCodeBudgets ccb
      LEFT JOIN CostCodeSpending ccs ON ccb.CostCode = ccs.CostCode
      LEFT JOIN PRFCostCodeSummary pcs ON ccb.CostCode = pcs.CostCode
      ORDER BY ccb.CostCode
    `;

    const result = await executeQuery(query, { PRFId: prfId });
    
    return res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error fetching PRF cost code budgets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch PRF cost code budgets',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/cost-codes
 * @desc Get budget data grouped by cost codes with actual budget allocations vs spending
 * @access Public (will be protected later)
 */
router.get('/cost-codes', async (req: Request, res: Response) => {
  try {
    // Get search parameters
    const search = req.query.search as string;
    const status = req.query.status as string;
    const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear as string) : undefined;
    
    // Build WHERE conditions for search
    let searchConditions = '';
    if (search) {
      searchConditions += ` AND (
        cbs.PurchaseCostCode LIKE '%${search}%' OR 
        cbs.COACode LIKE '%${search}%' OR 
        cbs.COAName LIKE '%${search}%'
      )`;
    }
    if (status && status !== 'all') {
      searchConditions += ` AND cbs.BudgetStatus = '${status}'`;
    }
    if (fiscalYear) {
      searchConditions += ` AND cbs.LastYear = ${fiscalYear}`;
    }

    // Query that includes both cost code budgets and standalone budgets without cost codes
    const query = `
      WITH BudgetAllocations AS (
        -- Get actual budget allocations by COA and fiscal year
        SELECT 
          b.COAID,
          b.FiscalYear,
          coa.COACode,
          coa.COAName,
          coa.Department,
          coa.ExpenseType,
          SUM(
            CAST(
              b.AllocatedAmount *
              CASE
                WHEN COALESCE(b.CurrencyCode, 'IDR') = 'USD' THEN COALESCE(NULLIF(b.ExchangeRateToIDR, 0), 1)
                ELSE 1
              END
              AS DECIMAL(18,2)
            )
          ) as TotalAllocated,
          SUM(
            CAST(
              b.UtilizedAmount *
              CASE
                WHEN COALESCE(b.CurrencyCode, 'IDR') = 'USD' THEN COALESCE(NULLIF(b.ExchangeRateToIDR, 0), 1)
                ELSE 1
              END
              AS DECIMAL(18,2)
            )
          ) as TotalUtilized
        FROM Budget b
        INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID
        ${fiscalYear ? `WHERE b.FiscalYear = ${fiscalYear}` : ''}
        GROUP BY b.COAID, b.FiscalYear, coa.COACode, coa.COAName, coa.Department, coa.ExpenseType
      ),
      CostCodeSpending AS (
        -- Get spending data by cost codes
        SELECT 
          p.PurchaseCostCode,
          p.COAID,
          p.BudgetYear,
          SUM(
            CAST(
              COALESCE(p.RequestedAmount, 0) *
              CASE
                WHEN COALESCE(p.CurrencyCode, 'IDR') = 'USD' THEN COALESCE(NULLIF(p.ExchangeRateToIDR, 0), 1)
                ELSE 1
              END
              AS DECIMAL(18,2)
            )
          ) as TotalRequested,
          SUM(
            CAST(
              COALESCE(COALESCE(p.ApprovedAmount, p.RequestedAmount), 0) *
              CASE
                WHEN COALESCE(p.CurrencyCode, 'IDR') = 'USD' THEN COALESCE(NULLIF(p.ExchangeRateToIDR, 0), 1)
                ELSE 1
              END
              AS DECIMAL(18,2)
            )
          ) as TotalApproved,
          SUM(
            CAST(
              COALESCE(p.ActualAmount, 0) *
              CASE
                WHEN COALESCE(p.CurrencyCode, 'IDR') = 'USD' THEN COALESCE(NULLIF(p.ExchangeRateToIDR, 0), 1)
                ELSE 1
              END
              AS DECIMAL(18,2)
            )
          ) as TotalActual,
          COUNT(*) as RequestCount
        FROM dbo.PRF p
        WHERE p.PurchaseCostCode IS NOT NULL 
          AND p.PurchaseCostCode != ''
          AND p.BudgetYear IS NOT NULL
          AND p.COAID IS NOT NULL
          ${fiscalYear ? `AND p.BudgetYear = ${fiscalYear}` : ''}
        GROUP BY p.PurchaseCostCode, p.COAID, p.BudgetYear
      ),
      CostCodeBudgetSummary AS (
        -- Join budget allocations with cost code spending
        SELECT 
          cs.PurchaseCostCode,
          cs.COAID,
          COALESCE(ba.COACode, coa.COACode) as COACode,
          COALESCE(ba.COAName, coa.COAName) as COAName,
          COALESCE(ba.Department, coa.Department) as Department,
          COALESCE(ba.ExpenseType, coa.ExpenseType) as ExpenseType,
          COALESCE(SUM(ba.TotalAllocated), 0) as GrandTotalAllocated,
          SUM(cs.TotalRequested) as GrandTotalRequested,
          SUM(cs.TotalApproved) as GrandTotalApproved,
          SUM(cs.TotalActual) as GrandTotalActual,
          SUM(cs.RequestCount) as TotalRequests,
          COUNT(DISTINCT cs.BudgetYear) as YearsActive,
          MIN(cs.BudgetYear) as FirstYear,
          MAX(cs.BudgetYear) as LastYear
        FROM CostCodeSpending cs
        LEFT JOIN BudgetAllocations ba ON cs.PurchaseCostCode = ba.COACode AND cs.BudgetYear = ba.FiscalYear
        LEFT JOIN ChartOfAccounts coa ON cs.PurchaseCostCode = coa.COACode
        GROUP BY cs.PurchaseCostCode, cs.COAID, COALESCE(ba.COACode, coa.COACode), COALESCE(ba.COAName, coa.COAName), COALESCE(ba.Department, coa.Department), COALESCE(ba.ExpenseType, coa.ExpenseType)
        
        UNION ALL
        
        -- Include budgets without cost code mappings
        SELECT 
          'NO_COST_CODE_' + ba.COACode as PurchaseCostCode,
          ba.COAID,
          ba.COACode,
          ba.COAName,
          ba.Department,
          ba.ExpenseType,
          SUM(ba.TotalAllocated) as GrandTotalAllocated,
          0 as GrandTotalRequested,
          0 as GrandTotalApproved,
          0 as GrandTotalActual,
          0 as TotalRequests,
          COUNT(DISTINCT ba.FiscalYear) as YearsActive,
          MIN(ba.FiscalYear) as FirstYear,
          MAX(ba.FiscalYear) as LastYear
        FROM BudgetAllocations ba
        WHERE ba.COACode NOT IN (
          SELECT DISTINCT p.PurchaseCostCode 
          FROM dbo.PRF p 
          WHERE p.PurchaseCostCode IS NOT NULL AND p.PurchaseCostCode != ''
        )
        GROUP BY ba.COAID, ba.COACode, ba.COAName, ba.Department, ba.ExpenseType
      )
      SELECT 
        cbs.PurchaseCostCode,
        cbs.COACode,
        cbs.COAName,
        cbs.Department,
        cbs.ExpenseType,
        cbs.GrandTotalAllocated,
        cbs.GrandTotalRequested,
        cbs.GrandTotalApproved,
        cbs.GrandTotalActual,
        cbs.TotalRequests,
        cbs.YearsActive,
        cbs.FirstYear,
        cbs.LastYear,
        CASE 
          WHEN cbs.GrandTotalAllocated > 0 
          THEN ROUND((cbs.GrandTotalApproved / cbs.GrandTotalAllocated) * 100, 2)
          ELSE 0 
        END as UtilizationPercentage,
        CASE 
          WHEN cbs.GrandTotalRequested > 0 
          THEN ROUND((cbs.GrandTotalApproved / cbs.GrandTotalRequested) * 100, 2)
          ELSE 0 
        END as ApprovalRate,
        CASE 
          WHEN cbs.GrandTotalAllocated = 0 THEN 'No Budget'
          WHEN cbs.GrandTotalApproved < cbs.GrandTotalAllocated * 0.8 THEN 'Under Budget'
          WHEN cbs.GrandTotalApproved > cbs.GrandTotalAllocated * 1.1 THEN 'Over Budget'
          ELSE 'On Track'
        END as BudgetStatus
      FROM CostCodeBudgetSummary cbs
      WHERE 1=1 ${searchConditions}
      ORDER BY cbs.GrandTotalAllocated DESC, cbs.GrandTotalApproved DESC
    `;

    const result = await executeQuery(query);
    
    // Define interface for cost code budget row with actual budget allocations
    interface CostCodeBudgetRow {
      PurchaseCostCode: string;
      COACode: string;
      COAName: string;
      Department: string;
      ExpenseType: string;
      GrandTotalAllocated: number | string;
      GrandTotalRequested: number | string;
      GrandTotalApproved: number | string;
      GrandTotalActual: number | string;
      TotalRequests: number;
      YearsActive: number;
      FirstYear: number;
      LastYear: number;
      UtilizationPercentage: number;
      ApprovalRate: number;
      BudgetStatus: string;
    }
    
    // Calculate summary statistics
    const recordset = result.recordset as CostCodeBudgetRow[];
    const totalCostCodes: number = recordset.length;
    const totalBudgetAllocated: number = recordset.reduce((sum: number, row: CostCodeBudgetRow) => 
      sum + (parseFloat(String(row.GrandTotalAllocated)) || 0), 0);
    const totalBudgetRequested: number = recordset.reduce((sum: number, row: CostCodeBudgetRow) => 
      sum + (parseFloat(String(row.GrandTotalRequested)) || 0), 0);
    const totalBudgetApproved: number = recordset.reduce((sum: number, row: CostCodeBudgetRow) => 
      sum + (parseFloat(String(row.GrandTotalApproved)) || 0), 0);
    const totalBudgetActual: number = recordset.reduce((sum: number, row: CostCodeBudgetRow) => 
      sum + (parseFloat(String(row.GrandTotalActual)) || 0), 0);

    return res.json({
      success: true,
      message: 'Cost code budget analysis with actual allocations retrieved successfully',
      data: {
        costCodes: recordset,
        summary: {
          totalCostCodes,
          totalBudgetAllocated: Math.round(totalBudgetAllocated * 100) / 100,
          totalBudgetRequested: Math.round(totalBudgetRequested * 100) / 100,
          totalBudgetApproved: Math.round(totalBudgetApproved * 100) / 100,
          totalBudgetActual: Math.round(totalBudgetActual * 100) / 100,
          overallUtilization: totalBudgetAllocated > 0 ? 
            Math.round((totalBudgetApproved / totalBudgetAllocated) * 100 * 100) / 100 : 0,
          overallApprovalRate: totalBudgetRequested > 0 ? 
            Math.round((totalBudgetApproved / totalBudgetRequested) * 100 * 100) / 100 : 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching cost code budgets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch cost code budgets',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/cutoff/:fiscalYear', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const fiscalYear = parseFiscalYearParam(req.params.fiscalYear);
    if (fiscalYear === null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fiscal year'
      });
    }

    const cutoff = await getBudgetCutoff(fiscalYear);
    const normalized = cutoff || {
      FiscalYear: fiscalYear,
      IsClosed: false,
      ClosedAt: null,
      ClosedBy: null,
      ReopenedAt: null,
      ReopenedBy: null,
      Notes: null,
      UpdatedAt: new Date()
    };

    return res.json({
      success: true,
      data: {
        fiscalYear: normalized.FiscalYear,
        isClosed: Boolean(normalized.IsClosed),
        closedAt: normalized.ClosedAt,
        closedBy: normalized.ClosedBy,
        reopenedAt: normalized.ReopenedAt,
        reopenedBy: normalized.ReopenedBy,
        notes: normalized.Notes,
        updatedAt: normalized.UpdatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching budget cutoff:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget cutoff',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/exchange-rate/usd-idr/today', authenticateToken, requireContentManager, async (_req: Request, res: Response) => {
  try {
    const rate = await resolveTodayUsdToIdrRate();
    return res.json({
      success: true,
      data: {
        baseCurrency: 'USD',
        targetCurrency: 'IDR',
        exchangeRateToIDR: rate,
        effectiveDate: new Date().toISOString().slice(0, 10)
      }
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: 'Failed to resolve today exchange rate',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/cutoff/:fiscalYear/close', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const fiscalYear = parseFiscalYearParam(req.params.fiscalYear);
    if (fiscalYear === null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fiscal year'
      });
    }
    if (!req.user?.UserID) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : null;

    await executeQuery(
      `
      MERGE BudgetCutoff AS target
      USING (SELECT @FiscalYear AS FiscalYear) AS source
      ON target.FiscalYear = source.FiscalYear
      WHEN MATCHED THEN
        UPDATE SET
          IsClosed = 1,
          ClosedAt = GETDATE(),
          ClosedBy = @UserID,
          ReopenedAt = NULL,
          ReopenedBy = NULL,
          Notes = @Notes,
          UpdatedAt = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (FiscalYear, IsClosed, ClosedAt, ClosedBy, ReopenedAt, ReopenedBy, Notes, UpdatedAt)
        VALUES (@FiscalYear, 1, GETDATE(), @UserID, NULL, NULL, @Notes, GETDATE());
      `,
      { FiscalYear: fiscalYear, UserID: req.user.UserID, Notes: notes }
    );

    await executeQuery(
      `
      INSERT INTO BudgetCutoffAudit (FiscalYear, Action, ActionBy, Notes)
      VALUES (@FiscalYear, 'CLOSE', @ActionBy, @Notes)
      `,
      { FiscalYear: fiscalYear, ActionBy: req.user.UserID, Notes: notes }
    );

    return res.json({
      success: true,
      message: `Fiscal year ${fiscalYear} budget closed successfully`
    });
  } catch (error) {
    console.error('Error closing budget cutoff:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to close budget cutoff',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/cutoff/:fiscalYear/reopen', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const fiscalYear = parseFiscalYearParam(req.params.fiscalYear);
    if (fiscalYear === null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fiscal year'
      });
    }
    if (!req.user?.UserID || !req.user?.Role) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    if (!isAdmin(req.user.Role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to reopen fiscal year cutoff'
      });
    }

    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : null;

    await executeQuery(
      `
      MERGE BudgetCutoff AS target
      USING (SELECT @FiscalYear AS FiscalYear) AS source
      ON target.FiscalYear = source.FiscalYear
      WHEN MATCHED THEN
        UPDATE SET
          IsClosed = 0,
          ReopenedAt = GETDATE(),
          ReopenedBy = @UserID,
          Notes = @Notes,
          UpdatedAt = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (FiscalYear, IsClosed, ClosedAt, ClosedBy, ReopenedAt, ReopenedBy, Notes, UpdatedAt)
        VALUES (@FiscalYear, 0, NULL, NULL, GETDATE(), @UserID, @Notes, GETDATE());
      `,
      { FiscalYear: fiscalYear, UserID: req.user.UserID, Notes: notes }
    );

    await executeQuery(
      `
      INSERT INTO BudgetCutoffAudit (FiscalYear, Action, ActionBy, Notes)
      VALUES (@FiscalYear, 'REOPEN', @ActionBy, @Notes)
      `,
      { FiscalYear: fiscalYear, ActionBy: req.user.UserID, Notes: notes }
    );

    return res.json({
      success: true,
      message: `Fiscal year ${fiscalYear} budget reopened successfully`
    });
  } catch (error) {
    console.error('Error reopening budget cutoff:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reopen budget cutoff',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/opex/import', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!req.user?.UserID) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const fiscalYear = typeof req.body?.fiscalYear === 'number' ? req.body.fiscalYear : parseInt(String(req.body?.fiscalYear), 10);
    if (!Number.isInteger(fiscalYear)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fiscalYear'
      });
    }

    const writeState = await ensureFiscalYearWritable(fiscalYear);
    if (writeState.blocked) {
      return res.status(409).json({
        success: false,
        message: writeState.message
      });
    }

    const rows: unknown[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'rows is required and must contain at least one item'
      });
    }

    const parsedItems: OpexImportItem[] = rows.map((entry) => ({
      coaCode: typeof (entry as OpexImportItem).coaCode === 'string' ? (entry as OpexImportItem).coaCode : undefined,
      coaId: typeof (entry as OpexImportItem).coaId === 'number' ? (entry as OpexImportItem).coaId : undefined,
      allocatedAmount: Number((entry as OpexImportItem).allocatedAmount),
      department: String((entry as OpexImportItem).department || ''),
      budgetType: typeof (entry as OpexImportItem).budgetType === 'string' ? (entry as OpexImportItem).budgetType : undefined,
      notes: typeof (entry as OpexImportItem).notes === 'string' ? (entry as OpexImportItem).notes : undefined,
      currencyCode: (entry as OpexImportItem).currencyCode === 'USD' ? 'USD' : 'IDR',
      exchangeRateToIDR: Number((entry as OpexImportItem).exchangeRateToIDR || 1)
    }));

    const inserted: number[] = [];
    const updated: number[] = [];
    const rejected: { index: number; reason: string }[] = [];

    for (let index = 0; index < parsedItems.length; index += 1) {
      const item = parsedItems[index];
      let exchangeRateToIDR = item.exchangeRateToIDR ?? 1;
      if (!Number.isFinite(item.allocatedAmount) || item.allocatedAmount < 0) {
        rejected.push({ index, reason: 'allocatedAmount must be a non-negative number' });
        continue;
      }
      if (!item.department.trim()) {
        rejected.push({ index, reason: 'department is required' });
        continue;
      }
      if (item.currencyCode === 'USD' && (!Number.isFinite(exchangeRateToIDR) || exchangeRateToIDR <= 0)) {
        try {
          exchangeRateToIDR = await resolveTodayUsdToIdrRate();
        } catch {
          rejected.push({ index, reason: 'Unable to resolve today USD to IDR exchange rate' });
          continue;
        }
      }
      if (!item.coaId && !item.coaCode) {
        rejected.push({ index, reason: 'coaId or coaCode is required' });
        continue;
      }

      let coaId = item.coaId ?? null;
      if (!coaId && item.coaCode) {
        const coaResult = await executeQuery<{ COAID: number; ExpenseType: string; Department: string }>(
          'SELECT COAID, ExpenseType, Department FROM ChartOfAccounts WHERE COACode = @COACode',
          { COACode: item.coaCode.trim() }
        );
        const coa = coaResult.recordset[0];
        if (!coa) {
          rejected.push({ index, reason: `COA code not found: ${item.coaCode}` });
          continue;
        }
        if (coa.ExpenseType !== 'OPEX') {
          rejected.push({ index, reason: `COA code is not OPEX: ${item.coaCode}` });
          continue;
        }
        coaId = coa.COAID;
      } else if (coaId) {
        const coaResult = await executeQuery<{ COAID: number; ExpenseType: string; Department: string }>(
          'SELECT COAID, ExpenseType, Department FROM ChartOfAccounts WHERE COAID = @COAID',
          { COAID: coaId }
        );
        const coa = coaResult.recordset[0];
        if (!coa) {
          rejected.push({ index, reason: `COA ID not found: ${coaId}` });
          continue;
        }
        if (coa.ExpenseType !== 'OPEX') {
          rejected.push({ index, reason: `COA ID is not OPEX: ${coaId}` });
          continue;
        }
      }

      if (!coaId) {
        rejected.push({ index, reason: 'Unable to resolve COAID' });
        continue;
      }

      const existingBudget = await BudgetModel.findByCOAAndYear(coaId, fiscalYear);
      if (existingBudget) {
        await BudgetModel.update(existingBudget.BudgetID, {
          AllocatedAmount: item.allocatedAmount,
          Department: item.department.trim(),
          ExpenseType: 'OPEX',
          CurrencyCode: item.currencyCode || 'IDR',
          ExchangeRateToIDR: item.currencyCode === 'USD' ? exchangeRateToIDR : 1,
          BudgetType: item.budgetType || 'Annual',
          Notes: item.notes
        });
        updated.push(existingBudget.BudgetID);
      } else {
        const created = await BudgetModel.create(
          {
            COAID: coaId,
            FiscalYear: fiscalYear,
            AllocatedAmount: item.allocatedAmount,
            Department: item.department.trim(),
            ExpenseType: 'OPEX',
            CurrencyCode: item.currencyCode || 'IDR',
            ExchangeRateToIDR: item.currencyCode === 'USD' ? exchangeRateToIDR : 1,
            BudgetType: item.budgetType || 'Annual',
            Notes: item.notes
          },
          req.user.UserID
        );
        inserted.push(created.BudgetID);
      }
    }

    return res.json({
      success: true,
      message: 'OPEX import processed',
      data: {
        fiscalYear,
        totalRows: parsedItems.length,
        insertedCount: inserted.length,
        updatedCount: updated.length,
        rejectedCount: rejected.length,
        insertedBudgetIds: inserted,
        updatedBudgetIds: updated,
        rejected
      }
    });
  } catch (error) {
    console.error('Error importing OPEX budgets:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import OPEX budgets',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/:id
 * @desc Get budget by ID
 * @access Public (will be protected later)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const budgetId = parseInt(req.params.id);
    
    if (isNaN(budgetId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid budget ID'
      });
    }

    const budget = await BudgetModel.findById(budgetId);
    
    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    return res.json({
      success: true,
      data: budget
    });
  } catch (error) {
    console.error('Error fetching budget:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/coa/:coaId/year/:fiscalYear
 * @desc Get budget by COA and fiscal year
 * @access Public (will be protected later)
 */
router.get('/coa/:coaId/year/:fiscalYear', async (req: Request, res: Response) => {
  try {
    const coaId = parseInt(req.params.coaId);
    const fiscalYear = parseInt(req.params.fiscalYear);
    
    if (isNaN(coaId) || isNaN(fiscalYear)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid COA ID or fiscal year'
      });
    }

    const budget = await BudgetModel.findByCOAAndYear(coaId, fiscalYear);
    
    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    return res.json({
      success: true,
      data: budget
    });
  } catch (error) {
    console.error('Error fetching budget by COA and year:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/budgets
 * @desc Create new budget
 * @access Content Manager (admin or doccon)
 */
router.post('/', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const budgetData: CreateBudgetRequest = req.body;
    
    // Basic validation
    if (!budgetData.COAID || !budgetData.FiscalYear || !budgetData.AllocatedAmount || !budgetData.Department) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: COAID, FiscalYear, AllocatedAmount, Department'
      });
    }
    if (budgetData.CurrencyCode && !['IDR', 'USD'].includes(budgetData.CurrencyCode)) {
      return res.status(400).json({
        success: false,
        message: 'CurrencyCode must be IDR or USD'
      });
    }
    if (budgetData.CurrencyCode === 'USD' && (budgetData.ExchangeRateToIDR === undefined || budgetData.ExchangeRateToIDR <= 0)) {
      try {
        budgetData.ExchangeRateToIDR = await resolveTodayUsdToIdrRate();
      } catch {
        return res.status(503).json({
          success: false,
          message: 'Unable to resolve today USD to IDR exchange rate. Please provide ExchangeRateToIDR'
        });
      }
    } else if (budgetData.ExchangeRateToIDR !== undefined && budgetData.ExchangeRateToIDR <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ExchangeRateToIDR must be greater than 0'
      });
    }

    // Ensure user is authenticated
    if (!req.user?.UserID) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    // Check if budget already exists for this COA and fiscal year
    const existingBudget = await BudgetModel.findByCOAAndYear(budgetData.COAID, budgetData.FiscalYear);
    if (existingBudget) {
      return res.status(409).json({
        success: false,
        message: 'Budget already exists for this COA and fiscal year'
      });
    }

    const writeState = await ensureFiscalYearWritable(budgetData.FiscalYear);
    if (writeState.blocked) {
      return res.status(409).json({
        success: false,
        message: writeState.message
      });
    }
    
    const budget = await BudgetModel.create(budgetData, req.user.UserID);
    
    return res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data: budget
    });
  } catch (error) {
    console.error('Error creating budget:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create budget',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route PUT /api/budgets/:id
 * @desc Update budget
 * @access Content Manager (admin or doccon)
 */
router.put('/:id', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const budgetId = parseInt(req.params.id);
    const updateData: UpdateBudgetRequest = req.body;
    
    if (isNaN(budgetId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid budget ID'
      });
    }

    // Check if budget exists
    const existingBudget = await BudgetModel.findById(budgetId);
    if (!existingBudget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }
    if (updateData.CurrencyCode && !['IDR', 'USD'].includes(updateData.CurrencyCode)) {
      return res.status(400).json({
        success: false,
        message: 'CurrencyCode must be IDR or USD'
      });
    }
    const effectiveCurrency = updateData.CurrencyCode || existingBudget.CurrencyCode;
    if (effectiveCurrency === 'USD' && (updateData.ExchangeRateToIDR === undefined || updateData.ExchangeRateToIDR <= 0)) {
      try {
        updateData.ExchangeRateToIDR = await resolveTodayUsdToIdrRate();
      } catch {
        return res.status(503).json({
          success: false,
          message: 'Unable to resolve today USD to IDR exchange rate. Please provide ExchangeRateToIDR'
        });
      }
    } else if (updateData.ExchangeRateToIDR !== undefined && updateData.ExchangeRateToIDR <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ExchangeRateToIDR must be greater than 0'
      });
    }

    const writeState = await ensureFiscalYearWritable(existingBudget.FiscalYear);
    if (writeState.blocked) {
      return res.status(409).json({
        success: false,
        message: writeState.message
      });
    }
    
    const updatedBudget = await BudgetModel.update(budgetId, updateData);
    
    return res.json({
      success: true,
      message: 'Budget updated successfully',
      data: updatedBudget
    });
  } catch (error) {
    console.error('Error updating budget:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update budget',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route DELETE /api/budgets/:id
 * @desc Delete budget
 * @access Content Manager (admin or doccon)
 */
router.delete('/:id', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const budgetId = parseInt(req.params.id);
    
    if (isNaN(budgetId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid budget ID'
      });
    }

    // Check if budget exists
    const existingBudget = await BudgetModel.findById(budgetId);
    if (!existingBudget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    const writeState = await ensureFiscalYearWritable(existingBudget.FiscalYear);
    if (writeState.blocked) {
      return res.status(409).json({
        success: false,
        message: writeState.message
      });
    }
    
    const deleted = await BudgetModel.delete(budgetId);
    
    if (deleted) {
      return res.json({
        success: true,
        message: 'Budget deleted successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete budget'
      });
    }
  } catch (error) {
    console.error('Error deleting budget:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete budget',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/:id/utilization
 * @desc Get budget utilization for a specific budget
 * @access Public (will be protected later)
 */
router.get('/:id/utilization', async (req: Request, res: Response) => {
  try {
    const budgetId = parseInt(req.params.id);
    
    if (isNaN(budgetId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid budget ID'
      });
    }

    const utilization = await BudgetModel.getBudgetUtilization(budgetId);
    
    if (!utilization) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }

    return res.json({
      success: true,
      data: utilization
    });
  } catch (error) {
    console.error('Error fetching budget utilization:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget utilization',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/utilization/department/:department
 * @desc Get budget utilization by department
 * @access Public (will be protected later)
 */
router.get('/utilization/department/:department', async (req: Request, res: Response) => {
  try {
    const department = req.params.department;
    const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear as string) : undefined;

    const utilization = await BudgetModel.getBudgetUtilizationByDepartment(department, fiscalYear);
    
    return res.json({
      success: true,
      data: utilization
    });
  } catch (error) {
    console.error('Error fetching budget utilization by department:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget utilization by department',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/utilization/summary/:fiscalYear
 * @desc Get budget utilization summary by fiscal year
 * @access Public (will be protected later)
 */
router.get('/utilization/summary/:fiscalYear', async (req: Request, res: Response) => {
  try {
    const fiscalYear = parseInt(req.params.fiscalYear);
    
    if (isNaN(fiscalYear)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid fiscal year'
      });
    }

    const summary = await BudgetModel.getBudgetUtilizationSummary(fiscalYear);
    
    return res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching budget utilization summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget utilization summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route PUT /api/budgets/:id/update-utilization
 * @desc Update budget utilization (recalculate from PRF data)
 * @access Content Manager (admin or doccon)
 */
router.put('/:id/update-utilization', authenticateToken, requireContentManager, async (req: Request, res: Response) => {
  try {
    const budgetId = parseInt(req.params.id);
    
    if (isNaN(budgetId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid budget ID'
      });
    }

    // Check if budget exists
    const existingBudget = await BudgetModel.findById(budgetId);
    if (!existingBudget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found'
      });
    }
    
    const updatedBudget = await BudgetModel.updateUtilization(budgetId);
    
    return res.json({
      success: true,
      message: 'Budget utilization updated successfully',
      data: updatedBudget
    });
  } catch (error) {
    console.error('Error updating budget utilization:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update budget utilization',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/alerts
 * @desc Get budget alerts (over-utilized or near limit)
 * @access Public (will be protected later)
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const thresholdPercentage = req.query.threshold ? parseInt(req.query.threshold as string) : 90;
    
    const alerts = await BudgetModel.getBudgetAlerts(thresholdPercentage);
    
    return res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error fetching budget alerts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget alerts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/budgets/statistics
 * @desc Get budget statistics
 * @access Public (will be protected later)
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const fiscalYear = req.query.fiscalYear ? parseInt(req.query.fiscalYear as string) : undefined;
    
    const statistics = await BudgetModel.getStatistics(fiscalYear);
    
    return res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error fetching budget statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
