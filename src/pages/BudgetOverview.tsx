import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Wallet, TrendingDown, TrendingUp, AlertTriangle, Download, RefreshCw, Plus, Search, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { budgetService, type CostCodeBudget, type BudgetSummary, type Budget, type BudgetQueryParams } from '@/services/budgetService';
import { BudgetCreateDialog } from '@/components/budget/BudgetCreateDialog';
import { BudgetEditDialog } from '@/components/budget/BudgetEditDialog';
import { toast } from "sonner";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

const getStatusBadge = (status: string) => {
  const statusConfig = {
    'On Track': { label: "On Track", variant: "default" as const },
    'Under Budget': { label: "Under Budget", variant: "secondary" as const },
    'Over Budget': { label: "Over Budget", variant: "destructive" as const }
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: "outline" as const };
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
  const [budgetData, setBudgetData] = useState<CostCodeBudget[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [fiscalYearFilter, setFiscalYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);

  const loadBudgetData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await budgetService.getCostCodeBudgets();
      
      if (response.success && response.data) {
        setBudgetData(response.data.costCodes);
        setBudgetSummary(response.data.summary);
      } else {
        setError(response.message || 'Failed to load budget data');
      }
    } catch (err) {
      setError('Failed to load budget data');
      console.error('Error loading budget data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBudgets = useCallback(async () => {
    try {
      const params: BudgetQueryParams = {
        page: 1,
        limit: 100,
        search: searchTerm || undefined,
        fiscalYear: fiscalYearFilter !== 'all' ? parseInt(fiscalYearFilter, 10) : undefined,
      };

      const response = await budgetService.getBudgets(params);
      
      if (response.success && response.data) {
        setBudgets(response.data);
      } else {
        setError(response.message || 'Failed to load budgets');
      }
    } catch (err) {
      setError('Failed to load budgets');
      console.error('Error loading budgets:', err);
    }
  }, [searchTerm, fiscalYearFilter]);

  const handleDeleteBudget = async (budgetId: number) => {
    if (!confirm('Are you sure you want to delete this budget?')) {
      return;
    }

    try {
      const response = await budgetService.deleteBudget(budgetId);
      
      if (response.success) {
        toast.success('Budget deleted successfully');
        loadBudgets();
        loadBudgetData(); // Refresh summary data
      } else {
        toast.error(response.message || 'Failed to delete budget');
      }
    } catch (err) {
      toast.error('Failed to delete budget');
      console.error('Error deleting budget:', err);
    }
  };

  const handleEditBudget = (budget: Budget) => {
    setSelectedBudget(budget);
    setEditDialogOpen(true);
  };

  const handleBudgetCreated = () => {
    loadBudgets();
    loadBudgetData(); // Refresh summary data
    setCreateDialogOpen(false);
  };

  const handleBudgetUpdated = () => {
    loadBudgets();
    loadBudgetData(); // Refresh summary data
    setEditDialogOpen(false);
    setSelectedBudget(null);
  };

  useEffect(() => {
    loadBudgetData();
    loadBudgets();
  }, [loadBudgets]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  const totalInitialBudget = budgetSummary?.totalBudgetAllocated || budgetSummary?.totalBudget || 0;
  const totalSpent = budgetSummary?.totalBudgetApproved || budgetSummary?.totalSpent || 0;
  const totalRemaining = totalInitialBudget - totalSpent;
  const overallUtilization = budgetSummary?.overallUtilization || 0;
  const alertCount = budgetData.filter(b => b.BudgetStatus === 'Over Budget').length;

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadBudgetData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Budget
          </Button>
        </div>
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
                <p className="text-2xl font-bold text-warning">{alertCount}</p>
                <p className="text-xs text-muted-foreground">Categories need attention</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search budgets by COA name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={fiscalYearFilter} onValueChange={setFiscalYearFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Fiscal Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="On Track">On Track</SelectItem>
                  <SelectItem value="Under Budget">Under Budget</SelectItem>
                  <SelectItem value="Over Budget">Over Budget</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Details Table */}
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>Budget Details by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading budget data...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              <span className="ml-2">{error}</span>
            </div>
          ) : (
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
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetData.map((budget, index) => {
                    const totalAllocated = budget.GrandTotalAllocated || 0;
                    const totalSpent = budget.GrandTotalApproved || 0;
                    const remainingAmount = totalAllocated - totalSpent;
                    
                    return (
                      <TableRow key={`${budget.PurchaseCostCode}-${index}`}>
                        <TableCell className="font-medium">{budget.PurchaseCostCode}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{budget.COAName || `Cost Code ${budget.PurchaseCostCode}`}</div>
                            {budget.COACode && (
                              <div className="text-sm text-muted-foreground">{budget.COACode}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(totalAllocated)}</TableCell>
                        <TableCell>{formatCurrency(totalSpent)}</TableCell>
                        <TableCell className={cn(
                          "font-medium",
                          remainingAmount < 0 ? "text-destructive" : "text-foreground"
                        )}>
                          {formatCurrency(remainingAmount)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={cn("text-sm font-medium", getUtilizationColor(budget.UtilizationPercentage || 0))}>
                                {(budget.UtilizationPercentage || 0).toFixed(1)}%
                              </span>
                            </div>
                            <Progress 
                              value={Math.min(budget.UtilizationPercentage || 0, 100)} 
                              className={cn("h-2", getProgressColor(budget.UtilizationPercentage || 0))}
                            />
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(budget.BudgetStatus)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditBudget({
                                BudgetID: parseInt(budget.PurchaseCostCode) || 0,
                                AllocatedAmount: budget.GrandTotalAllocated || 0,
                                COAID: parseInt(budget.COACode) || 0,
                                FiscalYear: new Date().getFullYear(),
                                UtilizedAmount: budget.GrandTotalActual || 0,
                                RemainingAmount: (budget.GrandTotalAllocated || 0) - (budget.GrandTotalActual || 0),
                                UtilizationPercentage: budget.GrandTotalAllocated ? ((budget.GrandTotalActual || 0) / budget.GrandTotalAllocated) * 100 : 0,
                                CreatedBy: 1, // Default user ID, should be replaced with actual user ID from auth context
                                CreatedAt: new Date(),
                                UpdatedAt: new Date()
                              })}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteBudget(parseInt(budget.PurchaseCostCode) || 0)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Components */}
      <BudgetCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleBudgetCreated}
      />

      {selectedBudget && (
        <BudgetEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          budget={selectedBudget}
          onSuccess={handleBudgetUpdated}
        />
      )}
    </div>
  );
}