import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronRight, ListChecks, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authService } from "@/services/authService";
import {
  fetchProntoQueue,
  formatAmount,
  formatProntoTime,
  summarizeNextActionBy,
  type QueueCategory,
  type QueueData,
  type QueueItem,
} from "@/components/immediate-action/prontoQueue";

const SECTIONS: Array<{ category: QueueCategory; title: string; hint: string; tone: string }> = [
  {
    category: "rejected",
    title: "Rejected",
    hint: "The latest Pronto action is a rejection. Read the comment and follow up (revise, add documents, or raise a new PR).",
    tone: "border-l-red-500",
  },
  {
    category: "it_action",
    title: "Needs IT review and approve / acknowledge",
    hint: "Next Action By is MTI IT. Review the requisition and approve or acknowledge it in Pronto.",
    tone: "border-l-amber-500",
  },
  {
    category: "waiting_other",
    title: "Waiting for others",
    hint: "In the IT queue, but Next Action By is someone else. Check Approval Status for notes.",
    tone: "border-l-slate-400",
  },
];

const formatCheckedAt = (iso: string | null): string => (iso ? new Date(iso).toLocaleString() : "never");

function QueueDetails({ item }: { item: QueueItem }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs">Details</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[560px] max-w-[calc(100vw-2rem)] space-y-3">
        <div>
          <div className="text-sm font-semibold">Approval Status · {item.orderNo}</div>
          {item.approvals.length === 0 ? (
            <div className="text-xs text-muted-foreground">No entries read.</div>
          ) : (
            <div className="mt-1 max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr><th className="py-1 pr-2 text-left font-medium">User</th><th className="py-1 pr-2 text-left font-medium">Date</th><th className="py-1 pr-2 text-left font-medium">Status</th><th className="py-1 text-left font-medium">Comment</th></tr>
                </thead>
                <tbody>
                  {item.approvals.map((e) => (
                    <tr key={e.lineNo} className="border-t align-top">
                      <td className="py-1 pr-2">{e.approvalUser}</td>
                      <td className="py-1 pr-2 whitespace-nowrap">{formatProntoTime(e) || "-"}</td>
                      <td className="py-1 pr-2">{e.status || <span className="text-amber-700 dark:text-amber-400">Waiting</span>}</td>
                      <td className="py-1">{e.comment || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <div className="text-sm font-semibold">Next Action By ({item.nextActionBy.length})</div>
          {item.nextActionBy.length === 0 ? (
            <div className="text-xs text-muted-foreground">No entries read.</div>
          ) : (
            <div className="mt-1 max-h-40 overflow-auto text-xs">
              {item.nextActionBy.map((e) => (
                <div key={`${e.user}-${e.hierarchy}`} className="flex justify-between gap-3 border-t py-1">
                  <span>{e.name}</span>
                  <span className="text-muted-foreground">{e.user}{e.hierarchy ? ` · ${e.hierarchy}` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {item.readErrors && <div className="text-xs text-red-600">Read problem: {item.readErrors}</div>}
      </PopoverContent>
    </Popover>
  );
}

function QueueRow({ item }: { item: QueueItem }) {
  const latest = item.latestAction;
  return (
    <TableRow className="align-top">
      <TableCell className="whitespace-nowrap">
        <div className="font-medium">{item.orderNo}</div>
        {item.prfNo && (
          <Link to={`/prf?search=${encodeURIComponent(item.prfNo)}`} className="text-xs text-primary hover:underline">
            {item.isSplit ? `Split of PRF ${item.prfNo}` : "Open PRF"}
          </Link>
        )}
      </TableCell>
      <TableCell>
        <div>{item.supplier || "-"}</div>
        <div className="text-xs text-muted-foreground">{item.stockGroup || item.costCategory || ""}</div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right">{formatAmount(item.reqTotal, item.currency)}</TableCell>
      <TableCell className="whitespace-nowrap">{item.dueDate ?? "-"}</TableCell>
      <TableCell className="min-w-[220px]">
        {latest ? (
          <>
            <div>
              <span className={latest.status.toLowerCase().includes("reject") ? "font-medium text-red-600" : "font-medium"}>{latest.status}</span>
              <span className="text-muted-foreground"> · {latest.approvalUser} · {formatProntoTime(latest)}</span>
            </div>
            {latest.comment && <div className="text-xs italic text-muted-foreground">"{latest.comment}"</div>}
          </>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="min-w-[160px] text-sm">{summarizeNextActionBy(item.nextActionBy)}</TableCell>
      <TableCell className="text-right"><QueueDetails item={item} /></TableCell>
    </TableRow>
  );
}

function QueueTable({ items }: { items: QueueItem[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order No</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="text-right">Req Total</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Latest Pronto action</TableHead>
            <TableHead>Next Action By</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => <QueueRow key={item.orderNo} item={item} />)}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ImmediateAction() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const active = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchProntoQueue(authService.getAuthHeaders(), controller.signal));
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => active.current?.abort();
  }, [load]);

  return (
    <div className="merdeka-overview space-y-5">
      <div className="merdeka-page-heading flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="merdeka-eyebrow">Pronto / Approve/Review Requisitions</p>
          <h1 className="text-[22px] font-semibold">Immediate Action</h1>
          <p className="text-muted-foreground">
            Requisitions in the Pronto Immediate Action queue that belong to POMON PRFs (including split POs). Read-only; act in Pronto.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Checked in Pronto: {formatCheckedAt(data?.lastSuccessAt ?? null)} (every hour)
          </span>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {data?.error && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            The last Pronto check ({formatCheckedAt(data.checkedAt)}) failed: {data.error}
            {data.lastSuccessAt ? " The list below is from the last successful check." : ""}
          </div>
        </div>
      )}

      {data && !data.lastSuccessAt && !data.error && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">The queue has not been read from Pronto yet.</CardContent></Card>
      )}

      {data && data.lastSuccessAt && data.counts.total === 0 && (
        <Card><CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><ListChecks className="h-4 w-4" />Nothing in the Immediate Action queue for IT PRFs.</CardContent></Card>
      )}

      {data && SECTIONS.map((section) => {
        const items = data.items.filter((i) => i.category === section.category);
        if (items.length === 0) return null;
        return (
          <Card key={section.category} className={`border-l-4 ${section.tone}`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {section.title}
                <Badge variant={section.category === "rejected" ? "destructive" : "secondary"}>{items.length}</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">{section.hint}</p>
            </CardHeader>
            <CardContent><QueueTable items={items} /></CardContent>
          </Card>
        );
      })}

      {data && data.unmatched.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            aria-expanded={showOthers}
            onClick={() => setShowOthers((v) => !v)}
          >
            {showOthers ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {data.unmatched.length} other requisition{data.unmatched.length === 1 ? "" : "s"} in the Pronto queue do not match a POMON PRF or split PO
          </button>
          {showOthers && (
            <Card>
              <CardContent className="pt-4">
                <p className="mb-2 text-xs text-muted-foreground">
                  If one of these is an IT split PO, record its number as the Split PO Number on the PRF item so it appears above.
                </p>
                <QueueTable items={data.unmatched} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
