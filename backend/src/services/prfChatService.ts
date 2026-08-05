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
    if (reference.type === 'file') return true;
    const escaped = reference.prfNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^0-9A-Za-z])${escaped}([^0-9A-Za-z]|$)`).test(answer);
  });
}

function clarifyAmbiguity(message: string, context: ChatContext): ChatClarification | undefined {
  const normalized = message.toLocaleLowerCase('id-ID');
  if (/\bdefinisi\s*:/.test(normalized)) return undefined;
  if (/\b(dibeli|bought|purchased|pengeluaran|spending)\b/.test(normalized) && !context.purchaseDefinition) {
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
  if (/\b(nilai|value)\b/.test(normalized) && !/(requested|approved|actual|item)/.test(normalized)) {
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
Attachments are metadata-only: never claim to have read file contents. Tell users they can preview or download referenced files.
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
