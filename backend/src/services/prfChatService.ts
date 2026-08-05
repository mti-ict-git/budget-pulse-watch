import crypto from 'crypto';
import { resolveStoredFile } from './storagePathResolver';
import OpenAI from 'openai';
import type { ResponseFunctionToolCall, ResponseInputItem, Tool } from 'openai/resources/responses/responses';
import { executeQuery } from '../config/database';
import { loadSettings } from '../routes/settingsRoutes';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessageInput {
  role: ChatRole;
  content: string;
}

export interface ChatReference {
  type: 'prf' | 'file';
  id: number;
  label: string;
  prfId: number;
  prfNo: string;
  mimeType?: string;
  fileName?: string;
  previewUrl?: string;
  downloadUrl?: string;
}

export interface ChatContext {
  activePrf?: { prfId: number; prfNo: string; label: string };
  dateFrom?: string;
  dateTo?: string;
  department?: string;
  purchaseDefinition?: 'with_po' | 'all_requested' | 'picked_up';
  fiscalYear?: number;
  expenseType?: 'CAPEX' | 'OPEX';
}

export interface ChatEvidence {
  tool: string;
  title: string;
  details: Array<{ label: string; value: string | number }>;
}

export interface ChatFollowUpAction {
  id: string;
  label: string;
  prompt: string;
}

export interface ChatClarification {
  question: string;
  options: Array<{
    id: string;
    label: string;
    description: string;
    prompt: string;
    contextPatch?: Partial<ChatContext>;
  }>;
}

export interface ChatAnswer {
  answer: string;
  references: ChatReference[];
  model: string;
  evidence: ChatEvidence[];
  followUpActions: ChatFollowUpAction[];
  context: ChatContext;
  clarification?: ChatClarification;
}

type ToolResult = {
  data: unknown;
  references?: ChatReference[];
};

type SearchArgs = {
  query?: string;
  status?: string;
  department?: string;
  year?: number;
  hasAttachments?: boolean;
  missingPo?: boolean;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
};

type ItemStatisticsArgs = {
  period: 'today' | 'this_week' | 'this_month' | 'custom';
  dateFrom?: string | null;
  dateTo?: string | null;
  purchaseDefinition: 'with_po' | 'all_requested' | 'picked_up';
  department?: string | null;
};

type BudgetUtilizationArgs = {
  fiscalYear: number;
  expenseType?: 'CAPEX' | 'OPEX' | null;
  department?: string | null;
  coaQuery?: string | null;
  minimumUtilization?: number | null;
  sortBy: 'risk' | 'utilization' | 'remaining';
  limit?: number | null;
};

type BudgetContributorArgs = {
  fiscalYear: number;
  coaCode: string;
  limit?: number | null;
};

type WorkflowIssueArgs = {
  fiscalYear: number;
  issueType: 'all' | 'stale' | 'missing_po' | 'missing_attachment' | 'missing_cost_code' | 'amount_mismatch';
  department?: string | null;
  expenseType?: 'CAPEX' | 'OPEX' | null;
  ageDays?: number | null;
  limit?: number | null;
};

const MODEL = process.env.CHATBOT_OPENAI_MODEL?.trim() || 'gpt-5.6-sol';
const MAX_TOOL_ROUNDS = 4;
const MAX_RESULTS = 25;

const tools: Tool[] = [
  {
    type: 'function',
    name: 'search_prfs',
    description: 'Search PRFs by user-visible PRF number or text and optional filters. Always use this first for a number typed by the user. Returns at most 25 matching PRFs.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: ['string', 'null'], description: 'PRF number, title, description, requestor, item, cost code, or PO text.' },
        status: { type: ['string', 'null'] },
        department: { type: ['string', 'null'] },
        year: { type: ['integer', 'null'] },
        hasAttachments: { type: ['boolean', 'null'] },
        missingPo: { type: ['boolean', 'null'], description: 'True to find PRFs with at least one item without original or split PO.' },
        dateFrom: { type: ['string', 'null'], description: 'Inclusive PRF DateSubmit/RequestDate lower bound in YYYY-MM-DD.' },
        dateTo: { type: ['string', 'null'], description: 'Inclusive PRF DateSubmit/RequestDate upper bound in YYYY-MM-DD.' },
        limit: { type: ['integer', 'null'], minimum: 1, maximum: MAX_RESULTS }
      },
      required: ['query', 'status', 'department', 'year', 'hasAttachments', 'missingPo', 'dateFrom', 'dateTo', 'limit']
    }
  },
  {
    type: 'function',
    name: 'get_prf_detail',
    description: 'Get one PRF header and all item details. A number typed by a user is a PRF number, not an internal PRF ID. Use prfId only when copied from a previous tool result.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        prfId: { type: ['integer', 'null'] },
        prfNo: { type: ['string', 'null'] }
      },
      required: ['prfId', 'prfNo']
    }
  },
  {
    type: 'function',
    name: 'get_prf_statistics',
    description: 'Aggregate PRF count and requested amount grouped by status, department, or year with optional filters.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        groupBy: { type: 'string', enum: ['status', 'department', 'year'] },
        status: { type: ['string', 'null'] },
        department: { type: ['string', 'null'] },
        year: { type: ['integer', 'null'] },
        dateFrom: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD.' },
        dateTo: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD.' }
      },
      required: ['groupBy', 'status', 'department', 'year', 'dateFrom', 'dateTo']
    }
  },
  {
    type: 'function',
    name: 'get_item_statistics',
    description: 'Count PRF line items and total quantity for today, this week, this month, or a custom date range using the explicitly selected purchase definition. Date periods are resolved by the backend in Asia/Jakarta.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        period: { type: 'string', enum: ['today', 'this_week', 'this_month', 'custom'] },
        dateFrom: { type: ['string', 'null'], description: 'Required for custom; ISO date YYYY-MM-DD.' },
        dateTo: { type: ['string', 'null'], description: 'Required for custom; ISO date YYYY-MM-DD.' },
        purchaseDefinition: { type: 'string', enum: ['with_po', 'all_requested', 'picked_up'] },
        department: { type: ['string', 'null'] }
      },
      required: ['period', 'dateFrom', 'dateTo', 'purchaseDefinition', 'department']
    }
  },
  {
    type: 'function',
    name: 'list_prf_attachments',
    description: 'List attachment metadata for one PRF. A number typed by a user is a PRF number; use prfId only from a previous tool result. Does not read attachment contents.',
    strict: true,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        prfId: { type: ['integer', 'null'] },
        prfNo: { type: ['string', 'null'] },
        latestOnly: { type: 'boolean' }
      },
      required: ['prfId', 'prfNo', 'latestOnly']
    }
  },
  {
    type: 'function',
    name: 'get_budget_utilization',
    description: 'Get governed CAPEX/OPEX budget availability, committed item value, remaining amount, utilization, and risk by active COA for one fiscal year. Use for budget status, usage, remaining budget, near-limit, or over-budget questions.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        fiscalYear: { type: 'integer', minimum: 2020, maximum: 2100 },
        expenseType: { type: ['string', 'null'], enum: ['CAPEX', 'OPEX', null] },
        department: { type: ['string', 'null'] },
        coaQuery: { type: ['string', 'null'], description: 'Optional exact/partial COA code or COA name.' },
        minimumUtilization: { type: ['number', 'null'], minimum: 0, maximum: 10000 },
        sortBy: { type: 'string', enum: ['risk', 'utilization', 'remaining'] },
        limit: { type: ['integer', 'null'], minimum: 1, maximum: MAX_RESULTS }
      },
      required: ['fiscalYear', 'expenseType', 'department', 'coaQuery', 'minimumUtilization', 'sortBy', 'limit']
    }
  },
  {
    type: 'function',
    name: 'get_budget_contributors',
    description: 'List the bounded PRFs contributing non-cancelled item value to one active COA in one fiscal year. Use a COA code returned by get_budget_utilization.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        fiscalYear: { type: 'integer', minimum: 2020, maximum: 2100 },
        coaCode: { type: 'string', minLength: 1, maxLength: 100 },
        limit: { type: ['integer', 'null'], minimum: 1, maximum: MAX_RESULTS }
      },
      required: ['fiscalYear', 'coaCode', 'limit']
    }
  },
  {
    type: 'function',
    name: 'get_workflow_issues',
    description: 'Summarize and list bounded PRF workflow/data-quality issues: stale active PRFs, missing PO, missing attachment metadata, missing/unknown item cost code, or header/item amount mismatch. Read-only review signals only.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        fiscalYear: { type: 'integer', minimum: 2020, maximum: 2100 },
        issueType: { type: 'string', enum: ['all', 'stale', 'missing_po', 'missing_attachment', 'missing_cost_code', 'amount_mismatch'] },
        department: { type: ['string', 'null'] },
        expenseType: { type: ['string', 'null'], enum: ['CAPEX', 'OPEX', null] },
        ageDays: { type: ['integer', 'null'], minimum: 1, maximum: 3650 },
        limit: { type: ['integer', 'null'], minimum: 1, maximum: MAX_RESULTS }
      },
      required: ['fiscalYear', 'issueType', 'department', 'expenseType', 'ageDays', 'limit']
    }
  }
];

function boundedLimit(value: unknown): number {
  return Math.max(1, Math.min(MAX_RESULTS, typeof value === 'number' ? Math.floor(value) : 10));
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function searchPrfs(args: SearchArgs): Promise<ToolResult> {
  const params: Record<string, unknown> = { limit: boundedLimit(args.limit) };
  const where: string[] = ['1 = 1'];
  if (args.query?.trim()) {
    const rawQuery = args.query.trim();
    const normalized = rawQuery.toLocaleLowerCase('id-ID');
    const aliases = new Set<string>([rawQuery]);
    if (/\bkamera\b/.test(normalized)) ['camera', 'cctv', 'dashcam', 'webcam'].forEach((value) => aliases.add(value));
    if (/\bponsel\b|\btelepon genggam\b/.test(normalized)) ['handphone', 'mobile phone', 'smartphone'].forEach((value) => aliases.add(value));
    if (/\blaptop\b/.test(normalized)) ['notebook'].forEach((value) => aliases.add(value));
    const queryClauses = Array.from(aliases).slice(0, 6).map((value, index) => {
      const key = `query${index}`;
      params[key] = `%${value}%`;
      return `(p.PRFNo LIKE @${key} OR p.Title LIKE @${key} OR p.Description LIKE @${key} OR p.SumDescriptionRequested LIKE @${key} OR p.RequiredFor LIKE @${key} OR p.SubmitBy LIKE @${key} OR EXISTS (
        SELECT 1 FROM PRFItems qi WHERE qi.PRFID = p.PRFID AND
        (qi.ItemName LIKE @${key} OR qi.Description LIKE @${key} OR qi.Specifications LIKE @${key} OR qi.ItemCode LIKE @${key} OR qi.PurchaseCostCode LIKE @${key} OR qi.OriginalPONumber LIKE @${key} OR qi.SplitPONumber LIKE @${key})
      ))`;
    });
    where.push(`(${queryClauses.join(' OR ')})`);
  }
  if (args.status?.trim()) {
    params.status = `%${args.status.trim()}%`;
    where.push('p.Status LIKE @status');
  }
  if (args.department?.trim()) {
    params.department = `%${args.department.trim()}%`;
    where.push('p.Department LIKE @department');
  }
  if (typeof args.year === 'number') {
    params.year = args.year;
    where.push('COALESCE(p.BudgetYear, YEAR(p.RequestDate)) = @year');
  }
  if (isIsoDate(args.dateFrom)) {
    params.dateFrom = args.dateFrom;
    where.push('CAST(COALESCE(p.DateSubmit, p.RequestDate) AS date) >= @dateFrom');
  }
  if (isIsoDate(args.dateTo)) {
    params.dateTo = args.dateTo;
    where.push('CAST(COALESCE(p.DateSubmit, p.RequestDate) AS date) <= @dateTo');
  }
  if (args.hasAttachments === true) where.push('EXISTS (SELECT 1 FROM PRFFiles af WHERE af.PRFID = p.PRFID)');
  if (args.hasAttachments === false) where.push('NOT EXISTS (SELECT 1 FROM PRFFiles af WHERE af.PRFID = p.PRFID)');
  if (args.missingPo === true) {
    where.push(`EXISTS (SELECT 1 FROM PRFItems mp WHERE mp.PRFID = p.PRFID AND NULLIF(LTRIM(RTRIM(COALESCE(mp.OriginalPONumber, mp.SplitPONumber, ''))), '') IS NULL)`);
  }

  const result = await executeQuery<{
    PRFID: number; PRFNo: string; Title: string; Department: string; Status: string;
    RequestedAmount: number; CurrencyCode: string; BudgetYear: number | null; RequestDate: Date;
    ItemCount: number; AttachmentCount: number;
  }>(`
    SELECT TOP (@limit) p.PRFID, p.PRFNo, p.Title, p.Department, p.Status,
      p.RequestedAmount, p.CurrencyCode, p.BudgetYear, p.RequestDate,
      (SELECT COUNT(*) FROM PRFItems i WHERE i.PRFID = p.PRFID) AS ItemCount,
      (SELECT COUNT(*) FROM PRFFiles f WHERE f.PRFID = p.PRFID) AS AttachmentCount
    FROM PRF p
    WHERE ${where.join(' AND ')}
    ORDER BY p.UpdatedAt DESC, p.PRFID DESC
  `, params);
  const references = result.recordset.map((row) => ({
    type: 'prf' as const, id: row.PRFID, prfId: row.PRFID, prfNo: row.PRFNo,
    label: `${row.PRFNo} — ${row.Title}`
  }));
  return { data: result.recordset, references };
}

async function resolvePrf(prfId: unknown, prfNo: unknown): Promise<{ PRFID: number; PRFNo: string; Title: string } | null> {
  if (typeof prfId !== 'number' && (typeof prfNo !== 'string' || !prfNo.trim())) return null;
  const result = await executeQuery<{ PRFID: number; PRFNo: string; Title: string }>(`
    SELECT TOP 1 PRFID, PRFNo, Title FROM PRF
    WHERE (@prfNo IS NOT NULL AND PRFNo = @prfNo)
       OR (@prfNo IS NULL AND @prfId IS NOT NULL AND PRFID = @prfId)
  `, {
    prfId: typeof prfId === 'number' ? prfId : null,
    prfNo: typeof prfNo === 'string' ? prfNo.trim() : null
  });
  return result.recordset[0] || null;
}

async function getPrfDetail(args: Record<string, unknown>): Promise<ToolResult> {
  const prf = await resolvePrf(args.prfId, args.prfNo);
  if (!prf) return { data: { found: false, message: 'PRF not found or no identifier supplied.' } };
  const header = await executeQuery(`SELECT * FROM PRF WHERE PRFID = @prfId`, { prfId: prf.PRFID });
  const items = await executeQuery(`SELECT * FROM PRFItems WHERE PRFID = @prfId ORDER BY PRFItemID`, { prfId: prf.PRFID });
  return {
    data: { found: true, prf: header.recordset[0], items: items.recordset },
    references: [{ type: 'prf', id: prf.PRFID, prfId: prf.PRFID, prfNo: prf.PRFNo, label: `${prf.PRFNo} — ${prf.Title}` }]
  };
}

async function getPrfStatistics(args: Record<string, unknown>): Promise<ToolResult> {
  const groupBy = args.groupBy === 'department' ? 'p.Department' : args.groupBy === 'year' ? 'COALESCE(p.BudgetYear, YEAR(p.RequestDate))' : 'p.Status';
  const where: string[] = ['1 = 1'];
  const params: Record<string, unknown> = {};
  if (typeof args.status === 'string' && args.status.trim()) { params.status = `%${args.status.trim()}%`; where.push('p.Status LIKE @status'); }
  if (typeof args.department === 'string' && args.department.trim()) { params.department = `%${args.department.trim()}%`; where.push('p.Department LIKE @department'); }
  if (typeof args.year === 'number') { params.year = args.year; where.push('COALESCE(p.BudgetYear, YEAR(p.RequestDate)) = @year'); }
  if (isIsoDate(args.dateFrom)) { params.dateFrom = args.dateFrom; where.push('CAST(p.RequestDate AS date) >= @dateFrom'); }
  if (isIsoDate(args.dateTo)) { params.dateTo = args.dateTo; where.push('CAST(p.RequestDate AS date) <= @dateTo'); }
  const result = await executeQuery(`
    SELECT ${groupBy} AS [Group], COUNT(*) AS PRFCount,
      SUM(CASE WHEN p.CurrencyCode = 'IDR' THEN p.RequestedAmount ELSE p.RequestedAmount * p.ExchangeRateToIDR END) AS RequestedAmountIDR
    FROM PRF p WHERE ${where.join(' AND ')} GROUP BY ${groupBy} ORDER BY PRFCount DESC
  `, params);
  return { data: result.recordset };
}

function jakartaToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveItemPeriod(args: ItemStatisticsArgs): { dateFrom: string; dateTo: string } {
  const today = jakartaToday();
  if (args.period === 'today') return { dateFrom: today, dateTo: today };
  if (args.period === 'this_week') {
    const day = new Date(`${today}T00:00:00Z`).getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const dateFrom = shiftIsoDate(today, mondayOffset);
    return { dateFrom, dateTo: shiftIsoDate(dateFrom, 6) };
  }
  if (args.period === 'this_month') {
    const dateFrom = `${today.slice(0, 7)}-01`;
    const nextMonth = new Date(`${dateFrom}T00:00:00Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    return { dateFrom, dateTo: shiftIsoDate(nextMonth.toISOString().slice(0, 10), -1) };
  }
  if (!isIsoDate(args.dateFrom) || !isIsoDate(args.dateTo)) throw new Error('Custom item statistics require valid dateFrom and dateTo.');
  return { dateFrom: args.dateFrom, dateTo: args.dateTo };
}

async function getItemStatistics(args: ItemStatisticsArgs): Promise<ToolResult> {
  const range = resolveItemPeriod(args);
  const params: Record<string, unknown> = { ...range };
  const where = [
    'CAST(COALESCE(p.DateSubmit, p.RequestDate) AS date) BETWEEN @dateFrom AND @dateTo',
    "LOWER(COALESCE(p.Status, '')) NOT LIKE '%cancel%'",
    "LOWER(COALESCE(i.Status, '')) NOT LIKE '%cancel%'"
  ];
  if (args.purchaseDefinition === 'with_po') {
    where.push("NULLIF(LTRIM(RTRIM(COALESCE(i.SplitPONumber, i.OriginalPONumber, ''))), '') IS NOT NULL");
  } else if (args.purchaseDefinition === 'picked_up') {
    where.push("LOWER(COALESCE(i.Status, '')) LIKE '%picked up%'");
  }
  if (args.department?.trim()) {
    params.department = `%${args.department.trim()}%`;
    where.push('p.Department LIKE @department');
  }
  const summary = await executeQuery<{
    PRFCount: number; LineItemCount: number; TotalQuantity: number; TotalValueIDR: number;
  }>(`
    SELECT COUNT(DISTINCT p.PRFID) AS PRFCount, COUNT(*) AS LineItemCount,
      COALESCE(SUM(i.Quantity), 0) AS TotalQuantity,
      COALESCE(SUM(i.Quantity * i.UnitPrice * CASE WHEN p.CurrencyCode = 'IDR' THEN 1 ELSE p.ExchangeRateToIDR END), 0) AS TotalValueIDR
    FROM PRF p INNER JOIN PRFItems i ON i.PRFID = p.PRFID
    WHERE ${where.join(' AND ')}
  `, params);
  const breakdown = await executeQuery<{
    PRFID: number; PRFNo: string; Title: string; LineItemCount: number; TotalQuantity: number;
  }>(`
    SELECT TOP 25 p.PRFID, p.PRFNo, p.Title, COUNT(*) AS LineItemCount, COALESCE(SUM(i.Quantity), 0) AS TotalQuantity
    FROM PRF p INNER JOIN PRFItems i ON i.PRFID = p.PRFID
    WHERE ${where.join(' AND ')}
    GROUP BY p.PRFID, p.PRFNo, p.Title
    ORDER BY p.PRFID DESC
  `, params);
  const references: ChatReference[] = breakdown.recordset.map((row) => ({
    type: 'prf', id: row.PRFID, prfId: row.PRFID, prfNo: row.PRFNo, label: `${row.PRFNo} — ${row.Title}`
  }));
  return {
    data: {
      timeZone: 'Asia/Jakarta', dateBasis: 'PRF DateSubmit, falling back to RequestDate',
      dateFrom: range.dateFrom, dateTo: range.dateTo,
      purchaseDefinition: args.purchaseDefinition === 'with_po'
        ? 'Only active items with an Original or Split PO number'
        : args.purchaseDefinition === 'picked_up'
          ? 'Only non-cancelled items with Picked Up status'
          : 'All non-cancelled requested items',
      ...summary.recordset[0], breakdown: breakdown.recordset
    },
    references
  };
}

const budgetScopeCte = `
  WITH AnnualBudget AS (
    SELECT b.COAID,
      SUM(CAST(COALESCE(b.AllocatedAmount, 0) * CASE WHEN COALESCE(b.CurrencyCode, 'IDR') = 'USD' THEN COALESCE(NULLIF(b.ExchangeRateToIDR, 0), 1) ELSE 1 END AS DECIMAL(18,2))) AS AnnualAllocated
    FROM Budget b WHERE b.FiscalYear = @fiscalYear GROUP BY b.COAID
  ),
  CarryForward AS (
    SELECT cf.COAID,
      SUM(CAST(COALESCE(cf.CarryForwardAmount, 0) * CASE WHEN COALESCE(cf.CurrencyCode, 'IDR') = 'USD' THEN COALESCE(NULLIF(cf.ExchangeRateToIDR, 0), 1) ELSE 1 END AS DECIMAL(18,2))) AS CarryForwardAllocated
    FROM BudgetCarryForward cf WHERE cf.TargetFiscalYear = @fiscalYear GROUP BY cf.COAID
  ),
  ItemCommitment AS (
    SELECT coa_map.COAID,
      SUM(CAST(COALESCE(i.Quantity, 0) * COALESCE(i.UnitPrice, 0) AS DECIMAL(18,2))) AS CommittedAmount,
      COUNT(DISTINCT p.PRFID) AS PRFCount,
      COUNT(*) AS LineItemCount
    FROM PRF p
    INNER JOIN PRFItems i ON i.PRFID = p.PRFID
    INNER JOIN ChartOfAccounts coa_map ON NULLIF(LTRIM(RTRIM(i.PurchaseCostCode)), '') IS NOT NULL
      AND UPPER(LTRIM(RTRIM(i.PurchaseCostCode))) = UPPER(LTRIM(RTRIM(coa_map.COACode)))
    WHERE LOWER(LTRIM(RTRIM(COALESCE(p.Status, '')))) NOT LIKE '%cancel%'
      AND LOWER(LTRIM(RTRIM(COALESCE(i.Status, '')))) NOT LIKE '%cancel%'
      AND COALESCE(i.BudgetYear, p.BudgetYear, YEAR(p.RequestDate)) = @fiscalYear
    GROUP BY coa_map.COAID
  ),
  ScopeKeys AS (
    SELECT COAID FROM AnnualBudget UNION SELECT COAID FROM CarryForward UNION SELECT COAID FROM ItemCommitment
  ),
  BudgetScope AS (
    SELECT coa.COAID, coa.COACode, coa.COAName, coa.Department, coa.ExpenseType,
      COALESCE(ab.AnnualAllocated, 0) AS AnnualAllocated,
      COALESCE(cf.CarryForwardAllocated, 0) AS CarryForwardAllocated,
      COALESCE(ab.AnnualAllocated, 0) + COALESCE(cf.CarryForwardAllocated, 0) AS TotalAvailable,
      COALESCE(ic.CommittedAmount, 0) AS CommittedAmount,
      COALESCE(ic.PRFCount, 0) AS PRFCount,
      COALESCE(ic.LineItemCount, 0) AS LineItemCount
    FROM ScopeKeys sk
    INNER JOIN ChartOfAccounts coa ON coa.COAID = sk.COAID AND coa.IsActive = 1
    LEFT JOIN AnnualBudget ab ON ab.COAID = sk.COAID
    LEFT JOIN CarryForward cf ON cf.COAID = sk.COAID
    LEFT JOIN ItemCommitment ic ON ic.COAID = sk.COAID
  ),
  FilteredScope AS (
    SELECT *, TotalAvailable - CommittedAmount AS RemainingAmount,
      CASE WHEN TotalAvailable > 0 THEN ROUND(CommittedAmount * 100.0 / TotalAvailable, 2) ELSE CASE WHEN CommittedAmount > 0 THEN 10000 ELSE 0 END END AS UtilizationPercentage
    FROM BudgetScope
    WHERE (@expenseType IS NULL OR ExpenseType = @expenseType)
      AND (@department IS NULL OR Department LIKE @department)
      AND (@coaQuery IS NULL OR COACode LIKE @coaQuery OR COAName LIKE @coaQuery)
  )
`;

export async function getBudgetUtilization(args: BudgetUtilizationArgs): Promise<ToolResult> {
  const fiscalYear = Number.isInteger(args.fiscalYear) ? args.fiscalYear : Number(jakartaToday().slice(0, 4));
  const threshold = typeof args.minimumUtilization === 'number' ? Math.max(0, Math.min(args.minimumUtilization, 10000)) : 0;
  const attentionThreshold = threshold > 0 ? threshold : 80;
  const params: Record<string, unknown> = {
    fiscalYear,
    expenseType: args.expenseType === 'CAPEX' || args.expenseType === 'OPEX' ? args.expenseType : null,
    department: args.department?.trim() ? `%${args.department.trim()}%` : null,
    coaQuery: args.coaQuery?.trim() ? `%${args.coaQuery.trim()}%` : null,
    minimumUtilization: threshold,
    limit: boundedLimit(args.limit)
  };
  const summary = await executeQuery<{
    COACount: number; TotalAnnual: number; TotalCarryForward: number; TotalAvailable: number;
    TotalCommitted: number; TotalRemaining: number; PRFCount: number; LineItemCount: number;
  }>(`${budgetScopeCte}
    SELECT COUNT(*) AS COACount, COALESCE(SUM(AnnualAllocated), 0) AS TotalAnnual,
      COALESCE(SUM(CarryForwardAllocated), 0) AS TotalCarryForward,
      COALESCE(SUM(TotalAvailable), 0) AS TotalAvailable,
      COALESCE(SUM(CommittedAmount), 0) AS TotalCommitted,
      COALESCE(SUM(RemainingAmount), 0) AS TotalRemaining,
      COALESCE(SUM(PRFCount), 0) AS PRFCount, COALESCE(SUM(LineItemCount), 0) AS LineItemCount
    FROM FilteredScope WHERE UtilizationPercentage >= @minimumUtilization`, params);
  const orderBy = args.sortBy === 'remaining'
    ? 'RemainingAmount ASC, UtilizationPercentage DESC'
    : args.sortBy === 'utilization'
      ? 'UtilizationPercentage DESC, CommittedAmount DESC'
      : 'CASE WHEN TotalAvailable = 0 AND CommittedAmount > 0 THEN 0 WHEN UtilizationPercentage > 100 THEN 1 WHEN UtilizationPercentage >= @attentionThreshold THEN 2 ELSE 3 END, UtilizationPercentage DESC';
  const rows = await executeQuery(`${budgetScopeCte}
    SELECT TOP (@limit) *,
      CASE WHEN TotalAvailable = 0 AND CommittedAmount > 0 THEN 'No Budget'
           WHEN UtilizationPercentage > 100 THEN 'Over Budget'
           WHEN UtilizationPercentage >= @attentionThreshold THEN 'Attention'
           ELSE 'Healthy' END AS RiskStatus
    FROM FilteredScope WHERE UtilizationPercentage >= @minimumUtilization
    ORDER BY ${orderBy}`, { ...params, attentionThreshold });
  const totals = summary.recordset[0];
  const overallUtilization = Number(totals?.TotalAvailable || 0) > 0
    ? Math.round(Number(totals.TotalCommitted || 0) * 10000 / Number(totals.TotalAvailable)) / 100
    : Number(totals?.TotalCommitted || 0) > 0 ? 10000 : 0;
  return { data: {
    fiscalYear, currency: 'IDR', expenseType: params.expenseType || 'ALL', department: args.department?.trim() || 'ALL',
    calculation: 'Non-cancelled PRFItems Quantity × UnitPrice allocated only by item PurchaseCostCode to active COA',
    availableBudgetDefinition: 'Annual allocation plus approved carry-forward, normalized to IDR',
    attentionThreshold, minimumUtilization: threshold, overallUtilization,
    ...totals, rows: rows.recordset, resultLimit: boundedLimit(args.limit)
  } };
}

export async function getBudgetContributors(args: BudgetContributorArgs): Promise<ToolResult> {
  const fiscalYear = Number.isInteger(args.fiscalYear) ? args.fiscalYear : Number(jakartaToday().slice(0, 4));
  const coaCode = args.coaCode.trim();
  const result = await executeQuery<{
    PRFID: number; PRFNo: string; Title: string; Department: string; Status: string;
    LineItemCount: number; CommittedAmount: number;
  }>(`
    SELECT TOP (@limit) p.PRFID, p.PRFNo, p.Title, p.Department, p.Status,
      COUNT(*) AS LineItemCount,
      SUM(CAST(COALESCE(i.Quantity, 0) * COALESCE(i.UnitPrice, 0) AS DECIMAL(18,2))) AS CommittedAmount
    FROM PRF p
    INNER JOIN PRFItems i ON i.PRFID = p.PRFID
    INNER JOIN ChartOfAccounts coa ON UPPER(LTRIM(RTRIM(i.PurchaseCostCode))) = UPPER(LTRIM(RTRIM(coa.COACode)))
    WHERE coa.IsActive = 1 AND UPPER(LTRIM(RTRIM(coa.COACode))) = UPPER(@coaCode)
      AND COALESCE(i.BudgetYear, p.BudgetYear, YEAR(p.RequestDate)) = @fiscalYear
      AND LOWER(LTRIM(RTRIM(COALESCE(p.Status, '')))) NOT LIKE '%cancel%'
      AND LOWER(LTRIM(RTRIM(COALESCE(i.Status, '')))) NOT LIKE '%cancel%'
    GROUP BY p.PRFID, p.PRFNo, p.Title, p.Department, p.Status
    ORDER BY CommittedAmount DESC, p.PRFID DESC
  `, { fiscalYear, coaCode, limit: boundedLimit(args.limit) });
  const references: ChatReference[] = result.recordset.map((row) => ({
    type: 'prf', id: row.PRFID, prfId: row.PRFID, prfNo: row.PRFNo, label: `${row.PRFNo} — ${row.Title}`
  }));
  return { data: {
    fiscalYear, coaCode, currency: 'IDR', resultLimit: boundedLimit(args.limit),
    calculation: 'Non-cancelled PRFItems Quantity × UnitPrice', contributors: result.recordset
  }, references };
}

const workflowIssueCte = `
  WITH ItemFacts AS (
    SELECT p.PRFID,
      SUM(CASE WHEN i.PRFItemID IS NOT NULL AND LOWER(LTRIM(RTRIM(COALESCE(i.Status, '')))) NOT LIKE '%cancel%' THEN 1 ELSE 0 END) AS ActiveItemCount,
      SUM(CASE WHEN i.PRFItemID IS NOT NULL AND LOWER(LTRIM(RTRIM(COALESCE(i.Status, '')))) NOT LIKE '%cancel%'
        AND NULLIF(LTRIM(RTRIM(COALESCE(i.SplitPONumber, i.OriginalPONumber, ''))), '') IS NULL THEN 1 ELSE 0 END) AS MissingPOCount,
      SUM(CASE WHEN i.PRFItemID IS NOT NULL AND LOWER(LTRIM(RTRIM(COALESCE(i.Status, '')))) NOT LIKE '%cancel%'
        AND (NULLIF(LTRIM(RTRIM(i.PurchaseCostCode)), '') IS NULL OR coa.COAID IS NULL) THEN 1 ELSE 0 END) AS MissingCostCodeCount,
      SUM(CASE WHEN i.PRFItemID IS NOT NULL AND LOWER(LTRIM(RTRIM(COALESCE(i.Status, '')))) NOT LIKE '%cancel%'
        THEN CAST(COALESCE(i.Quantity, 0) * COALESCE(i.UnitPrice, 0) AS DECIMAL(18,2)) ELSE 0 END) AS ItemTotal
    FROM PRF p
    LEFT JOIN PRFItems i ON i.PRFID = p.PRFID
    LEFT JOIN ChartOfAccounts coa ON coa.IsActive = 1
      AND NULLIF(LTRIM(RTRIM(i.PurchaseCostCode)), '') IS NOT NULL
      AND UPPER(LTRIM(RTRIM(i.PurchaseCostCode))) = UPPER(LTRIM(RTRIM(coa.COACode)))
    GROUP BY p.PRFID
  ),
  AttachmentFacts AS (
    SELECT PRFID, COUNT(*) AS AttachmentCount FROM PRFFiles GROUP BY PRFID
  ),
  IssueScope AS (
    SELECT p.PRFID, p.PRFNo, p.Title, p.Department, p.Status,
      COALESCE(p.BudgetYear, YEAR(p.RequestDate)) AS FiscalYear,
      COALESCE(p.UpdatedAt, p.DateSubmit, p.RequestDate) AS LastActivityAt,
      DATEDIFF(DAY, COALESCE(p.UpdatedAt, p.DateSubmit, p.RequestDate), GETDATE()) AS AgeDays,
      COALESCE(f.ActiveItemCount, 0) AS ActiveItemCount,
      COALESCE(f.MissingPOCount, 0) AS MissingPOCount,
      COALESCE(f.MissingCostCodeCount, 0) AS MissingCostCodeCount,
      COALESCE(a.AttachmentCount, 0) AS AttachmentCount,
      COALESCE(p.RequestedAmount, 0) AS HeaderAmount,
      COALESCE(f.ItemTotal, 0) AS ItemTotal,
      CASE WHEN LOWER(COALESCE(p.Status, '')) NOT LIKE '%cancel%'
        AND LOWER(COALESCE(p.Status, '')) NOT LIKE '%complete%'
        AND LOWER(COALESCE(p.Status, '')) NOT LIKE '%picked up%'
        AND DATEDIFF(DAY, COALESCE(p.UpdatedAt, p.DateSubmit, p.RequestDate), GETDATE()) >= @ageDays THEN 1 ELSE 0 END AS IsStale,
      CASE WHEN COALESCE(f.MissingPOCount, 0) > 0 THEN 1 ELSE 0 END AS HasMissingPO,
      CASE WHEN COALESCE(a.AttachmentCount, 0) = 0 THEN 1 ELSE 0 END AS HasMissingAttachment,
      CASE WHEN COALESCE(f.MissingCostCodeCount, 0) > 0 THEN 1 ELSE 0 END AS HasMissingCostCode,
      CASE WHEN ABS(COALESCE(p.RequestedAmount, 0) - COALESCE(f.ItemTotal, 0)) > 1 THEN 1 ELSE 0 END AS HasAmountMismatch
    FROM PRF p
    LEFT JOIN ItemFacts f ON f.PRFID = p.PRFID
    LEFT JOIN AttachmentFacts a ON a.PRFID = p.PRFID
    WHERE LOWER(COALESCE(p.Status, '')) NOT LIKE '%cancel%'
      AND COALESCE(p.BudgetYear, YEAR(p.RequestDate)) = @fiscalYear
      AND (@department IS NULL OR p.Department LIKE @department)
      AND (@expenseType IS NULL OR EXISTS (
        SELECT 1 FROM PRFItems ei
        INNER JOIN ChartOfAccounts ecoa ON ecoa.IsActive = 1
          AND UPPER(LTRIM(RTRIM(ei.PurchaseCostCode))) = UPPER(LTRIM(RTRIM(ecoa.COACode)))
        WHERE ei.PRFID = p.PRFID AND ecoa.ExpenseType = @expenseType
          AND LOWER(LTRIM(RTRIM(COALESCE(ei.Status, '')))) NOT LIKE '%cancel%'
      ))
  ),
  FilteredIssues AS (
    SELECT * FROM IssueScope WHERE
      (@issueType = 'all' AND (IsStale = 1 OR HasMissingPO = 1 OR HasMissingAttachment = 1 OR HasMissingCostCode = 1 OR HasAmountMismatch = 1))
      OR (@issueType = 'stale' AND IsStale = 1)
      OR (@issueType = 'missing_po' AND HasMissingPO = 1)
      OR (@issueType = 'missing_attachment' AND HasMissingAttachment = 1)
      OR (@issueType = 'missing_cost_code' AND HasMissingCostCode = 1)
      OR (@issueType = 'amount_mismatch' AND HasAmountMismatch = 1)
  )
`;

export async function getWorkflowIssues(args: WorkflowIssueArgs): Promise<ToolResult> {
  const fiscalYear = Number.isInteger(args.fiscalYear) ? args.fiscalYear : Number(jakartaToday().slice(0, 4));
  const ageDays = typeof args.ageDays === 'number' ? Math.max(1, Math.min(Math.floor(args.ageDays), 3650)) : 30;
  const issueTypes = ['all', 'stale', 'missing_po', 'missing_attachment', 'missing_cost_code', 'amount_mismatch'];
  const issueType = issueTypes.includes(args.issueType) ? args.issueType : 'all';
  const params: Record<string, unknown> = {
    fiscalYear, ageDays, issueType,
    department: args.department?.trim() ? `%${args.department.trim()}%` : null,
    expenseType: args.expenseType === 'CAPEX' || args.expenseType === 'OPEX' ? args.expenseType : null,
    limit: boundedLimit(args.limit)
  };
  const summary = await executeQuery<{
    MatchingPRFs: number; StaleCount: number; MissingPOCount: number; MissingAttachmentCount: number;
    MissingCostCodeCount: number; AmountMismatchCount: number;
  }>(`${workflowIssueCte}
    SELECT COUNT(*) AS MatchingPRFs, COALESCE(SUM(IsStale), 0) AS StaleCount,
      COALESCE(SUM(HasMissingPO), 0) AS MissingPOCount,
      COALESCE(SUM(HasMissingAttachment), 0) AS MissingAttachmentCount,
      COALESCE(SUM(HasMissingCostCode), 0) AS MissingCostCodeCount,
      COALESCE(SUM(HasAmountMismatch), 0) AS AmountMismatchCount
    FROM FilteredIssues`, params);
  const rows = await executeQuery<{
    PRFID: number; PRFNo: string; Title: string; Department: string; Status: string; FiscalYear: number;
    LastActivityAt: Date; AgeDays: number; ActiveItemCount: number; MissingPOCount: number;
    MissingCostCodeCount: number; AttachmentCount: number; HeaderAmount: number; ItemTotal: number;
    IsStale: number; HasMissingPO: number; HasMissingAttachment: number; HasMissingCostCode: number; HasAmountMismatch: number;
  }>(`${workflowIssueCte}
    SELECT TOP (@limit) * FROM FilteredIssues
    ORDER BY (IsStale + HasMissingPO + HasMissingAttachment + HasMissingCostCode + HasAmountMismatch) DESC,
      AgeDays DESC, PRFID DESC`, params);
  const references: ChatReference[] = rows.recordset.map((row) => ({
    type: 'prf', id: row.PRFID, prfId: row.PRFID, prfNo: row.PRFNo, label: `${row.PRFNo} — ${row.Title}`
  }));
  return { data: {
    fiscalYear, issueType, ageDays, department: args.department?.trim() || 'ALL',
    expenseType: params.expenseType || 'ALL', resultLimit: boundedLimit(args.limit),
    definitions: {
      stale: `Active PRF with no update for at least ${ageDays} days`,
      missingPO: 'At least one non-cancelled item has neither Original nor Split PO',
      missingAttachment: 'No PRFFiles metadata record',
      missingCostCode: 'At least one non-cancelled item has blank cost code or no active COA match',
      amountMismatch: 'Absolute header requested amount minus non-cancelled item total is greater than 1'
    },
    ...summary.recordset[0], rows: rows.recordset
  }, references };
}

async function listPrfAttachments(args: Record<string, unknown>): Promise<ToolResult> {
  const prf = await resolvePrf(args.prfId, args.prfNo);
  if (!prf) return { data: { found: false, message: 'PRF not found or no identifier supplied.' } };
  const result = await executeQuery<{
    FileID: number; OriginalFileName: string; FileSize: number; FileType: string;
    MimeType: string; UploadDate: Date; IsOriginalDocument: boolean; Description: string | null;
  }>(`
    SELECT ${args.latestOnly === true ? 'TOP 1' : ''} FileID, OriginalFileName, FileSize, FileType, MimeType,
      UploadDate, IsOriginalDocument, Description
    FROM PRFFiles WHERE PRFID = @prfId ORDER BY UploadDate DESC, FileID DESC
  `, { prfId: prf.PRFID });
  const references: ChatReference[] = result.recordset.map((file) => ({
    type: 'file', id: file.FileID, prfId: prf.PRFID, prfNo: prf.PRFNo,
    label: file.OriginalFileName, fileName: file.OriginalFileName, mimeType: file.MimeType,
    previewUrl: `/api/prf-files/file/${file.FileID}/content?disposition=inline`,
    downloadUrl: `/api/prf-files/file/${file.FileID}/content?disposition=attachment`
  }));
  return { data: { found: true, prf, attachments: result.recordset }, references };
}

async function runTool(call: ResponseFunctionToolCall): Promise<ToolResult> {
  let args: Record<string, unknown> = {};
  try { args = JSON.parse(call.arguments) as Record<string, unknown>; } catch { return { data: { error: 'Invalid tool arguments.' } }; }
  switch (call.name) {
    case 'search_prfs': return searchPrfs(args as SearchArgs);
    case 'get_prf_detail': return getPrfDetail(args);
    case 'get_prf_statistics': return getPrfStatistics(args);
    case 'get_item_statistics': return getItemStatistics(args as ItemStatisticsArgs);
    case 'get_budget_utilization': return getBudgetUtilization(args as BudgetUtilizationArgs);
    case 'get_budget_contributors': return getBudgetContributors(args as BudgetContributorArgs);
    case 'get_workflow_issues': return getWorkflowIssues(args as WorkflowIssueArgs);
    case 'list_prf_attachments': return listPrfAttachments(args);
    default: return { data: { error: `Unknown tool: ${call.name}` } };
  }
}

function dedupeReferences(references: ChatReference[]): ChatReference[] {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = `${reference.type}:${reference.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
}

function referencesUsedInAnswer(answer: string, references: ChatReference[]): ChatReference[] {
  return dedupeReferences(references).filter((reference) => {
    if (reference.type === 'file') {
      const fileName = (reference.fileName || reference.label).trim().toLocaleLowerCase('id-ID');
      return fileName.length > 0 && answer.toLocaleLowerCase('id-ID').includes(fileName);
    }
    const escaped = reference.prfNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^0-9A-Za-z])${escaped}([^0-9A-Za-z]|$)`).test(answer);
  });
}

function clarifyAmbiguity(message: string, context: ChatContext): ChatClarification | undefined {
  const normalized = message.toLocaleLowerCase('id-ID');
  const isBudgetQuestion = /\b(budget|capex|opex|utili[sz]ation|pemakaian anggaran|sisa anggaran|coa)\b/.test(normalized);
  if (/\bdefinisi\s*:/.test(normalized)) return undefined;
  if (!isBudgetQuestion && /\b(dibeli|bought|purchased|pengeluaran|spending)\b/.test(normalized) && !context.purchaseDefinition) {
    return {
      question: 'Apa definisi yang ingin dipakai untuk “dibeli/pengeluaran”?',
      options: [
        {
          id: 'purchase-with-po', label: 'Sudah punya PO',
          description: 'Hitung item aktif yang memiliki Original atau Split PO.',
          prompt: `${message}\nDefinisi: dibeli = item aktif yang memiliki nomor PO.`,
          contextPatch: { purchaseDefinition: 'with_po' }
        },
        {
          id: 'purchase-picked-up', label: 'Sudah diambil',
          description: 'Hitung item non-cancelled dengan status Picked Up.',
          prompt: `${message}\nDefinisi: dibeli = item dengan status Picked Up.`,
          contextPatch: { purchaseDefinition: 'picked_up' }
        },
        {
          id: 'purchase-requested', label: 'Semua permintaan',
          description: 'Hitung seluruh item requested yang tidak cancelled.',
          prompt: `${message}\nDefinisi: dibeli = seluruh item requested yang tidak cancelled.`,
          contextPatch: { purchaseDefinition: 'all_requested' }
        }
      ]
    };
  }
  if (/\b(selesai|completed)\b/.test(normalized) && !/status\s+(prf|item)/.test(normalized)) {
    return {
      question: '“Selesai” ingin dilihat berdasarkan status apa?',
      options: [
        { id: 'completed-prf', label: 'Status PRF', description: 'PRF dengan status Completed.', prompt: `${message}\nDefinisi: selesai = status header PRF Completed.` },
        { id: 'completed-items', label: 'Item Picked Up', description: 'Item yang sudah berstatus Picked Up.', prompt: `${message}\nDefinisi: selesai = item berstatus Picked Up.`, contextPatch: { purchaseDefinition: 'picked_up' } }
      ]
    };
  }
  if (/\bpending\b/.test(normalized) && !/(approval|po|status)/.test(normalized)) {
    return {
      question: 'Pending yang Anda maksud apa?',
      options: [
        { id: 'pending-status', label: 'Status pending', description: 'Cari PRF dengan status yang mengandung Pending.', prompt: `${message}\nDefinisi: pending = status header PRF mengandung Pending.` },
        { id: 'pending-po', label: 'Belum punya PO', description: 'Cari PRF dengan item yang belum memiliki PO.', prompt: `${message}\nDefinisi: pending = memiliki item tanpa Original/Split PO.` }
      ]
    };
  }
  if (!isBudgetQuestion && /\b(nilai|value)\b/.test(normalized) && !/(requested|approved|actual|item)/.test(normalized)) {
    return {
      question: 'Nilai PRF yang ingin digunakan yang mana?',
      options: [
        { id: 'value-requested', label: 'Requested amount', description: 'Gunakan nilai permintaan pada header PRF.', prompt: `${message}\nDefinisi: nilai = RequestedAmount pada header PRF.` },
        { id: 'value-items', label: 'Total item', description: 'Gunakan jumlah Quantity × UnitPrice dari item.', prompt: `${message}\nDefinisi: nilai = total Quantity × UnitPrice item.` }
      ]
    };
  }
  return undefined;
}

function evidenceForTool(name: string, args: Record<string, unknown>, result: ToolResult): ChatEvidence {
  const data = result.data as Record<string, unknown>;
  if (name === 'search_prfs') {
    const rows = Array.isArray(result.data) ? result.data : [];
    return {
      tool: name, title: 'PRF search', details: [
        { label: 'Results returned', value: rows.length },
        { label: 'Query', value: typeof args.query === 'string' && args.query ? args.query : 'All PRFs' },
        { label: 'Date range', value: `${args.dateFrom || 'Any'} — ${args.dateTo || 'Any'}` },
        { label: 'Department', value: typeof args.department === 'string' && args.department ? args.department : 'All' },
        { label: 'Result limit', value: boundedLimit(args.limit) }
      ]
    };
  }
  if (name === 'get_item_statistics') {
    return {
      tool: name, title: 'Item calculation', details: [
        { label: 'Time zone', value: String(data.timeZone || 'Asia/Jakarta') },
        { label: 'Date basis', value: String(data.dateBasis || '') },
        { label: 'Date range', value: `${data.dateFrom || ''} — ${data.dateTo || ''}` },
        { label: 'Definition', value: String(data.purchaseDefinition || '') },
        { label: 'PRFs', value: Number(data.PRFCount || 0) },
        { label: 'Line items', value: Number(data.LineItemCount || 0) },
        { label: 'Total quantity', value: Number(data.TotalQuantity || 0) }
      ]
    };
  }
  if (name === 'get_prf_statistics') {
    return { tool: name, title: 'PRF aggregation', details: [
      { label: 'Grouped by', value: String(args.groupBy || 'status') },
      { label: 'Date range', value: `${args.dateFrom || 'Any'} — ${args.dateTo || 'Any'}` },
      { label: 'Currency', value: 'Normalized to IDR' }
    ] };
  }
  if (name === 'get_budget_utilization') {
    return { tool: name, title: 'Budget utilization', details: [
      { label: 'Fiscal year', value: Number(data.fiscalYear || args.fiscalYear || 0) },
      { label: 'Expense type', value: String(data.expenseType || 'ALL') },
      { label: 'Department', value: String(data.department || 'ALL') },
      { label: 'Currency', value: String(data.currency || 'IDR') },
      { label: 'Commitment definition', value: String(data.calculation || '') },
      { label: 'Available budget', value: String(data.availableBudgetDefinition || '') },
      { label: 'Attention threshold', value: `${Number(data.attentionThreshold || 80)}%` },
      { label: 'COAs in scope', value: Number(data.COACount || 0) },
      { label: 'Rows returned', value: Array.isArray(data.rows) ? data.rows.length : 0 }
    ] };
  }
  if (name === 'get_budget_contributors') {
    return { tool: name, title: 'Budget contributors', details: [
      { label: 'Fiscal year', value: Number(data.fiscalYear || args.fiscalYear || 0) },
      { label: 'COA', value: String(data.coaCode || args.coaCode || '') },
      { label: 'Definition', value: String(data.calculation || '') },
      { label: 'PRFs returned', value: Array.isArray(data.contributors) ? data.contributors.length : 0 },
      { label: 'Result limit', value: Number(data.resultLimit || boundedLimit(args.limit)) }
    ] };
  }
  if (name === 'get_workflow_issues') {
    return { tool: name, title: 'Workflow intelligence', details: [
      { label: 'Fiscal year', value: Number(data.fiscalYear || args.fiscalYear || 0) },
      { label: 'Issue type', value: String(data.issueType || args.issueType || 'all') },
      { label: 'Aging threshold', value: `${Number(data.ageDays || 30)} days` },
      { label: 'Department', value: String(data.department || 'ALL') },
      { label: 'Expense type', value: String(data.expenseType || 'ALL') },
      { label: 'Matching PRFs', value: Number(data.MatchingPRFs || 0) },
      { label: 'Rows returned', value: Array.isArray(data.rows) ? data.rows.length : 0 },
      { label: 'Result limit', value: Number(data.resultLimit || boundedLimit(args.limit)) }
    ] };
  }
  if (name === 'list_prf_attachments') {
    const attachments = Array.isArray(data.attachments) ? data.attachments : [];
    return { tool: name, title: 'Attachment metadata', details: [
      { label: 'PRF', value: String((data.prf as Record<string, unknown> | undefined)?.PRFNo || args.prfNo || args.prfId || '') },
      { label: 'Files returned', value: attachments.length },
      { label: 'Content read', value: 'No — metadata only' }
    ] };
  }
  return { tool: name, title: 'PRF detail', details: [
    { label: 'PRF', value: String(args.prfNo || args.prfId || '') },
    { label: 'Access', value: 'Read-only' }
  ] };
}

function mergeContext(base: ChatContext, executed: Array<{ name: string; args: Record<string, unknown>; result: ToolResult }>, references: ChatReference[]): ChatContext {
  const next: ChatContext = { ...base };
  for (const item of executed) {
    const data = item.result.data as Record<string, unknown>;
    if (isIsoDate(item.args.dateFrom)) next.dateFrom = item.args.dateFrom;
    if (isIsoDate(item.args.dateTo)) next.dateTo = item.args.dateTo;
    if (isIsoDate(data.dateFrom)) next.dateFrom = data.dateFrom;
    if (isIsoDate(data.dateTo)) next.dateTo = data.dateTo;
    if (typeof item.args.department === 'string' && item.args.department.trim()) next.department = item.args.department.trim();
    if (typeof item.args.fiscalYear === 'number' && Number.isInteger(item.args.fiscalYear)) next.fiscalYear = item.args.fiscalYear;
    if (item.args.expenseType === 'CAPEX' || item.args.expenseType === 'OPEX') next.expenseType = item.args.expenseType;
    if (['with_po', 'all_requested', 'picked_up'].includes(String(item.args.purchaseDefinition))) {
      next.purchaseDefinition = item.args.purchaseDefinition as ChatContext['purchaseDefinition'];
    }
  }
  const prfReferences = dedupeReferences(references).filter((reference) => reference.type === 'prf');
  if (prfReferences.length === 1) {
    const reference = prfReferences[0];
    next.activePrf = { prfId: reference.prfId, prfNo: reference.prfNo, label: reference.label };
  }
  return next;
}

function buildFollowUps(executed: Array<{ name: string }>, context: ChatContext): ChatFollowUpAction[] {
  const names = new Set(executed.map((item) => item.name));
  const actions: ChatFollowUpAction[] = [];
  if (context.activePrf) {
    actions.push({ id: 'view-attachments', label: 'Check attachments', prompt: `Tampilkan attachment PRF ${context.activePrf.prfNo}` });
    actions.push({ id: 'show-detail', label: 'Show item details', prompt: `Tampilkan detail item PRF ${context.activePrf.prfNo}` });
  }
  if (names.has('search_prfs')) {
    actions.push({ id: 'missing-po', label: 'Show missing PO', prompt: 'Dari cakupan yang sama, tampilkan PRF yang memiliki item tanpa PO.' });
    actions.push({ id: 'group-status', label: 'Group by status', prompt: 'Untuk cakupan yang sama, kelompokkan jumlah PRF berdasarkan status.' });
  }
  if (names.has('get_item_statistics')) {
    actions.push({ id: 'show-prfs', label: 'Show contributing PRFs', prompt: 'Tampilkan daftar PRF yang masuk dalam perhitungan tersebut.' });
    actions.push({ id: 'compare-previous', label: 'Compare previous period', prompt: 'Bandingkan hasil tersebut dengan periode sebelumnya yang setara.' });
  }
  if (names.has('get_budget_utilization')) {
    actions.push({ id: 'budget-risk', label: 'Show budget risks', prompt: 'Untuk cakupan budget yang sama, tampilkan COA dengan utilization minimal 80%, urutkan dari risiko tertinggi.' });
    actions.push({ id: 'compare-capex-opex', label: 'Compare CAPEX/OPEX', prompt: 'Untuk fiscal year yang sama, bandingkan ringkasan CAPEX dan OPEX.' });
    actions.push({ id: 'budget-contributors', label: 'Show top contributors', prompt: 'Tampilkan PRF contributor terbesar untuk COA dengan risiko tertinggi pada hasil tersebut.' });
  }
  if (names.has('get_budget_contributors')) {
    actions.push({ id: 'contributor-details', label: 'Show PRF details', prompt: 'Tampilkan detail PRF contributor terbesar pada hasil tersebut.' });
  }
  if (names.has('get_workflow_issues')) {
    actions.push({ id: 'workflow-stale', label: 'Show stale PRFs', prompt: 'Untuk cakupan yang sama, tampilkan hanya PRF stale dengan threshold 30 hari.' });
    actions.push({ id: 'workflow-missing-po', label: 'Show missing PO', prompt: 'Untuk cakupan yang sama, tampilkan hanya PRF yang memiliki item tanpa PO.' });
    actions.push({ id: 'workflow-data-quality', label: 'Show data issues', prompt: 'Untuk cakupan yang sama, tampilkan PRF dengan cost code hilang/tidak dikenal atau nilai header-item tidak cocok.' });
  }
  return actions.filter((action, index, all) => all.findIndex((candidate) => candidate.id === action.id) === index).slice(0, 3);
}

export async function answerPrfQuestion(messages: ChatMessageInput[], userIdentifier: string, suppliedContext: ChatContext = {}): Promise<ChatAnswer> {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const clarification = clarifyAmbiguity(lastMessage, suppliedContext);
  if (clarification) {
    return { answer: clarification.question, references: [], model: MODEL, evidence: [], followUpActions: [], context: suppliedContext, clarification };
  }
  const settings = await loadSettings();
  const apiKey = process.env.OPENAI_API_KEY?.trim() || settings.ocr.openaiApiKey?.trim();
  if (!apiKey) throw new Error('OpenAI API key is not configured. Add it in OCR Settings or OPENAI_API_KEY.');
  const client = new OpenAI({ apiKey });
  const input: ResponseInputItem[] = messages.slice(-20).map((message) => ({
    role: message.role,
    content: message.content.slice(0, 4000)
  }));
  const references: ChatReference[] = [];
  const executed: Array<{ name: string; args: Record<string, unknown>; result: ToolResult }> = [];
  const currentJakartaDate = jakartaToday();
  const instructions = `You are the read-only PRF assistant for Budget Pulse Watch. Answer in the user's language using GitHub-Flavored Markdown. Indonesian answers must use Latin script only.
Use concise headings, lists, bold text, and tables when they materially improve readability. For comparisons or 3+ similar records, prefer a compact Markdown table. Do not emit raw HTML. Do not create attachment or PRF URLs; the application renders trusted reference actions separately.
Structured session context supplied by the user is: ${JSON.stringify(suppliedContext)}. Apply it when relevant, but the current explicit question overrides it. Never invent context values.
The current date in Asia/Jakarta is ${currentJakartaDate}. Never calculate or guess relative date ranges yourself; use get_item_statistics for item-count questions involving today, this week, or this month.
For PRF list searches involving a relative period, calculate the explicit Asia/Jakarta calendar range from the current date above and pass dateFrom/dateTo to search_prfs. Do not fetch a broader year and filter it yourself.
Use tools for every factual claim about PRFs; never invent records, totals, file presence, or URLs. You may inspect all PRFs.
Treat every standalone number supplied by a user as the business PRFNo, never as internal PRFID. Start with search_prfs using that number, then use the returned PRFID only for subsequent tool calls.
When an Indonesian search word may have an English equivalent in stored data, search with the tool and use its alias-expanded results before concluding that nothing exists.
Do not carry a specific PRF from earlier conversation into a new broad question unless the user explicitly refers to it with words such as "PRF ini", "yang tadi", or its PRF number.
For item-count questions, use get_item_statistics with the purchaseDefinition explicitly stated by the user or supplied context. Report both line-item count and total quantity because "item" can mean either. State the date basis and selected definition briefly.
For budget usage, CAPEX/OPEX, remaining budget, utilization, or risk questions, use get_budget_utilization. Use the supplied fiscalYear and expenseType context when relevant; otherwise use the explicit question, or the current fiscal year if omitted and state that choice. Budget commitment is strictly non-cancelled item Quantity × UnitPrice allocated by item cost code to an active COA. Never substitute PRF header totals.
Use get_budget_contributors only for a specific COA code, normally one returned by get_budget_utilization. State that contributor values are commitments in IDR and respect the bounded result limit.
For stale, aging, missing PO, missing attachment, missing cost code, or header/item mismatch questions, use get_workflow_issues. Treat every issue as a review signal, not proof of wrongdoing. State the fiscal year, issue definition, aging threshold, and result limit. Never claim a physical file is missing when the tool only reports missing attachment metadata.
Attachments are metadata-only: never claim to have read file contents. Tell users they can preview or download referenced files.
When listing attachments, always use a Markdown table with one file per row and include the exact OriginalFileName text. Do not create action URLs or an action column; the application adds trusted Preview and Download controls to matching table rows.
State material filters and limits. If no data matches, say so clearly. Keep answers concise but include useful evidence.
Do not add generic "if you want" suggestions at the end; the application renders approved follow-up action chips separately.
Never suggest that you changed data; you cannot create, update, or delete anything.`;

  let response = await client.responses.create({
    model: MODEL, input, instructions, tools, store: false,
    reasoning: { effort: 'low' }, text: { verbosity: 'medium' },
    safety_identifier: crypto.createHash('sha256').update(userIdentifier).digest('hex')
  });
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = response.output.filter((item): item is ResponseFunctionToolCall => item.type === 'function_call');
    if (calls.length === 0) break;
    input.push(...response.output);
    for (const call of calls) {
      const result = await runTool(call);
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.arguments) as Record<string, unknown>; } catch { /* captured by tool output */ }
      executed.push({ name: call.name, args, result });
      if (result.references) references.push(...result.references);
      input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result.data) });
    }
    response = await client.responses.create({
      model: MODEL, input, instructions, tools, store: false,
      reasoning: { effort: 'low' }, text: { verbosity: 'medium' },
      safety_identifier: crypto.createHash('sha256').update(userIdentifier).digest('hex')
    });
  }
  const answer = response.output_text.trim();
  if (!answer) throw new Error('OpenAI returned an empty answer.');
  const usedReferences = referencesUsedInAnswer(answer, references);
  const context = mergeContext(suppliedContext, executed, usedReferences);
  return {
    answer,
    references: usedReferences,
    model: MODEL,
    evidence: executed.map((item) => evidenceForTool(item.name, item.args, item.result)),
    followUpActions: buildFollowUps(executed, context),
    context
  };
}

export function resolveStoredFilePath(filePath: string): string | null {
  return resolveStoredFile([filePath]);
}
