import { useCallback, useEffect, useState } from "react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  CheckCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
  DollarSign
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { authService } from "@/services/authService";

// Mock data
const metrics = [
  {
    title: "Total PRFs (2024)",
    value: "248",
    change: "+12% from last month",
    changeType: "positive" as const,
    icon: FileText
  },
  {
    title: "Approved PRFs",
    value: "189",
    change: "76% approval rate",
    changeType: "positive" as const,
    icon: CheckCircle
  },
  {
    title: "Pending PRFs",
    value: "32",
    change: "3 over budget",
    changeType: "negative" as const,
    icon: Clock
  },
  {
    title: "Budget Utilization",
    value: "68%",
    change: "+5% this quarter",
    changeType: "neutral" as const,
    icon: TrendingUp
  }
];

const budgetCategories = [
  { name: "IT Consumables", utilized: 72, remaining: 2800000, total: 10000000 },
  { name: "Internet Services", utilized: 45, remaining: 5500000, total: 10000000 },
  { name: "Software Licenses", utilized: 89, remaining: 1100000, total: 10000000 },
  { name: "Hardware", utilized: 34, remaining: 13200000, total: 20000000 },
];

interface RecentPRFItem {
  id: string;
  submitter: string;
  amount: number;
  status: string;
  category: string;
}

interface RecentPRFApiRow {
  PRFID?: number;
  PRFNo?: string;
  SubmitBy?: string;
  RequestorName?: string;
  RequestedAmount?: number;
  Amount?: number;
  Status?: string;
  PurchaseCostCode?: string;
}

interface RecentPRFApiResponse {
  success: boolean;
  data: RecentPRFApiRow[];
}

const getStatusBadge = (status: string) => {
  const normalizedStatus = status.trim().toLowerCase();
  if (normalizedStatus.includes("approved") || normalizedStatus.includes("complete")) {
    return <Badge variant="default">Approved</Badge>;
  }
  if (normalizedStatus.includes("over") && normalizedStatus.includes("budget")) {
    return <Badge variant="destructive">Over Budget</Badge>;
  }
  if (normalizedStatus.includes("reject") || normalizedStatus.includes("cancel") || normalizedStatus.includes("denied")) {
    return <Badge variant="destructive">Rejected</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [recentPRFs, setRecentPRFs] = useState<RecentPRFItem[]>([]);
  const [recentPRFsLoading, setRecentPRFsLoading] = useState<boolean>(false);
  const [recentPRFsError, setRecentPRFsError] = useState<string | null>(null);

  const fetchRecentPRFs = useCallback(async () => {
    setRecentPRFsLoading(true);
    setRecentPRFsError(null);
    try {
      const response = await fetch("/api/prfs?page=1&limit=5", {
        headers: authService.getAuthHeaders(),
      });

      const result: RecentPRFApiResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error("Failed to fetch recent PRFs");
      }

      const transformed = result.data.map((prf) => ({
        id: prf.PRFNo ?? (typeof prf.PRFID === "number" ? `PRF-${prf.PRFID}` : "-"),
        submitter: prf.SubmitBy ?? prf.RequestorName ?? "-",
        amount: prf.RequestedAmount ?? prf.Amount ?? 0,
        status: prf.Status ?? "pending",
        category: prf.PurchaseCostCode ?? "-",
      }));

      setRecentPRFs(transformed);
    } catch (error) {
      setRecentPRFs([]);
      setRecentPRFsError(error instanceof Error ? error.message : "Failed to fetch recent PRFs");
    } finally {
      setRecentPRFsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentPRFs();
  }, [fetchRecentPRFs]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your purchase orders and budget utilization
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Utilization */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Budget Utilization by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgetCategories.map((category) => (
              <div key={category.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{category.name}</span>
                  <span className="text-muted-foreground">{category.utilized}%</span>
                </div>
                <Progress 
                  value={category.utilized} 
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Remaining: {formatCurrency(category.remaining)}</span>
                  <span>Total: {formatCurrency(category.total)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent PRFs */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Recent PRFs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentPRFsLoading ? (
                <p className="text-sm text-muted-foreground">Loading recent PRFs...</p>
              ) : recentPRFsError ? (
                <p className="text-sm text-destructive">{recentPRFsError}</p>
              ) : recentPRFs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent PRFs available.</p>
              ) : (
                recentPRFs.map((prf) => (
                  <div key={prf.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{prf.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {prf.submitter} • {prf.category}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-medium text-sm">{formatCurrency(prf.amount)}</p>
                      {getStatusBadge(prf.status)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      <Card className="dashboard-card border-warning/20 bg-warning/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Budget Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate("/budget")}
              className={cn(
                "w-full text-left flex items-center gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg",
                "hover:bg-warning/15 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Software Licenses near limit</p>
                <p className="text-xs text-muted-foreground">
                  89% utilized - Only {formatCurrency(1100000)} remaining
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => navigate("/budget")}
              className={cn(
                "w-full text-left flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg",
                "hover:bg-destructive/15 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">3 PRFs exceed available budget</p>
                <p className="text-xs text-muted-foreground">
                  Requires manager approval or budget reallocation
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
