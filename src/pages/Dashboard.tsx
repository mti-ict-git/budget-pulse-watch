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
import { budgetService, type DashboardMetrics } from "@/services/budgetService";

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

interface AlertHighUtilizationBudget {
  BudgetID: number;
  FiscalYear: number;
  AllocatedAmount: number;
  UtilizedAmount: number;
  UtilizationPercentage: number;
  COACode: string;
  COAName: string;
  UtilizationLevel: string;
}

interface AlertOverBudgetPRF {
  PRFID: number;
  PRFNo: string;
  Department: string;
  Amount: number;
  BudgetAllocated: number;
  COACode: string;
  COAName: string;
}

interface AlertPendingApproval {
  PRFID: number;
  PRFNo: string;
  Department: string;
  RequestDate: string;
  MaxLevel: number;
}

interface AlertsResponse {
  success: boolean;
  data?: {
    overBudgetPRFs: AlertOverBudgetPRF[];
    highUtilizationBudgets: AlertHighUtilizationBudget[];
    pendingApprovals: AlertPendingApproval[];
    totalAlerts: number;
  };
  message?: string;
}

interface BudgetSummaryRow {
  Category: string;
  ExpenseType: string;
  BudgetCount: number;
  TotalAllocated: number;
  TotalSpent: number;
  TotalRemaining: number;
  UtilizationPercentage: number;
}

interface BudgetSummaryResponse {
  success: boolean;
  data?: BudgetSummaryRow[];
  message?: string;
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
  const currentYear = new Date().getFullYear();
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState<boolean>(false);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryRow[]>([]);
  const [budgetSummaryLoading, setBudgetSummaryLoading] = useState<boolean>(false);
  const [budgetSummaryError, setBudgetSummaryError] = useState<string | null>(null);
  const [recentPRFs, setRecentPRFs] = useState<RecentPRFItem[]>([]);
  const [recentPRFsLoading, setRecentPRFsLoading] = useState<boolean>(false);
  const [recentPRFsError, setRecentPRFsError] = useState<string | null>(null);
  const [highUtilizationBudgets, setHighUtilizationBudgets] = useState<AlertHighUtilizationBudget[]>([]);
  const [overBudgetPRFs, setOverBudgetPRFs] = useState<AlertOverBudgetPRF[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<AlertPendingApproval[]>([]);
  const [alertsLoading, setAlertsLoading] = useState<boolean>(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);

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

  const fetchDashboardMetrics = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const result = await budgetService.getDashboardMetrics(currentYear);
      if (!result.success || !result.data) {
        throw new Error(result.message || "Failed to fetch dashboard metrics");
      }
      setDashboardMetrics(result.data);
    } catch (error) {
      setDashboardMetrics(null);
      setDashboardError(error instanceof Error ? error.message : "Failed to fetch dashboard metrics");
    } finally {
      setDashboardLoading(false);
    }
  }, [currentYear]);

  const fetchBudgetSummary = useCallback(async () => {
    setBudgetSummaryLoading(true);
    setBudgetSummaryError(null);
    try {
      const response = await fetch(`/api/reports/budget-summary?fiscalYear=${currentYear}`, {
        headers: authService.getAuthHeaders(),
      });
      const result: BudgetSummaryResponse = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || "Failed to fetch budget summary");
      }
      setBudgetSummary(result.data);
    } catch (error) {
      setBudgetSummary([]);
      setBudgetSummaryError(error instanceof Error ? error.message : "Failed to fetch budget summary");
    } finally {
      setBudgetSummaryLoading(false);
    }
  }, [currentYear]);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const response = await fetch(`/api/reports/alerts?fiscalYear=${currentYear}`, {
        headers: authService.getAuthHeaders(),
      });
      const result: AlertsResponse = await response.json();
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "Failed to fetch alerts");
      }
      setHighUtilizationBudgets(result.data.highUtilizationBudgets ?? []);
      setOverBudgetPRFs(result.data.overBudgetPRFs ?? []);
      setPendingApprovals(result.data.pendingApprovals ?? []);
    } catch (error) {
      setHighUtilizationBudgets([]);
      setOverBudgetPRFs([]);
      setPendingApprovals([]);
      setAlertsError(error instanceof Error ? error.message : "Failed to fetch alerts");
    } finally {
      setAlertsLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    fetchRecentPRFs();
    fetchDashboardMetrics();
    fetchBudgetSummary();
    fetchAlerts();
  }, [fetchRecentPRFs, fetchDashboardMetrics, fetchBudgetSummary, fetchAlerts]);

  const metrics = [
    {
      title: `Total PRFs (${currentYear})`,
      value: dashboardMetrics?.prfs.totalPRFs ?? 0,
      change: `${dashboardMetrics?.prfs.rejectedPRFs ?? 0} rejected`,
      changeType: ((dashboardMetrics?.prfs.rejectedPRFs ?? 0) > 0 ? "negative" : "neutral") as const,
      icon: FileText
    },
    {
      title: "Approved PRFs",
      value: dashboardMetrics?.prfs.approvedPRFs ?? 0,
      change: dashboardMetrics
        ? `${dashboardMetrics.prfs.totalPRFs > 0 ? Math.round((dashboardMetrics.prfs.approvedPRFs / dashboardMetrics.prfs.totalPRFs) * 100) : 0}% approval rate`
        : "-",
      changeType: "positive" as const,
      icon: CheckCircle
    },
    {
      title: "Pending PRFs",
      value: dashboardMetrics?.prfs.pendingPRFs ?? 0,
      change: `${overBudgetPRFs.length} over budget`,
      changeType: (overBudgetPRFs.length > 0 ? "negative" : "neutral") as const,
      icon: Clock
    },
    {
      title: "Budget Utilization",
      value: `${Math.round(Number(dashboardMetrics?.budget.overallUtilization ?? 0))}%`,
      change: `Remaining ${formatCurrency(Number(dashboardMetrics?.budget.totalRemaining ?? 0))}`,
      changeType: "neutral" as const,
      icon: TrendingUp
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your purchase orders and budget utilization
        </p>
        {dashboardError && (
          <p className="text-sm text-destructive mt-2">{dashboardError}</p>
        )}
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
            {budgetSummaryLoading ? (
              <p className="text-sm text-muted-foreground">Loading budget utilization...</p>
            ) : budgetSummaryError ? (
              <p className="text-sm text-destructive">{budgetSummaryError}</p>
            ) : budgetSummary.length > 0 ? (
              budgetSummary.map((row) => (
              <div key={`${row.ExpenseType}-${row.Category}`} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{row.Category || row.ExpenseType || "Uncategorized"}</span>
                  <span className="text-muted-foreground">{Math.round(Number(row.UtilizationPercentage))}%</span>
                </div>
                <Progress 
                  value={Number(row.UtilizationPercentage)} 
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Remaining: {formatCurrency(Math.max(Number(row.TotalRemaining), 0))}</span>
                  <span>Total: {formatCurrency(Number(row.TotalAllocated))}</span>
                </div>
              </div>
              ))
            ) : (dashboardMetrics?.expenseBreakdown.length ?? 0) > 0 ? (
              dashboardMetrics!.expenseBreakdown.map((category) => (
              <div key={category.expenseType} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{category.expenseType}</span>
                  <span className="text-muted-foreground">{Math.round(Number(category.utilization))}%</span>
                </div>
                <Progress 
                  value={Number(category.utilization)} 
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Remaining: {formatCurrency(Math.max(Number(category.totalAllocated) - Number(category.totalSpent), 0))}</span>
                  <span>Total: {formatCurrency(Number(category.totalAllocated))}</span>
                </div>
              </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No budget utilization data available.</p>
            )}
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
            {alertsLoading ? (
              <p className="text-sm text-muted-foreground">Loading alerts...</p>
            ) : alertsError ? (
              <p className="text-sm text-destructive">{alertsError}</p>
            ) : (
              <>
                {highUtilizationBudgets.slice(0, 2).map((alert) => (
                  <button
                    key={`hu-${alert.BudgetID}`}
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
                      <p className="font-medium text-sm">{alert.COAName} near limit</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(Number(alert.UtilizationPercentage))}% utilized - Remaining {formatCurrency(Math.max(Number(alert.AllocatedAmount) - Number(alert.UtilizedAmount), 0))}
                      </p>
                    </div>
                  </button>
                ))}
                {overBudgetPRFs.slice(0, 2).map((alert) => (
                  <button
                    key={`ob-${alert.PRFID}`}
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
                      <p className="font-medium text-sm">{alert.PRFNo} exceeds budget</p>
                      <p className="text-xs text-muted-foreground">
                        PRF {formatCurrency(Number(alert.Amount))} vs budget {formatCurrency(Number(alert.BudgetAllocated))}
                      </p>
                    </div>
                  </button>
                ))}
                {pendingApprovals.slice(0, 2).map((alert) => (
                  <button
                    key={`pa-${alert.PRFID}`}
                    type="button"
                    onClick={() => navigate("/prf")}
                    className={cn(
                      "w-full text-left flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg",
                      "hover:bg-primary/15 transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    )}
                  >
                    <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{alert.PRFNo} pending approval</p>
                      <p className="text-xs text-muted-foreground">
                        {alert.Department} • level {alert.MaxLevel}
                      </p>
                    </div>
                  </button>
                ))}
                {highUtilizationBudgets.length === 0 && overBudgetPRFs.length === 0 && pendingApprovals.length === 0 && (
                  <p className="text-sm text-muted-foreground">No active budget alerts.</p>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
