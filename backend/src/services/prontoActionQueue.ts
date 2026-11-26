import sql from 'mssql';
import { executeQuery, getPool } from '../config/database';

/**
 * Pronto Immediate Action queue (PO M094, "Approve/Review Requisitions (Immediate Action Req'd)").
 *
 * The Pronto worker reads the queue every hour (backend/scripts/pronto_action_queue.py) and posts a
 * snapshot. POMON keeps only the requisitions that belong to its PRFs: the order number is a PRF
 * number, or a split PO number recorded on a PRF item. Each one is classified as:
 * - rejected: the latest dated Approval Status entry is a rejection (e.g. "Rejected", "Rejected PO");
 * - it_action: Next Action By lists the Pronto account that read the queue (MTI IT, itmt);
 * - waiting_other: anything else.
 */

export interface QueueNextActionBy {
  name: string;
  user: string;
  hierarchy: string;
}

export interface QueueApprovalEntry {
  lineNo: number;
  approvalUser: string;
  actionAt: string | null;
  actionAtRaw: string | null;
  status: string;
  comment: string | null;
}

export interface QueueRowInput {
  orderNo: string;
  supplier: string | null;
  warehouse: string | null;
  dueDate: string | null;
  requestUser: string | null;
  costCategory: string | null;
  reqTotal: number | null;
  currency: string | null;
  localValue: number | null;
  auth: string | null;
  group: string | null;
  buyer: string | null;
  stockGroup: string | null;
  priority: string | null;
  nextActionBy: QueueNextActionBy[];
  approvals: QueueApprovalEntry[];
  errors: string[];
}

export interface QueueSnapshotInput {
  checkedAt: Date;
  prontoUser: string | null;
  error: string | null;
  /** null: the read failed before the list was read; keep the stored rows. */
  rows: QueueRowInput[] | null;
}

export type QueueCategory = 'rejected' | 'it_action' | 'waiting_other';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string };

const MAX_ROWS = 500;
const MAX_LIST = 300;
const DEFAULT_IT_USER = 'itmt';

const str = (value: unknown, max: number): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).trim();
  return s.length === 0 ? null : s.slice(0, max);
};

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const isoDate = (value: unknown): string | null => {
  const s = str(value, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const wallClock = (value: unknown): string | null => {
  const s = str(value, 19);
  return s && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s) ? s : null;
};

/** Validates the body of POST /api/pronto-queue/snapshot. */
export const validateQueueSnapshot = (body: unknown): ValidationResult<QueueSnapshotInput> => {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Body must be an object' };
  const raw = body as Record<string, unknown>;
  const checkedAt = raw.checkedAt ? new Date(String(raw.checkedAt)) : new Date();
  if (Number.isNaN(checkedAt.getTime())) return { ok: false, message: 'checkedAt must be an ISO date-time' };
  const error = str(raw.error, 1000);
  if (raw.rows === null || raw.rows === undefined) {
    if (!error) return { ok: false, message: 'rows is required unless error is set' };
    return { ok: true, value: { checkedAt, prontoUser: str(raw.prontoUser, 50), error, rows: null } };
  }
  if (!Array.isArray(raw.rows)) return { ok: false, message: 'rows must be an array or null' };
  if (raw.rows.length > MAX_ROWS) return { ok: false, message: `rows must not exceed ${MAX_ROWS}` };

  const rows: QueueRowInput[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.rows.length; i += 1) {
    const r = raw.rows[i];
    if (!r || typeof r !== 'object') return { ok: false, message: `rows[${i}] must be an object` };
    const row = r as Record<string, unknown>;
    const orderNo = str(row.orderNo, 20);
    if (!orderNo || !/^\d+$/.test(orderNo)) return { ok: false, message: `rows[${i}].orderNo must be a numeric string` };
    if (seen.has(orderNo)) return { ok: false, message: `rows[${i}].orderNo is duplicated` };
    seen.add(orderNo);
    const nextRaw = Array.isArray(row.nextActionBy) ? row.nextActionBy.slice(0, MAX_LIST) : [];
    const apprRaw = Array.isArray(row.approvals) ? row.approvals.slice(0, MAX_LIST) : [];
    rows.push({
      orderNo,
      supplier: str(row.supplier, 50),
      warehouse: str(row.warehouse, 20),
      dueDate: isoDate(row.dueDate),
      requestUser: str(row.requestUser, 50),
      costCategory: str(row.costCategory, 50),
      reqTotal: num(row.reqTotal),
      currency: str(row.currency, 10),
      localValue: num(row.localValue),
      auth: str(row.auth, 10),
      group: str(row.group, 50),
      buyer: str(row.buyer, 100),
      stockGroup: str(row.stockGroup, 100),
      priority: str(row.priority, 10),
      nextActionBy: nextRaw
        .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
        .map((e) => ({ name: str(e.name, 200) ?? '', user: str(e.user, 100) ?? '', hierarchy: str(e.hierarchy, 100) ?? '' }))
        .filter((e) => e.name || e.user),
      approvals: apprRaw
        .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
        .map((e, idx) => ({
          lineNo: typeof e.line_no === 'number' ? e.line_no : typeof e.lineNo === 'number' ? e.lineNo : idx + 1,
          approvalUser: str(e.approval_user ?? e.approvalUser, 200) ?? '',
          actionAt: wallClock(e.action_at ?? e.actionAt),
          actionAtRaw: str(e.action_at_raw ?? e.actionAtRaw, 40),
          status: str(e.status, 100) ?? '',
          comment: str(e.comment, 1000),
        }))
        .filter((e) => e.approvalUser || e.status || e.actionAt),
      errors: Array.isArray(row.errors) ? row.errors.map((e) => String(e).slice(0, 200)).slice(0, 10) : [],
    });
  }
  return { ok: true, value: { checkedAt, prontoUser: str(raw.prontoUser, 50), error, rows } };
};

/** The latest dated Approval Status entry (Pronto lists pending approvers without a date). */
export const latestApprovalAction = (approvals: QueueApprovalEntry[]): QueueApprovalEntry | null => {
  let latest: QueueApprovalEntry | null = null;
  for (const e of approvals) {
    if (!e.actionAt) continue;
    if (!latest || e.actionAt > (latest.actionAt as string) || (e.actionAt === latest.actionAt && e.lineNo > latest.lineNo)) {
      latest = e;
    }
  }
  return latest;
};

export const classifyQueueItem = (
  item: { approvals: QueueApprovalEntry[]; nextActionBy: QueueNextActionBy[] },
  prontoUser: string | null
): QueueCategory => {
  const latest = latestApprovalAction(item.approvals);
  if (latest && /reject/i.test(latest.status)) return 'rejected';
  const itUser = (prontoUser || DEFAULT_IT_USER).toLowerCase();
  if (item.nextActionBy.some((e) => e.user.toLowerCase() === itUser)) return 'it_action';
  return 'waiting_other';
};

/** Stores a snapshot: run status always, rows only when the queue was read. */
export const saveQueueSnapshot = async (snapshot: QueueSnapshotInput): Promise<number | null> => {
  const transaction = new sql.Transaction(getPool());
  await transaction.begin();
  try {
    const success = snapshot.rows !== null;
    await new sql.Request(transaction)
      .input('CheckedAt', sql.DateTime2, snapshot.checkedAt)
      .input('User', sql.NVarChar(50), snapshot.prontoUser)
      .input('Error', sql.NVarChar(1000), snapshot.error)
      .input('Success', sql.Bit, success ? 1 : 0)
      .query(
        `UPDATE dbo.AppSettings
            SET ProntoQueueCheckedAt = @CheckedAt,
                ProntoQueueError = @Error,
                ProntoQueueUser = CASE WHEN @Success = 1 THEN COALESCE(@User, ProntoQueueUser) ELSE ProntoQueueUser END,
                ProntoQueueLastSuccessAt = CASE WHEN @Success = 1 THEN @CheckedAt ELSE ProntoQueueLastSuccessAt END`
      );
    if (snapshot.rows) {
      await new sql.Request(transaction).query('DELETE FROM dbo.ProntoActionQueue');
      for (const r of snapshot.rows) {
        await new sql.Request(transaction)
          .input('OrderNo', sql.NVarChar(20), r.orderNo)
          .input('Supplier', sql.NVarChar(50), r.supplier)
          .input('Warehouse', sql.NVarChar(20), r.warehouse)
          .input('DueDate', sql.Date, r.dueDate)
          .input('RequestUser', sql.NVarChar(50), r.requestUser)
          .input('CostCategory', sql.NVarChar(50), r.costCategory)
          .input('ReqTotal', sql.Decimal(18, 2), r.reqTotal)
          .input('Currency', sql.NVarChar(10), r.currency)
          .input('LocalValue', sql.Decimal(18, 2), r.localValue)
          .input('Auth', sql.NVarChar(10), r.auth)
          .input('ActionGroup', sql.NVarChar(50), r.group)
          .input('Buyer', sql.NVarChar(100), r.buyer)
          .input('StockGroup', sql.NVarChar(100), r.stockGroup)
          .input('Priority', sql.NVarChar(10), r.priority)
          .input('NextActionByJson', sql.NVarChar(sql.MAX), JSON.stringify(r.nextActionBy))
          .input('ApprovalsJson', sql.NVarChar(sql.MAX), JSON.stringify(r.approvals))
          .input('ReadErrors', sql.NVarChar(1000), r.errors.length ? r.errors.join('; ').slice(0, 1000) : null)
          .input('CheckedAt', sql.DateTime2, snapshot.checkedAt)
          .query(
            `INSERT INTO dbo.ProntoActionQueue
               (OrderNo, Supplier, Warehouse, DueDate, RequestUser, CostCategory, ReqTotal, Currency, LocalValue,
                Auth, ActionGroup, Buyer, StockGroup, Priority, NextActionByJson, ApprovalsJson, ReadErrors, CheckedAt)
             VALUES (@OrderNo, @Supplier, @Warehouse, @DueDate, @RequestUser, @CostCategory, @ReqTotal, @Currency, @LocalValue,
                @Auth, @ActionGroup, @Buyer, @StockGroup, @Priority, @NextActionByJson, @ApprovalsJson, @ReadErrors, @CheckedAt)`
          );
      }
    }
    await transaction.commit();
    return snapshot.rows ? snapshot.rows.length : null;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {
      /* keep the original error */
    }
    throw error;
  }
};

interface QueueDbRow {
  OrderNo: string;
  Supplier: string | null;
  Warehouse: string | null;
  DueDate: Date | null;
  RequestUser: string | null;
  CostCategory: string | null;
  ReqTotal: number | null;
  Currency: string | null;
  LocalValue: number | null;
  Auth: string | null;
  ActionGroup: string | null;
  Buyer: string | null;
  StockGroup: string | null;
  Priority: string | null;
  NextActionByJson: string;
  ApprovalsJson: string;
  ReadErrors: string | null;
  CheckedAt: Date;
}

interface QueueMatchRow {
  OrderNo: string;
  PRFID: number;
  PRFNo: string;
  IsSplit: number;
}

interface QueueStatusRow {
  ProntoQueueCheckedAt: Date | null;
  ProntoQueueLastSuccessAt: Date | null;
  ProntoQueueUser: string | null;
  ProntoQueueError: string | null;
}

const parseJsonArray = <T>(raw: string | null): T[] => {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
};

export interface QueueItemView {
  orderNo: string;
  prfId: number | null;
  prfNo: string | null;
  isSplit: boolean;
  category: QueueCategory;
  supplier: string | null;
  warehouse: string | null;
  dueDate: string | null;
  requestUser: string | null;
  costCategory: string | null;
  reqTotal: number | null;
  currency: string | null;
  localValue: number | null;
  auth: string | null;
  group: string | null;
  buyer: string | null;
  stockGroup: string | null;
  priority: string | null;
  latestAction: QueueApprovalEntry | null;
  nextActionBy: QueueNextActionBy[];
  approvals: QueueApprovalEntry[];
  readErrors: string | null;
  checkedAt: string;
}

/** Joins stored queue rows to POMON PRFs; a direct PRF number match wins over a split PO match. */
export const matchQueueRows = (rows: QueueDbRow[], matches: QueueMatchRow[], prontoUser: string | null) => {
  const byOrder = new Map<string, QueueMatchRow>();
  for (const m of matches) {
    const current = byOrder.get(m.OrderNo);
    if (!current || (current.IsSplit && !m.IsSplit)) byOrder.set(m.OrderNo, m);
  }
  const items: QueueItemView[] = [];
  const unmatched: QueueItemView[] = [];
  for (const r of rows) {
    const approvals = parseJsonArray<QueueApprovalEntry>(r.ApprovalsJson);
    const nextActionBy = parseJsonArray<QueueNextActionBy>(r.NextActionByJson);
    const match = byOrder.get(r.OrderNo);
    const view: QueueItemView = {
      orderNo: r.OrderNo,
      prfId: match ? match.PRFID : null,
      prfNo: match ? match.PRFNo : null,
      isSplit: match ? !!match.IsSplit : false,
      category: classifyQueueItem({ approvals, nextActionBy }, prontoUser),
      supplier: r.Supplier,
      warehouse: r.Warehouse,
      dueDate: r.DueDate ? r.DueDate.toISOString().slice(0, 10) : null,
      requestUser: r.RequestUser,
      costCategory: r.CostCategory,
      reqTotal: r.ReqTotal === null ? null : Number(r.ReqTotal),
      currency: r.Currency,
      localValue: r.LocalValue === null ? null : Number(r.LocalValue),
      auth: r.Auth,
      group: r.ActionGroup,
      buyer: r.Buyer,
      stockGroup: r.StockGroup,
      priority: r.Priority,
      latestAction: latestApprovalAction(approvals),
      nextActionBy,
      approvals,
      readErrors: r.ReadErrors,
      checkedAt: r.CheckedAt.toISOString(),
    };
    (match ? items : unmatched).push(view);
  }
  const order: Record<QueueCategory, number> = { rejected: 0, it_action: 1, waiting_other: 2 };
  items.sort((a, b) => order[a.category] - order[b.category] || a.orderNo.localeCompare(b.orderNo));
  unmatched.sort((a, b) => a.orderNo.localeCompare(b.orderNo));
  const counts = {
    total: items.length,
    rejected: items.filter((i) => i.category === 'rejected').length,
    itAction: items.filter((i) => i.category === 'it_action').length,
    waitingOther: items.filter((i) => i.category === 'waiting_other').length,
  };
  return { items, unmatched, counts };
};

export const loadQueue = async () => {
  const [rowsResult, matchResult, statusResult] = await Promise.all([
    executeQuery<QueueDbRow>(
      `SELECT OrderNo, Supplier, Warehouse, DueDate, RequestUser, CostCategory, ReqTotal, Currency, LocalValue, Auth,
              ActionGroup, Buyer, StockGroup, Priority, NextActionByJson, ApprovalsJson, ReadErrors, CheckedAt
         FROM dbo.ProntoActionQueue`
    ),
    executeQuery<QueueMatchRow>(
      `SELECT q.OrderNo, p.PRFID, p.PRFNo, 0 AS IsSplit
         FROM dbo.ProntoActionQueue q
         JOIN dbo.PRF p ON LTRIM(RTRIM(p.PRFNo)) = q.OrderNo
       UNION
       SELECT DISTINCT q.OrderNo, p.PRFID, p.PRFNo, 1 AS IsSplit
         FROM dbo.ProntoActionQueue q
         JOIN dbo.PRFItems i ON LTRIM(RTRIM(i.SplitPONumber)) = q.OrderNo
         JOIN dbo.PRF p ON p.PRFID = i.PRFID`
    ),
    executeQuery<QueueStatusRow>(
      `SELECT TOP 1 ProntoQueueCheckedAt, ProntoQueueLastSuccessAt, ProntoQueueUser, ProntoQueueError
         FROM dbo.AppSettings ORDER BY SettingsID`
    ),
  ]);
  const status = statusResult.recordset[0];
  const prontoUser = status?.ProntoQueueUser ?? null;
  const { items, unmatched, counts } = matchQueueRows(rowsResult.recordset, matchResult.recordset, prontoUser);
  return {
    checkedAt: status?.ProntoQueueCheckedAt ? status.ProntoQueueCheckedAt.toISOString() : null,
    lastSuccessAt: status?.ProntoQueueLastSuccessAt ? status.ProntoQueueLastSuccessAt.toISOString() : null,
    prontoUser,
    error: status?.ProntoQueueError ?? null,
    counts,
    items,
    unmatched,
  };
};
