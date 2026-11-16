import { executeQuery } from '../config/database';

/** Thresholds agreed with the product owner on 2026-11-16. */
export const FOLLOW_UP_THRESHOLDS = {
  approvalWaitingDays: 3,
  requisitionApprovedIdleDays: 7,
  /** Older overdue PRFs are left out (product owner, 2026-11-16): they are usually closed in practice. */
  pastRequiredDateMaxDays: 90,
};

/** Pronto site time zone (WITA, UTC+8). Approval times are stored as Pronto wall-clock time. */
const SITE_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_STATUSES = new Set(['completed', 'cancelled', 'rejected']);

export interface FollowUpPrfRow {
  PRFID: number;
  PRFNo: string;
  Title: string | null;
  Status: string | null;
  RequiredDate: Date | null;
  AllocatedBuyer: string | null;
}

export interface FollowUpApprovalRow {
  PRFID: number;
  PONumber: string;
  ApprovalUser: string;
  ActionAt: Date | null;
  Status: string;
}

export type FollowUpReasonCode = 'approval_waiting' | 'past_required_date' | 'requisition_approved_idle';

export interface FollowUpReason {
  code: FollowUpReasonCode;
  days: number;
  label: string;
}

export interface FollowUpItem {
  prfId: number;
  prfNo: string;
  title: string | null;
  status: string | null;
  requiredDate: string | null;
  allocatedBuyer: string | null;
  nextActionBy: string[];
  lastActionAt: string | null;
  reasons: FollowUpReason[];
  maxDays: number;
}

const wallDays = (fromWall: Date, nowWall: number): number => Math.floor((nowWall - fromWall.getTime()) / DAY_MS);

/**
 * Pure rules: which active PRFs need follow-up and why. A PRF is listed when any rule matches:
 * - approval_waiting: Pronto lists an approver who has not acted yet, and the last approval step is
 *   older than `approvalWaitingDays`;
 * - past_required_date: the Required Date has passed, at most `pastRequiredDateMaxDays` ago;
 * - requisition_approved_idle: status "Req. Approved" (the buyer still has to convert it into a PO)
 *   and no approval step for more than `requisitionApprovedIdleDays`.
 */
export const buildFollowUps = (
  prfs: FollowUpPrfRow[],
  approvals: FollowUpApprovalRow[],
  now: Date,
  thresholds = FOLLOW_UP_THRESHOLDS
): FollowUpItem[] => {
  const nowWall = now.getTime() + SITE_UTC_OFFSET_MS;
  const today = new Date(nowWall).toISOString().slice(0, 10);
  const byPrf = new Map<number, FollowUpApprovalRow[]>();
  for (const a of approvals) {
    const list = byPrf.get(a.PRFID) ?? [];
    list.push(a);
    byPrf.set(a.PRFID, list);
  }

  const out: FollowUpItem[] = [];
  for (const p of prfs) {
    const status = (p.Status || '').trim();
    if (CLOSED_STATUSES.has(status.toLowerCase())) continue;
    const entries = byPrf.get(p.PRFID) ?? [];
    const pending = [...new Set(entries.filter((e) => !e.Status && !e.ActionAt).map((e) => e.ApprovalUser))];
    const lastActionAt = entries.reduce<Date | null>(
      (acc, e) => (e.ActionAt && (!acc || e.ActionAt > acc) ? e.ActionAt : acc),
      null
    );
    const idleDays = lastActionAt ? wallDays(lastActionAt, nowWall) : null;
    const reasons: FollowUpReason[] = [];

    if (pending.length > 0 && idleDays !== null && idleDays > thresholds.approvalWaitingDays) {
      reasons.push({ code: 'approval_waiting', days: idleDays, label: `Waiting for ${pending.join(', ')} for ${idleDays} days` });
    }
    if (p.RequiredDate) {
      const required = p.RequiredDate.toISOString().slice(0, 10);
      if (required < today) {
        const days = Math.floor((Date.parse(today) - Date.parse(required)) / DAY_MS);
        if (days <= thresholds.pastRequiredDateMaxDays) reasons.push({ code: 'past_required_date', days, label: `Required Date passed ${days} days ago` });
      }
    }
    if (
      status.toLowerCase() === 'req. approved' &&
      pending.length === 0 &&
      idleDays !== null &&
      idleDays > thresholds.requisitionApprovedIdleDays
    ) {
      reasons.push({ code: 'requisition_approved_idle', days: idleDays, label: `Approved, no PO yet for ${idleDays} days` });
    }
    if (reasons.length === 0) continue;

    out.push({
      prfId: p.PRFID,
      prfNo: p.PRFNo,
      title: p.Title,
      status: p.Status,
      requiredDate: p.RequiredDate ? p.RequiredDate.toISOString().slice(0, 10) : null,
      allocatedBuyer: p.AllocatedBuyer,
      nextActionBy: pending,
      lastActionAt: lastActionAt ? lastActionAt.toISOString().slice(0, 19) : null,
      reasons,
      maxDays: Math.max(...reasons.map((r) => r.days)),
    });
  }
  // Approvals waiting first (someone can act now), then the longest delay.
  const rank = (i: FollowUpItem) => (i.reasons.some((r) => r.code === 'approval_waiting') ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b) || b.maxDays - a.maxDays);
};

/** Loads the active PRFs of one budget year with their Pronto approval history and applies the rules. */
export const listFollowUps = async (budgetYear: number, now = new Date()): Promise<FollowUpItem[]> => {
  const prfs = await executeQuery<FollowUpPrfRow>(
    `SELECT PRFID, PRFNo, Title, Status, RequiredDate, AllocatedBuyer
       FROM dbo.PRF
      WHERE BudgetYear = @BudgetYear
        AND LOWER(LTRIM(RTRIM(ISNULL(Status, '')))) NOT IN ('completed', 'cancelled', 'rejected')`,
    { BudgetYear: budgetYear }
  );
  const approvals = await executeQuery<FollowUpApprovalRow>(
    `SELECT h.PRFID, h.PONumber, h.ApprovalUser, h.ActionAt, h.Status
       FROM dbo.PRFProntoApprovalHistory h
       INNER JOIN dbo.PRF p ON p.PRFID = h.PRFID
      WHERE p.BudgetYear = @BudgetYear`,
    { BudgetYear: budgetYear }
  );
  return buildFollowUps(prfs.recordset, approvals.recordset, now);
};
