import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Search } from "lucide-react";
import { authService } from "@/services/authService";

type AuditLogRow = {
  AuditID: number;
  TableName: string;
  RecordID: number;
  Action: string;
  ChangedAt: string;
  ChangedByName: string | null;
  PRFNo: string | null;
  OldValues: string | null;
  NewValues: string | null;
};

type AuditLogApiResponse = {
  success: boolean;
  data: AuditLogRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
};

const truncate = (value: string, max: number): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}…`;
};

export default function Reports() {
  const [search, setSearch] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const activeRequest = useRef<AbortController | null>(null);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      ...(committedSearch.length > 0 ? { search: committedSearch } : {})
    });
    return params.toString();
  }, [pagination.page, pagination.limit, committedSearch]);

  const fetchAuditLog = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      setLoading(true);
      setError(null);
      const resp = await fetch(`/api/reports/audit-log?${queryString}`, {
        signal: controller.signal,
        headers: authService.getAuthHeaders()
      });
      const payload = (await resp.json()) as AuditLogApiResponse;
      if (!resp.ok || !payload.success) {
        throw new Error(payload.message || `HTTP ${resp.status}`);
      }
      if (controller.signal.aborted) return;
      setRows(payload.data);
      setPagination(payload.pagination);
    } catch (e) {
      if (controller.signal.aborted) return;
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    fetchAuditLog();
    return () => activeRequest.current?.abort();
  }, [fetchAuditLog, refreshVersion]);

  const handleSearchSubmit = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setCommittedSearch(search.trim());
    setRefreshVersion(value => value + 1);
  };

  return (
    <div className="merdeka-overview merdeka-reports space-y-5">
      <div className="merdeka-page-heading flex flex-wrap items-center justify-between gap-4">
        <div><p className="merdeka-eyebrow">Reports / Audit Log</p><h1 className="text-[22px] font-semibold">Reports</h1><p className="text-muted-foreground">Review PRF changes and recorded activity.</p></div>
        <Button variant="outline" size="sm" onClick={() => setRefreshVersion(value => value + 1)} disabled={loading}><RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Audit Log</CardTitle>

          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="merdeka-report-search flex flex-wrap items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search audit log by PRF number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PRF No (e.g. 43030)"
                className="pl-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchSubmit();
                }}
              />
            </div>
            <Button onClick={handleSearchSubmit} disabled={loading}>
              Search
            </Button>
          </div>

          {error ? (
            <div role="alert" className="merdeka-data-error">{error}<Button variant="outline" size="sm" onClick={() => setRefreshVersion(value => value + 1)}>Retry</Button></div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Total: {pagination.total} • Page {pagination.page}/{pagination.totalPages || 1}
            </div>
          )}

          <div className="merdeka-budget-table-scroll rounded-md border" role="region" aria-label="Audit log table" tabIndex={0}>
            <Table className="merdeka-budget-table min-w-[920px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">When</TableHead>
                  <TableHead className="min-w-[90px]">PRF No</TableHead>
                  <TableHead className="min-w-[120px]">Actor</TableHead>
                  <TableHead className="min-w-[90px]">Action</TableHead>
                  <TableHead className="min-w-[420px]">Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {error ? null : loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Loading...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No audit log data
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.AuditID}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(row.ChangedAt).toLocaleString("id-ID", {
                          timeZone: "Asia/Jakarta",
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </TableCell>
                      <TableCell className="font-medium">{row.PRFNo || row.RecordID}</TableCell>
                      <TableCell className="truncate max-w-[160px]" title={row.ChangedByName || ""}>
                        {row.ChangedByName || "-"}
                      </TableCell>
                      <TableCell><span className="merdeka-audit-action">{row.Action}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground" title={row.NewValues || ""}>
                        {row.NewValues ? truncate(row.NewValues, 240) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <nav aria-label="Audit log pagination" className="merdeka-data-pager flex flex-wrap items-center justify-between gap-3">
            <span className="text-muted-foreground text-xs">{loading ? 'Loading records...' : `${pagination.total} records - Page ${pagination.page} of ${pagination.totalPages || 1}`}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || !!error || pagination.page <= 1} onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}>Previous</Button><Button variant="outline" size="sm" disabled={loading || !!error || pagination.page >= pagination.totalPages} onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}>Next</Button></div>
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
