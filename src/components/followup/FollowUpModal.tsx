import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/authService";

interface FollowUpReason {
  code: "approval_waiting" | "past_required_date" | "requisition_approved_idle";
  days: number;
  label: string;
}

interface FollowUpItem {
  prfId: number;
  prfNo: string;
  title: string | null;
  status: string | null;
  requiredDate: string | null;
  allocatedBuyer: string | null;
  nextActionBy: string[];
  reasons: FollowUpReason[];
  maxDays: number;
}

const SNOOZE_KEY = "pomon-followup-snoozed"; // sessionStorage: "Remind me later" (until the next login)
const DISMISS_KEY = "pomon-followup-dismissed"; // localStorage: "Don't show again today", per user

// Tabs opened from the modal carry this flag; a new tab has its own sessionStorage, so the snooze does not reach it.
const FROM_FLAG = "from=follow-up";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local date

const read = (storage: () => Storage, key: string): string | null => {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
};

const write = (storage: () => Storage, key: string, value: string): void => {
  try {
    storage().setItem(key, value);
  } catch {
    /* storage unavailable: the modal simply shows again next time */
  }
};

const REASON_STYLE: Record<FollowUpReason["code"], string> = {
  approval_waiting: "bg-amber-100 text-amber-900 border-amber-200",
  past_required_date: "bg-red-100 text-red-900 border-red-200",
  requisition_approved_idle: "bg-blue-100 text-blue-900 border-blue-200",
};

const REASON_FILTERS: { code: FollowUpReason["code"]; label: string }[] = [
  { code: "approval_waiting", label: "Waiting approval" },
  { code: "past_required_date", label: "Past Required Date" },
  { code: "requisition_approved_idle", label: "Approved, no PO" },
];

type SortKey = "priority" | "longest" | "required" | "prf";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "priority", label: "Priority (approvals first)" },
  { key: "longest", label: "Longest delay first" },
  { key: "required", label: "Required Date, oldest first" },
  { key: "prf", label: "PRF No" },
];

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const sortItems = (list: FollowUpItem[], key: SortKey): FollowUpItem[] => {
  const out = [...list];
  if (key === "longest") return out.sort((a, b) => b.maxDays - a.maxDays);
  if (key === "required")
    return out.sort((a, b) => (a.requiredDate ?? "9999").localeCompare(b.requiredDate ?? "9999"));
  if (key === "prf") return out.sort((a, b) => a.prfNo.localeCompare(b.prfNo, undefined, { numeric: true }));
  return out; // the API already returns priority order
};

/** After login, lists the PRFs that need follow-up (rules: GET /api/prfs/follow-up). */
export function FollowUpModal() {
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FollowUpReason["code"] | "all">("all");
  const [buyer, setBuyer] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("priority");
  const user = authService.getCurrentUser();
  const dismissKey = `${DISMISS_KEY}:${user?.id ?? "anon"}`;

  useEffect(() => {
    if (window.location.search.includes(FROM_FLAG)) {
      write(() => sessionStorage, SNOOZE_KEY, "1");
      return;
    }
    if (read(() => sessionStorage, SNOOZE_KEY) === "1") return;
    if (read(() => localStorage, dismissKey) === today()) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/prfs/follow-up", { headers: authService.getAuthHeaders() });
        const result = await response.json();
        const list: FollowUpItem[] = response.ok && result.success ? result.data?.items ?? [] : [];
        if (!cancelled && list.length > 0) {
          setItems(list);
          setOpen(true);
        }
      } catch {
        /* the follow-up list is a convenience; never block the app */
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [dismissKey]);

  const snooze = () => {
    write(() => sessionStorage, SNOOZE_KEY, "1");
    setOpen(false);
  };

  const dismissToday = () => {
    write(() => localStorage, dismissKey, today());
    setOpen(false);
  };

  // Opens in a new tab so the list stays here for the next PRF.
  const openPrf = (prfNo: string) => {
    window.open(`/prf?search=${encodeURIComponent(prfNo)}&${FROM_FLAG}`, "_blank", "noopener,noreferrer");
  };

  const countBy = (code: FollowUpReason["code"]) => items.filter((i) => i.reasons.some((r) => r.code === code)).length;
  const waiting = countBy("approval_waiting");
  const buyers = useMemo(
    () => [...new Set(items.map((i) => i.allocatedBuyer).filter((b): b is string => !!b))].sort(),
    [items]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((i) => {
      if (reason !== "all" && !i.reasons.some((r) => r.code === reason)) return false;
      if (buyer === "none" ? !!i.allocatedBuyer : buyer !== "all" && i.allocatedBuyer !== buyer) return false;
      if (!q) return true;
      return [i.prfNo, i.title, i.status, i.allocatedBuyer, ...i.nextActionBy]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    });
    return sortItems(filtered, sort);
  }, [items, reason, buyer, query, sort]);

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : snooze())}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Need Follow-up ({items.length} PRF{items.length === 1 ? "" : "s"})
          </DialogTitle>
          <DialogDescription>
            {waiting} waiting for an approver for more than 3 days. Data from the latest Pronto sync.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={reason === "all" ? "default" : "outline"} onClick={() => setReason("all")}>
            All ({items.length})
          </Button>
          {REASON_FILTERS.map((f) => {
            const n = countBy(f.code);
            if (n === 0) return null;
            return (
              <Button
                key={f.code}
                size="sm"
                variant={reason === f.code ? "default" : "outline"}
                onClick={() => setReason(f.code)}
              >
                {f.label} ({n})
              </Button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-9 w-full sm:w-64"
            placeholder="Search PRF, title, approver, buyer"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select aria-label="Buyer" className={SELECT_CLASS} value={buyer} onChange={(e) => setBuyer(e.target.value)}>
            <option value="all">All buyers</option>
            {buyers.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
            <option value="none">No buyer</option>
          </select>
          <select
            aria-label="Sort"
            className={SELECT_CLASS}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {SORTS.map((o) => (
              <option key={o.key} value={o.key}>
                Sort: {o.label}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">
            Showing {visible.length} of {items.length}
          </span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">PRF</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Next Action By</th>
                <th className="px-3 py-2 font-medium">Buyer</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Required Date</th>
                <th className="px-3 py-2 font-medium">Why</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    No PRF matches these filters.
                  </td>
                </tr>
              )}
              {visible.map((i) => (
                <tr key={i.prfId} className="border-t align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{i.prfNo}</div>
                    <div className="max-w-[220px] truncate text-xs text-muted-foreground" title={i.title ?? ""}>
                      {i.title || "-"}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{i.status || "-"}</td>
                  <td className="px-3 py-2">{i.nextActionBy.length ? i.nextActionBy.join(", ") : "-"}</td>
                  <td className="px-3 py-2">{i.allocatedBuyer || "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{i.requiredDate ?? "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {i.reasons.map((r) => (
                        <Badge key={r.code} variant="outline" className={`w-fit whitespace-nowrap font-normal ${REASON_STYLE[r.code]}`}>
                          {r.label}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => openPrf(i.prfNo)} title="Open in a new tab">
                      Open
                      <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={dismissToday}>
            Don't show again today
          </Button>
          <Button onClick={snooze}>Remind me later</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
