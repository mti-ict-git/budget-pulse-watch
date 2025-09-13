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

const budgetCategories = [
  { name: "IT Consumables", utilized: 72, remaining: 2800000, total: 10000000 },
  { name: "Internet Services", utilized: 45, remaining: 5500000, total: 10000000 },
  { name: "Software Licenses", utilized: 89, remaining: 1100000, total: 10000000 },
  { name: "Hardware", utilized: 34, remaining: 13200000, total: 20000000 },
];

const recentPRFs = [
  { id: "PRF-2024-248", submitter: "John Doe", amount: 2500000, status: "pending", category: "IT Consumables" },
  { id: "PRF-2024-247", submitter: "Jane Smith", amount: 750000, status: "approved", category: "Software Licenses" },
  { id: "PRF-2024-246", submitter: "Bob Wilson", amount: 1200000, status: "over_budget", category: "Internet Services" },
  { id: "PRF-2024-245", submitter: "Alice Johnson", amount: 3200000, status: "approved", category: "Hardware" },
];

const getStatusBadge = (status: string) => {
  const statusConfig = {
    pending: { label: "Pending", variant: "secondary" as const },
    approved: { label: "Approved", variant: "default" as const },
    over_budget: { label: "Over Budget", variant: "destructive" as const }
  };
  
  const config = statusConfig[status as keyof typeof statusConfig];
  return <Badge variant={config.variant}>{config.label}</Badge>;
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
              {recentPRFs.map((prf) => (
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
              ))}
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
            <div className="flex items-center gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Software Licenses near limit</p>
                <p className="text-xs text-muted-foreground">
                  89% utilized - Only {formatCurrency(1100000)} remaining
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
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
  );
}