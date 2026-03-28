import React, { useEffect, useMemo, useState } from "react";
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
      ...(search.trim().length > 0 ? { search: search.trim() } : {})
    });
    return params.toString();
  }, [pagination.page, pagination.limit, search]);

  const fetchAuditLog = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await fetch(`/api/reports/audit-log?${queryString}`, {
        headers: authService.getAuthHeaders()
      });
      const payload = (await resp.json()) as AuditLogApiResponse;
      if (!resp.ok || !payload.success) {
        throw new Error(payload.message || `HTTP ${resp.status}`);
      }
      setRows(payload.data);
      setPagination(payload.pagination);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLog();
  }, [queryString]);

  const handleSearchSubmit = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchAuditLog();
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Reports - Audit Log</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchAuditLog} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
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
            <div className="text-sm text-red-600">{error}</div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Total: {pagination.total} • Page {pagination.page}/{pagination.totalPages || 1}
            </div>
          )}

          <div className="overflow-x-auto">
            <Table className="min-w-full">
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
                {loading ? (
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
                      <TableCell>{row.Action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground" title={row.NewValues || ""}>
                        {row.NewValues ? truncate(row.NewValues, 240) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

