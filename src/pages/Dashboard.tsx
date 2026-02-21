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
import { cn } from "@/lib/utils";

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

type PrfStatus = "pending" | "approved" | "over_budget";

const budgetCategories = [
  { name: "IT Consumables", utilized: 72, remaining: 2800000, total: 10000000 },
  { name: "Internet Services", utilized: 45, remaining: 5500000, total: 10000000 },
  { name: "Software Licenses", utilized: 89, remaining: 1100000, total: 10000000 },
  { name: "Hardware", utilized: 34, remaining: 13200000, total: 20000000 },
];

const recentPRFs: Array<{
  id: string;
  submitter: string;
  amount: number;
  status: PrfStatus;
  category: string;
}> = [
  { id: "PRF-2024-248", submitter: "John Doe", amount: 2500000, status: "pending", category: "IT Consumables" },
  { id: "PRF-2024-247", submitter: "Jane Smith", amount: 750000, status: "approved", category: "Software Licenses" },
  { id: "PRF-2024-246", submitter: "Bob Wilson", amount: 1200000, status: "over_budget", category: "Internet Services" },
  { id: "PRF-2024-245", submitter: "Alice Johnson", amount: 3200000, status: "approved", category: "Hardware" },
];

const getStatusBadge = (status: PrfStatus) => {
  const statusConfig: Record<PrfStatus, { label: string; variant: "secondary" | "default" | "destructive"; className: string }> = {
    pending: { label: "Pending", variant: "secondary", className: "bg-muted text-muted-foreground" },
    approved: { label: "Approved", variant: "default", className: "bg-success/10 text-success hover:bg-success/15" },
    over_budget: { label: "Over Budget", variant: "destructive", className: "bg-destructive/10 text-destructive hover:bg-destructive/15" }
  };

  const config = statusConfig[status];
  return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        <div className="metronic-card p-5 lg:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-semibold text-foreground">Dashboard</h1>
                <Badge variant="secondary" className="bg-muted text-muted-foreground">FY 2024</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor your purchase orders and budget utilization
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/20 text-primary">Overview</Badge>
              <Badge variant="outline" className="border-border/60 text-muted-foreground">Updated today</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {metrics.map((metric, index) => (
            <MetricCard key={index} {...metric} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <Card className="metronic-card">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Budget Utilization by Category
                </CardTitle>
                <Badge variant="secondary" className="bg-muted text-muted-foreground">CAPEX + OPEX</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {budgetCategories.map((category) => (
                <div key={category.name} className="space-y-3 rounded-lg border border-border/60 bg-muted/40 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{category.name}</span>
                    <span className="text-muted-foreground">{category.utilized}%</span>
                  </div>
                  <Progress
                    value={category.utilized}
                    className="h-2.5 bg-muted/60"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Remaining: {formatCurrency(category.remaining)}</span>
                    <span>Total: {formatCurrency(category.total)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="metronic-card">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <FileText className="h-5 w-5 text-primary" />
                  Recent PRFs
                </CardTitle>
                <Badge variant="secondary" className="bg-muted text-muted-foreground">Last 7 days</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {recentPRFs.map((prf) => (
                  <div key={prf.id} className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/40 p-3">
                    <div className="space-y-1">
                      <p className="font-medium text-sm text-foreground">{prf.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {prf.submitter} • {prf.category}
                      </p>
                    </div>
                    <div className="text-right space-y-2">
                      <p className="font-semibold text-sm">{formatCurrency(prf.amount)}</p>
                      {getStatusBadge(prf.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="metronic-card border-l-4 border-l-warning">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Budget Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-warning/20 bg-warning/5 p-3">
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Software Licenses near limit</p>
                  <p className="text-xs text-muted-foreground">
                    89% utilized - Only {formatCurrency(1100000)} remaining
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">3 PRFs exceed available budget</p>
                  <p className="text-xs text-muted-foreground">
                    Requires manager approval or budget reallocation
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
