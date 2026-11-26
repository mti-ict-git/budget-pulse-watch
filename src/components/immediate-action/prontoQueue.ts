/** Pronto Immediate Action queue (PO M094) as returned by GET /api/pronto-queue. */

export type QueueCategory = "rejected" | "it_action" | "waiting_other";

export interface QueueNextActionBy {
  name: string;
  user: string;
  hierarchy: string;
}

export interface QueueApprovalEntry {
  lineNo: number;
  approvalUser: string;
  /** Pronto wall-clock time without a zone, YYYY-MM-DDTHH:mm:ss. */
  actionAt: string | null;
  actionAtRaw: string | null;
  status: string;
  comment: string | null;
}

export interface QueueItem {
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

export interface QueueData {
  checkedAt: string | null;
  lastSuccessAt: string | null;
  prontoUser: string | null;
  error: string | null;
  counts: { total: number; rejected: number; itAction: number; waitingOther: number };
  items: QueueItem[];
  unmatched: QueueItem[];
}

export const fetchProntoQueue = async (headers: HeadersInit, signal?: AbortSignal): Promise<QueueData> => {
  const response = await fetch("/api/pronto-queue", { headers, signal });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || "Failed to load the Immediate Action queue");
  return result.data as QueueData;
};

/** Pronto wall-clock "2026-11-25T10:50:57" -> "25/11/2026 10:50". */
export const formatProntoTime = (entry: QueueApprovalEntry): string => {
  if (entry.actionAt) {
    const [date, time] = entry.actionAt.split("T");
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y} ${time.slice(0, 5)}`;
  }
  return entry.actionAtRaw || "";
};

export const formatAmount = (value: number | null, currency: string | null): string => {
  if (value === null || value === undefined) return "-";
  return `${currency ? `${currency} ` : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
};

/** Next Action By lists can hold dozens of buyers; show the first few names. */
export const summarizeNextActionBy = (entries: QueueNextActionBy[], max = 3): string => {
  if (entries.length === 0) return "-";
  const names = entries.slice(0, max).map((e) => e.name || e.user);
  return entries.length > max ? `${names.join(", ")} +${entries.length - max} more` : names.join(", ");
};
