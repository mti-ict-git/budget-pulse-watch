import sql from 'mssql';
import { executeQuery, getPool } from '../config/database';

export interface ProntoApprovalEntryInput {
  entrySeq: number;
  approvalUser: string;
  actionAt: Date | null;
  actionAtRaw: string | null;
  status: string;
  comment: string | null;
}

export interface ProntoApprovalPayload {
  poNumber: string;
  entries: ProntoApprovalEntryInput[];
}

export interface ProntoApprovalHistoryRow {
  HistoryID: number;
  PRFID: number;
  PONumber: string;
  EntrySeq: number;
  ApprovalUser: string;
  ActionAt: Date | null;
  ActionAtRaw: string | null;
  Status: string;
  Comment: string | null;
  SyncedAt: Date;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string };

const MAX_ENTRIES = 200;

const trimmedString = (value: unknown, max: number): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s.length === 0 ? null : s.slice(0, max);
};

/** Validates the body sent by the Pronto worker for PUT /api/prfs/:id/pronto-approvals. */
export const validateProntoApprovalPayload = (body: unknown): ValidationResult<ProntoApprovalPayload> => {
  if (!body || typeof body !== 'object') return { ok: false, message: 'Body must be an object' };
  const raw = body as Record<string, unknown>;
  const poNumber = trimmedString(raw.poNumber, 20);
  if (!poNumber || !/^\d+$/.test(poNumber)) return { ok: false, message: 'poNumber must be a numeric string' };
  if (!Array.isArray(raw.entries)) return { ok: false, message: 'entries must be an array' };
  if (raw.entries.length > MAX_ENTRIES) return { ok: false, message: `entries must not exceed ${MAX_ENTRIES}` };

  const entries: ProntoApprovalEntryInput[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < raw.entries.length; i += 1) {
    const e = raw.entries[i];
    if (!e || typeof e !== 'object') return { ok: false, message: `entries[${i}] must be an object` };
    const entry = e as Record<string, unknown>;
    const seq = entry.lineNo ?? i + 1;
    if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) {
      return { ok: false, message: `entries[${i}].lineNo must be a positive integer` };
    }
    if (seen.has(seq)) return { ok: false, message: `entries[${i}].lineNo is duplicated` };
    seen.add(seq);
    const approvalUser = trimmedString(entry.approvalUser, 200);
    const status = trimmedString(entry.status, 100);
    if (!approvalUser) return { ok: false, message: `entries[${i}].approvalUser is required` };
    if (!status) return { ok: false, message: `entries[${i}].status is required` };
    let actionAt: Date | null = null;
    if (entry.actionAt !== null && entry.actionAt !== undefined && entry.actionAt !== '') {
      if (typeof entry.actionAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(entry.actionAt)) {
        return { ok: false, message: `entries[${i}].actionAt must be YYYY-MM-DDTHH:mm:ss or null` };
      }
      // Pronto shows local site time without a zone; keep the wall-clock value as-is.
      const parsed = new Date(`${entry.actionAt}Z`);
      if (Number.isNaN(parsed.getTime())) return { ok: false, message: `entries[${i}].actionAt is not a valid date` };
      actionAt = parsed;
    }
    entries.push({
      entrySeq: seq,
      approvalUser,
      actionAt,
      actionAtRaw: trimmedString(entry.actionAtRaw, 40),
      status,
      comment: trimmedString(entry.comment, 1000),
    });
  }
  return { ok: true, value: { poNumber, entries } };
};

/** Replaces the stored history of one PO for a PRF in a single transaction. */
export const replaceProntoApprovalHistory = async (prfId: number, payload: ProntoApprovalPayload): Promise<number> => {
  const transaction = new sql.Transaction(getPool());
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input('PRFID', sql.Int, prfId)
      .input('PONumber', sql.NVarChar(20), payload.poNumber)
      .query('DELETE FROM dbo.PRFProntoApprovalHistory WHERE PRFID = @PRFID AND PONumber = @PONumber');
    for (const e of payload.entries) {
      await new sql.Request(transaction)
        .input('PRFID', sql.Int, prfId)
        .input('PONumber', sql.NVarChar(20), payload.poNumber)
        .input('EntrySeq', sql.Int, e.entrySeq)
        .input('ApprovalUser', sql.NVarChar(200), e.approvalUser)
        .input('ActionAt', sql.DateTime2, e.actionAt)
        .input('ActionAtRaw', sql.NVarChar(40), e.actionAtRaw)
        .input('Status', sql.NVarChar(100), e.status)
        .input('Comment', sql.NVarChar(1000), e.comment)
        .query(
          `INSERT INTO dbo.PRFProntoApprovalHistory
             (PRFID, PONumber, EntrySeq, ApprovalUser, ActionAt, ActionAtRaw, Status, Comment)
           VALUES (@PRFID, @PONumber, @EntrySeq, @ApprovalUser, @ActionAt, @ActionAtRaw, @Status, @Comment)`
        );
    }
    await transaction.commit();
    return payload.entries.length;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {
      /* keep the original error */
    }
    throw error;
  }
};

export const listProntoApprovalHistory = async (prfId: number): Promise<ProntoApprovalHistoryRow[]> => {
  const result = await executeQuery<ProntoApprovalHistoryRow>(
    `SELECT HistoryID, PRFID, PONumber, EntrySeq, ApprovalUser, ActionAt, ActionAtRaw, Status, Comment, SyncedAt
       FROM dbo.PRFProntoApprovalHistory
      WHERE PRFID = @PRFID
      ORDER BY PONumber, EntrySeq`,
    { PRFID: prfId }
  );
  return result.recordset;
};
