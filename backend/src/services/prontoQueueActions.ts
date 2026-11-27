import { executeQuery } from '../config/database';
import { loadQueue } from './prontoActionQueue';

/**
 * Requests to acknowledge a requisition for approval in Pronto (Phase 30).
 *
 * A POMON user (admin or doccon) asks for "Acknowledge for approval" on a requisition that the
 * Immediate Action page shows as needing IT action. The request is stored here; the Pronto worker
 * claims pending requests one at a time and runs pronto_action_queue.py --acknowledge, which checks
 * Pronto again before it clicks anything and reports the outcome.
 *
 * Statuses: pending -> running -> done | skipped | failed | unverified.
 * - skipped: a check in Pronto said no (no longer waiting for IT, rejected, already acknowledged).
 * - failed: stopped before the menu click; nothing was changed in Pronto.
 * - unverified: the menu item was clicked, but the new Acknowledge entry could not be confirmed.
 */

export type ActionStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed' | 'unverified';
export const FINAL_STATUSES: ActionStatus[] = ['done', 'skipped', 'failed', 'unverified'];
const OPEN_STATUSES: ActionStatus[] = ['pending', 'running'];
/** A request still "running" after this long lost its worker (the step timeout is 15 minutes). */
export const STALE_RUNNING_MINUTES = 30;

export interface ActionRequestRow {
  RequestID: number;
  OrderNo: string;
  Action: string;
  PRFID: number | null;
  RequestedByUserID: number | null;
  RequestedByName: string | null;
  RequestedAt: Date;
  Status: ActionStatus;
  Message: string | null;
  StartedAt: Date | null;
  FinishedAt: Date | null;
}

export interface ActionRequestView {
  id: number;
  orderNo: string;
  action: string;
  prfId: number | null;
  requestedBy: string | null;
  requestedAt: string;
  status: ActionStatus;
  message: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export const toActionView = (r: ActionRequestRow): ActionRequestView => ({
  id: r.RequestID,
  orderNo: r.OrderNo,
  action: r.Action,
  prfId: r.PRFID,
  requestedBy: r.RequestedByName,
  requestedAt: r.RequestedAt.toISOString(),
  status: r.Status,
  message: r.Message,
  startedAt: r.StartedAt ? r.StartedAt.toISOString() : null,
  finishedAt: r.FinishedAt ? r.FinishedAt.toISOString() : null,
});

export type RequestCheck =
  | { ok: true; prfId: number | null }
  | { ok: false; status: number; message: string };

/**
 * Whether an acknowledge may be requested for `orderNo`, from the stored queue and open requests.
 * The worker checks Pronto again before acting; this only stops requests that cannot be right.
 */
export const checkAcknowledgeRequest = (
  orderNo: string,
  queue: { items: Array<{ orderNo: string; category: string; prfId: number | null }> },
  openRequests: Array<{ OrderNo: string; Status: ActionStatus }>
): RequestCheck => {
  if (!/^\d+$/.test(orderNo)) return { ok: false, status: 400, message: 'orderNo must be numeric' };
  const item = queue.items.find((i) => i.orderNo === orderNo);
  if (!item) {
    return { ok: false, status: 404, message: `${orderNo} is not in the Immediate Action queue for POMON PRFs` };
  }
  if (item.category !== 'it_action') {
    return {
      ok: false,
      status: 409,
      message: `${orderNo} is not waiting for IT (${item.category === 'rejected' ? 'it was rejected' : 'Next Action By is someone else'})`,
    };
  }
  if (openRequests.some((r) => r.OrderNo === orderNo && OPEN_STATUSES.includes(r.Status))) {
    return { ok: false, status: 409, message: `An acknowledge for ${orderNo} is already queued` };
  }
  return { ok: true, prfId: item.prfId };
};

const SELECT_COLUMNS = `RequestID, OrderNo, Action, PRFID, RequestedByUserID, RequestedByName, RequestedAt, Status,
  Message, StartedAt, FinishedAt`;

const writeAudit = async (requestId: number, action: 'INSERT' | 'UPDATE', userId: number | null, values: object) => {
  // AuditLog.ChangedBy references Users; LDAP users and the worker may not have a row there, so
  // the request table stays the main record and a failed audit insert is only logged.
  if (!userId || userId < 1) return;
  try {
    await executeQuery(
      `INSERT INTO AuditLog (TableName, RecordID, Action, OldValues, NewValues, ChangedBy)
       VALUES ('ProntoQueueActionRequest', @RecordID, @Action, NULL, @NewValues, @ChangedBy)`,
      { RecordID: requestId, Action: action, NewValues: JSON.stringify(values), ChangedBy: userId }
    );
  } catch (error) {
    console.warn('Audit log entry for a Pronto acknowledge request was not written:', (error as Error).message);
  }
};

export const listOpenRequests = async (): Promise<Array<{ OrderNo: string; Status: ActionStatus }>> => {
  const result = await executeQuery<{ OrderNo: string; Status: ActionStatus }>(
    `SELECT OrderNo, Status FROM dbo.ProntoQueueActionRequest WHERE Status IN ('pending', 'running')`
  );
  return result.recordset;
};

export const createAcknowledgeRequest = async (
  orderNo: string,
  user: { UserID?: number; FirstName?: string; LastName?: string; Username?: string }
): Promise<{ ok: true; request: ActionRequestView } | { ok: false; status: number; message: string }> => {
  const [queue, open] = await Promise.all([loadQueue(), listOpenRequests()]);
  const check = checkAcknowledgeRequest(orderNo, queue, open);
  if (!check.ok) return check;
  const name = [user.FirstName, user.LastName].filter(Boolean).join(' ').trim() || user.Username || null;
  const result = await executeQuery<ActionRequestRow>(
    `INSERT INTO dbo.ProntoQueueActionRequest (OrderNo, Action, PRFID, RequestedByUserID, RequestedByName, RequestedAt, Status)
     OUTPUT inserted.RequestID, inserted.OrderNo, inserted.Action, inserted.PRFID, inserted.RequestedByUserID,
            inserted.RequestedByName, inserted.RequestedAt, inserted.Status, inserted.Message, inserted.StartedAt,
            inserted.FinishedAt
     VALUES (@OrderNo, 'acknowledge', @PRFID, @UserID, @Name, @Now, 'pending')`,
    { OrderNo: orderNo, PRFID: check.prfId, UserID: user.UserID ?? null, Name: name, Now: new Date() }
  );
  const row = result.recordset[0];
  await writeAudit(row.RequestID, 'INSERT', user.UserID ?? null, {
    action: 'acknowledge for approval (Pronto)',
    orderNo,
    prfId: check.prfId,
    requestedBy: name,
    status: 'pending',
  });
  return { ok: true, request: toActionView(row) };
};

/** Gives the worker the oldest pending request (marked running), after expiring lost runs. */
export const claimNextRequest = async (): Promise<ActionRequestView | null> => {
  const now = new Date();
  await executeQuery(
    `UPDATE dbo.ProntoQueueActionRequest
        SET Status = 'unverified', FinishedAt = @Now,
            Message = 'The worker stopped while running this request; check the requisition in Pronto.'
      WHERE Status = 'running' AND StartedAt < @StaleBefore`,
    { Now: now, StaleBefore: new Date(now.getTime() - STALE_RUNNING_MINUTES * 60 * 1000) }
  );
  const result = await executeQuery<ActionRequestRow>(
    `WITH next AS (
       SELECT TOP 1 * FROM dbo.ProntoQueueActionRequest WITH (UPDLOCK, READPAST, ROWLOCK)
        WHERE Status = 'pending'
        ORDER BY RequestedAt, RequestID
     )
     UPDATE next SET Status = 'running', StartedAt = @Now
     OUTPUT inserted.RequestID, inserted.OrderNo, inserted.Action, inserted.PRFID, inserted.RequestedByUserID,
            inserted.RequestedByName, inserted.RequestedAt, inserted.Status, inserted.Message, inserted.StartedAt,
            inserted.FinishedAt`,
    { Now: now }
  );
  const row = result.recordset[0];
  return row ? toActionView(row) : null;
};

export const validateActionResult = (
  body: unknown
): { ok: true; status: ActionStatus; message: string } | { ok: false; message: string } => {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Body must be an object' };
  const raw = body as Record<string, unknown>;
  const status = typeof raw.status === 'string' ? (raw.status.trim() as ActionStatus) : null;
  if (!status || !FINAL_STATUSES.includes(status)) {
    return { ok: false, message: `status must be one of ${FINAL_STATUSES.join(', ')}` };
  }
  const message = typeof raw.message === 'string' ? raw.message.trim().slice(0, 1000) : '';
  return { ok: true, status, message };
};

/** Records the outcome of a running request; a request that is not running is left as it is. */
export const finishRequest = async (
  requestId: number,
  status: ActionStatus,
  message: string,
  auditUserId: number | null
): Promise<ActionRequestView | null> => {
  const result = await executeQuery<ActionRequestRow>(
    `UPDATE dbo.ProntoQueueActionRequest
        SET Status = @Status, Message = @Message, FinishedAt = @Now
     OUTPUT inserted.RequestID, inserted.OrderNo, inserted.Action, inserted.PRFID, inserted.RequestedByUserID,
            inserted.RequestedByName, inserted.RequestedAt, inserted.Status, inserted.Message, inserted.StartedAt,
            inserted.FinishedAt
      WHERE RequestID = @RequestID AND Status = 'running'`,
    { RequestID: requestId, Status: status, Message: message || null, Now: new Date() }
  );
  const row = result.recordset[0];
  if (!row) return null;
  await writeAudit(row.RequestID, 'UPDATE', auditUserId ?? row.RequestedByUserID, {
    action: 'acknowledge for approval (Pronto)',
    orderNo: row.OrderNo,
    status,
    message,
  });
  return toActionView(row);
};

/** Recent requests for the Immediate Action page (newest first). */
export const listRecentRequests = async (days = 14, limit = 50): Promise<ActionRequestView[]> => {
  const result = await executeQuery<ActionRequestRow>(
    `SELECT TOP (@Limit) ${SELECT_COLUMNS}
       FROM dbo.ProntoQueueActionRequest
      WHERE RequestedAt >= @Since
      ORDER BY RequestedAt DESC, RequestID DESC`,
    { Limit: limit, Since: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
  );
  return result.recordset.map(toActionView);
};
