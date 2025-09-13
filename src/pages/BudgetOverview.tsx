import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, TrendingDown, TrendingUp, AlertTriangle, Download } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock budget data
const budgetData = [
  {
    coa: "COA-001",
    category: "IT Consumables",
    initialBudget: 10000000,
    spentAmount: 7200000,
    remainingBudget: 2800000,
    utilizationPercent: 72,
    status: "healthy"
  },
  {
    coa: "COA-002",
    category: "Internet Services",
    initialBudget: 10000000,
    spentAmount: 4500000,
    remainingBudget: 5500000,
    utilizationPercent: 45,
    status: "healthy"
  },
  {
    coa: "COA-003",
    category: "Software Licenses",
    initialBudget: 10000000,
    spentAmount: 8900000,
    remainingBudget: 1100000,
    utilizationPercent: 89,
    status: "warning"
  },
  {
    coa: "COA-004",
    category: "Hardware",
    initialBudget: 20000000,
    spentAmount: 6800000,
    remainingBudget: 13200000,
    utilizationPercent: 34,
    status: "healthy"
  },
  {
    coa: "COA-005",
    category: "Training & Development",
    initialBudget: 5000000,
    spentAmount: 5200000,
    remainingBudget: -200000,
    utilizationPercent: 104,
    status: "overspent"
  }
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

const getStatusBadge = (status: string) => {
  const statusConfig = {
    healthy: { label: "Healthy", variant: "default" as const },
    warning: { label: "Warning", variant: "warning" as const },
    overspent: { label: "Overspent", variant: "destructive" as const }
  };
  
  const config = statusConfig[status as keyof typeof statusConfig];
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getUtilizationColor = (percent: number) => {
  if (percent > 100) return "text-destructive";
  if (percent > 80) return "text-warning";
  return "text-foreground";
};

const getProgressColor = (percent: number) => {
  if (percent > 100) return "bg-destructive";
  if (percent > 80) return "bg-warning";
  return "";
};

export default function BudgetOverview() {
  const totalInitialBudget = budgetData.reduce((sum, item) => sum + item.initialBudget, 0);
  const totalSpent = budgetData.reduce((sum, item) => sum + item.spentAmount, 0);
  const totalRemaining = budgetData.reduce((sum, item) => sum + item.remainingBudget, 0);
  const overallUtilization = (totalSpent / totalInitialBudget) * 100;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Budget Overview</h1>
          <p className="text-muted-foreground">
            Monitor budget allocation and utilization across categories
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold">{formatCurrency(totalInitialBudget)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold">{formatCurrency(totalSpent)}</p>
                <p className="text-xs text-muted-foreground">
                  {overallUtilization.toFixed(1)}% utilized
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-expense/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-expense" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Remaining</p>
                <p className={cn("text-2xl font-bold", totalRemaining < 0 ? "text-destructive" : "text-foreground")}>
                  {formatCurrency(totalRemaining)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Alerts</p>
                <p className="text-2xl font-bold text-warning">2</p>
                <p className="text-xs text-muted-foreground">Categories need attention</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Details Table */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Budget Details by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>COA</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Initial Budget</TableHead>
                  <TableHead>Spent</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgetData.map((budget) => (
                  <TableRow key={budget.coa}>
                    <TableCell className="font-medium">{budget.coa}</TableCell>
                    <TableCell>{budget.category}</TableCell>
                    <TableCell>{formatCurrency(budget.initialBudget)}</TableCell>
                    <TableCell>{formatCurrency(budget.spentAmount)}</TableCell>
                    <TableCell className={cn(
                      "font-medium",
                      budget.remainingBudget < 0 ? "text-destructive" : "text-foreground"
                    )}>
                      {formatCurrency(budget.remainingBudget)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-sm font-medium", getUtilizationColor(budget.utilizationPercent))}>
                            {budget.utilizationPercent}%
                          </span>
                        </div>
                        <Progress 
                          value={Math.min(budget.utilizationPercent, 100)} 
                          className={cn("h-2", getProgressColor(budget.utilizationPercent))}
                        />
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(budget.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}