/** Pronto approval history (PO E001 > Approval Status) as returned by GET /api/prfs/:id/pronto-approvals. */

export interface ProntoApprovalEntry {
  poNumber: string;
  entrySeq: number;
  approvalUser: string;
  actionAt: string | null;
  actionAtRaw: string | null;
  status: string;
  comment: string | null;
  syncedAt: string;
}

// Pronto lists approvers who have not acted yet with an empty status and date.
export const isPendingApproval = (entry: ProntoApprovalEntry): boolean => !entry.status && !entry.actionAt;

export const formatApprovalActionAt = (entry: ProntoApprovalEntry): string => {
  if (entry.actionAt) {
    // Pronto wall-clock time without a zone: format the parts as-is.
    const [date, time] = entry.actionAt.split("T");
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y} ${time}`;
  }
  return entry.actionAtRaw || "-";
};

/** Entries grouped by PO: the original PO (same number as the PRF) first, then split POs. */
export const groupApprovalsByPo = (entries: ProntoApprovalEntry[], prfNo: string): Array<[string, ProntoApprovalEntry[]]> => {
  const groups = new Map<string, ProntoApprovalEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.poNumber) ?? [];
    list.push(e);
    groups.set(e.poNumber, list);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === prfNo ? -1 : b === prfNo ? 1 : a.localeCompare(b)));
};

export const fetchProntoApprovals = async (prfId: number, headers: HeadersInit): Promise<ProntoApprovalEntry[]> => {
  const response = await fetch(`/api/prfs/${prfId}/pronto-approvals`, { headers });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || "Failed to load approval history");
  return Array.isArray(result.data) ? result.data : [];
};
