import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

/** After login, lists the PRFs that need follow-up (rules: GET /api/prfs/follow-up). */
export function FollowUpModal() {
  const navigate = useNavigate();
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [open, setOpen] = useState(false);
  const user = authService.getCurrentUser();
  const dismissKey = `${DISMISS_KEY}:${user?.id ?? "anon"}`;

  useEffect(() => {
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

  const openPrf = (prfNo: string) => {
    write(() => sessionStorage, SNOOZE_KEY, "1");
    setOpen(false);
    navigate(`/prf?search=${encodeURIComponent(prfNo)}`);
  };

  const waiting = items.filter((i) => i.reasons.some((r) => r.code === "approval_waiting")).length;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : snooze())}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Need Follow-up ({items.length} PRF{items.length === 1 ? "" : "s"})
          </DialogTitle>
          <DialogDescription>
            {waiting} waiting for an approver for more than 3 days. Data from the latest Pronto sync.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">PRF</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Next Action By</th>
                <th className="px-3 py-2 font-medium">Buyer</th>
                <th className="px-3 py-2 font-medium">Why</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
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
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {i.reasons.map((r) => (
                        <Badge key={r.code} variant="outline" className={`w-fit font-normal ${REASON_STYLE[r.code]}`}>
                          {r.label}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => openPrf(i.prfNo)}>
                      Open
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
