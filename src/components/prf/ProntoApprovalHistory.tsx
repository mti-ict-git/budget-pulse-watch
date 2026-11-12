import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { authService } from "@/services/authService";

interface ProntoApprovalEntry {
  poNumber: string;
  entrySeq: number;
  approvalUser: string;
  actionAt: string | null;
  actionAtRaw: string | null;
  status: string;
  comment: string | null;
  syncedAt: string;
}

interface ProntoApprovalHistoryProps {
  prfId: number;
  prfNo: string;
}

const formatActionAt = (entry: ProntoApprovalEntry): string => {
  if (entry.actionAt) {
    // Pronto wall-clock time without a zone: format the parts as-is.
    const [date, time] = entry.actionAt.split("T");
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y} ${time}`;
  }
  return entry.actionAtRaw || "-";
};

export default function ProntoApprovalHistory({ prfId, prfNo }: ProntoApprovalHistoryProps) {
  const [entries, setEntries] = useState<ProntoApprovalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/prfs/${prfId}/pronto-approvals`, { headers: authService.getAuthHeaders() });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Failed to load approval history");
        if (!cancelled) setEntries(Array.isArray(result.data) ? result.data : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load approval history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (Number.isFinite(prfId)) void load();
    return () => {
      cancelled = true;
    };
  }, [prfId]);

  const byPo = useMemo(() => {
    const groups = new Map<string, ProntoApprovalEntry[]>();
    for (const e of entries) {
      const list = groups.get(e.poNumber) ?? [];
      list.push(e);
      groups.set(e.poNumber, list);
    }
    // Original PO (same number as the PRF) first, then split POs.
    return [...groups.entries()].sort(([a], [b]) => (a === prfNo ? -1 : b === prfNo ? 1 : a.localeCompare(b)));
  }, [entries, prfNo]);

  const lastSynced = entries.reduce<string | null>((acc, e) => (!acc || e.syncedAt > acc ? e.syncedAt : acc), null);

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Pronto Approval History
        </CardTitle>
        {lastSynced && (
          <p className="text-xs text-muted-foreground">
            Synced from Pronto (PO E001 &gt; Approval Status) on {new Date(lastSynced).toLocaleString("id-ID")}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {loading && <p className="text-sm text-muted-foreground">Loading approval history…</p>}
        {!loading && error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && byPo.length === 0 && (
          <p className="text-sm text-muted-foreground">No Pronto approval history has been synced for this PRF yet.</p>
        )}
        {byPo.map(([po, list]) => {
          const last = list[list.length - 1];
          return (
            <div key={po} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">PO {po}</span>
                {po !== prfNo && <Badge variant="outline">Split PO</Badge>}
                {last && (
                  <span className="text-sm text-muted-foreground">
                    Latest: {last.status} by {last.approvalUser}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Approval User</th>
                      <th className="px-3 py-2 font-medium whitespace-nowrap">Date Time</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((e) => (
                      <tr key={`${po}-${e.entrySeq}`} className="border-t">
                        <td className="px-3 py-2 text-muted-foreground">{e.entrySeq}</td>
                        <td className="px-3 py-2">{e.approvalUser}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatActionAt(e)}</td>
                        <td className="px-3 py-2">{e.status}</td>
                        <td className="px-3 py-2 text-muted-foreground">{e.comment || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
