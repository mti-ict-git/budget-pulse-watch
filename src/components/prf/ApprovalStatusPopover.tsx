import { useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { authService } from "@/services/authService";
import {
  fetchProntoApprovals,
  formatApprovalActionAt,
  groupApprovalsByPo,
  isPendingApproval,
  type ProntoApprovalEntry,
} from "./prontoApprovals";

interface ApprovalStatusPopoverProps {
  prfId: number;
  prfNo: string;
  approvedByName?: string | null;
  /** Approvers Pronto still waits for, from the PRF list API. */
  pendingApprovers?: string[];
}

/**
 * Approved By cell of PRF Monitoring: the approver name, who the PRF is waiting for, and a popover
 * with the Pronto approval steps (user, status, date) per PO. The steps load when it opens.
 */
export function ApprovalStatusPopover({ prfId, prfNo, approvedByName, pendingApprovers = [] }: ApprovalStatusPopoverProps) {
  const [entries, setEntries] = useState<ProntoApprovalEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchProntoApprovals(prfId, authService.getAuthHeaders()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approval history");
    } finally {
      setLoading(false);
    }
  };

  const byPo = entries ? groupApprovalsByPo(entries, prfNo) : [];
  const lastSynced = (entries ?? []).reduce<string | null>((acc, e) => (!acc || e.syncedAt > acc ? e.syncedAt : acc), null);
  const waitingText = pendingApprovers.join(", ");

  return (
    <div className="flex items-start gap-1" onClick={(e) => e.stopPropagation()}>
      <div className="min-w-0 flex-1">
        <div className="truncate" title={approvedByName || ""}>{approvedByName || "-"}</div>
        {pendingApprovers.length > 0 && (
          <div className="truncate text-xs text-amber-700 dark:text-amber-400" title={`Waiting: ${waitingText}`}>
            Waiting: {waitingText}
          </div>
        )}
      </div>
      <Popover onOpenChange={(open) => { if (open && entries === null && !loading) void load(); }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 shrink-0 p-0" aria-label={`Pronto approval status of PRF ${prfNo}`}>
            <History className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[26rem] max-w-[calc(100vw-2rem)] p-0">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-medium">Pronto approval · PRF {prfNo}</p>
            {lastSynced && (
              <p className="text-xs text-muted-foreground">Synced {new Date(lastSynced).toLocaleString("id-ID")}</p>
            )}
          </div>
          <div className="max-h-80 space-y-4 overflow-y-auto px-4 py-3 text-sm">
            {loading && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
              </p>
            )}
            {!loading && error && <p className="text-destructive">{error}</p>}
            {!loading && !error && entries !== null && byPo.length === 0 && (
              <p className="text-muted-foreground">No Pronto approval history has been synced for this PRF yet.</p>
            )}
            {!loading && !error && byPo.map(([po, list]) => {
              const waitingFor = [...new Set(list.filter(isPendingApproval).map((e) => e.approvalUser))];
              return (
                <div key={po} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">PO {po}</span>
                    {po !== prfNo && <Badge variant="outline">Split PO</Badge>}
                  </div>
                  <p className="text-xs">
                    <span className="font-medium">Next Action By:</span>{" "}
                    {waitingFor.length > 0 ? waitingFor.join(", ") : <span className="text-muted-foreground">no pending approver</span>}
                  </p>
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-2 font-medium">Approval user</th>
                        <th className="py-1 pr-2 font-medium">Status</th>
                        <th className="py-1 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((e) => (
                        <tr key={`${po}-${e.entrySeq}`} className="border-t align-top">
                          <td className="py-1 pr-2">{e.approvalUser}</td>
                          <td className="py-1 pr-2">
                            {isPendingApproval(e) ? <Badge variant="secondary">Waiting</Badge> : e.status}
                          </td>
                          <td className="whitespace-nowrap py-1">{isPendingApproval(e) ? "-" : formatApprovalActionAt(e)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
