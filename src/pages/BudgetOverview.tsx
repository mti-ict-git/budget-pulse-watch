import React, { useState, useEffect } from 'react';
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
import { budgetService, getUtilizationData, getUnallocatedBudgets, type CostCodeBudget, type BudgetSummary, type Budget, type DashboardMetrics, type UtilizationData, type UnallocatedBudgetData } from '@/services/budgetService';
import { UtilizationChart } from '@/components/budget/UtilizationChart';
import UnallocatedBudgets from '@/components/budget/UnallocatedBudgets';
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
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [utilizationData, setUtilizationData] = useState<UtilizationData[]>([]);
  const [unallocatedBudgets, setUnallocatedBudgets] = useState<UnallocatedBudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [fiscalYearFilter, setFiscalYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<string>('all');
  
  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(new Date().getFullYear().toString());

  const loadBudgetData = async (searchParams?: { search?: string; status?: string; fiscalYear?: number | string }) => {
    try {
      setLoading(true);
      setError(null);

      // Determine the fiscal year to use
      let fiscalYear: number | undefined;
      if (searchParams?.fiscalYear !== undefined) {
        fiscalYear = typeof searchParams.fiscalYear === 'string' && searchParams.fiscalYear !== 'all' 
          ? parseInt(searchParams.fiscalYear) 
          : typeof searchParams.fiscalYear === 'number' 
            ? searchParams.fiscalYear 
            : undefined;
      } else if (selectedFiscalYear !== 'all') {
        fiscalYear = parseInt(selectedFiscalYear);
      }
      
      // Load budget data, dashboard metrics, utilization data, and unallocated budgets in parallel
       const [budgetResponse, dashboardResponse, utilizationResponse, unallocatedResponse] = await Promise.all([
         budgetService.getCostCodeBudgets({
           search: searchParams?.search,
           fiscalYear: fiscalYear
         }),
         budgetService.getDashboardMetrics(fiscalYear),
         getUtilizationData(fiscalYear),
         getUnallocatedBudgets(fiscalYear)
       ]);

      if (budgetResponse.success && budgetResponse.data) {
        setBudgetData(budgetResponse.data.costCodes);
        setBudgetSummary(budgetResponse.data.summary);
      } else {
        setError(budgetResponse.message || 'Failed to load budget data');
      }

      // Dashboard metrics - extract data from response
      if (dashboardResponse.success && dashboardResponse.data) {
        setDashboardMetrics(dashboardResponse.data);
      } else {
        setDashboardMetrics(null);
      }

      // Utilization data - direct array response
      setUtilizationData(utilizationResponse || []);

      // Unallocated budgets - direct data response
      setUnallocatedBudgets(unallocatedResponse || null);
    } catch (error) {
      console.error('Error loading budget data:', error);
      setError('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBudget = async (budgetId: number) => {
    if (!confirm('Are you sure you want to delete this budget?')) {
      return;
    }

    try {
      const response = await budgetService.deleteBudget(budgetId);
      
      if (response.success) {
        toast.success('Budget deleted successfully');
        loadBudgetData(); // Refresh data
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

  const handleEditCostCodeBudget = async (costCodeBudget: CostCodeBudget) => {
    try {
      setLoading(true);
      
      // First, get the COA by code to get the COAID
      const coaResponse = await fetch(`/api/coa/code/${encodeURIComponent(costCodeBudget.COACode)}`);
      const coaData = await coaResponse.json();
      
      if (!coaData.success || !coaData.data) {
        console.error('COA not found for code:', costCodeBudget.COACode);
        setError(`Chart of Account not found for code: ${costCodeBudget.COACode}`);
        setLoading(false);
        return;
      }
      
      const coa = coaData.data;
      
      // Try to get existing budget for this COA and current fiscal year
      const budgetResponse = await fetch(`/api/budgets/coa/${coa.COAID}/year/${selectedFiscalYear}`);
      const budgetData = await budgetResponse.json();
      
      let budget: Budget;
      
      if (budgetData.success && budgetData.data) {
        // Use existing budget
        budget = budgetData.data;
      } else {
        // Create a new budget object for creation
        budget = {
          BudgetID: 0, // 0 indicates new budget
          COAID: coa.COAID,
          COACode: coa.COACode,
          Department: coa.Department,
          ExpenseType: coa.ExpenseType,
          FiscalYear: selectedFiscalYear,
          AllocatedAmount: 0,
          UtilizedAmount: costCodeBudget.GrandTotalActual || 0,
          RemainingAmount: 0,
          UtilizationPercentage: 0,
          CreatedBy: 1, // Should be replaced with actual user ID from auth context
          CreatedAt: new Date(),
          UpdatedAt: new Date()
        };
      }
      
      setSelectedBudget(budget);
      setEditDialogOpen(true);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching budget data for edit:', error);
      setError('Failed to load budget data for editing');
      setLoading(false);
    }
  };

  const handleBudgetCreated = () => {
    loadBudgetData(); // Refresh data
    setCreateDialogOpen(false);
  };

  const handleBudgetUpdated = () => {
    loadBudgetData(); // Refresh summary data
    setEditDialogOpen(false);
    setSelectedBudget(null);
  };

  // Initial load
  useEffect(() => {
    loadBudgetData();
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const searchParams = {
        search: searchTerm || undefined,
        fiscalYear: fiscalYearFilter !== 'all' ? fiscalYearFilter : 'all',
        status: statusFilter !== 'all' ? statusFilter : undefined,
        expenseType: expenseTypeFilter !== 'all' ? expenseTypeFilter as 'CAPEX' | 'OPEX' : undefined,
      };
      loadBudgetData(searchParams);
    }, 300); // 300ms delay

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fiscalYearFilter, statusFilter, expenseTypeFilter]);

  // Use dashboard metrics if available, fallback to budget summary
  const totalInitialBudget = dashboardMetrics?.budget.totalBudget || budgetSummary?.totalBudgetAllocated || budgetSummary?.totalBudget || 0;
  const totalSpent = dashboardMetrics?.budget.totalSpent || budgetSummary?.totalBudgetApproved || budgetSummary?.totalSpent || 0;
  const totalRemaining = dashboardMetrics?.budget.totalRemaining || (totalInitialBudget - totalSpent);
  const overallUtilization = dashboardMetrics?.budget.overallUtilization || budgetSummary?.overallUtilization || 0;
  const alertCount = dashboardMetrics?.budget.overBudgetCount || budgetData.filter(b => b.BudgetStatus === 'Over Budget').length;
  
  // CAPEX and OPEX utilization data is now handled by the UtilizationChart component using utilizationData

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Budget Overview</h1>
            <p className="text-muted-foreground mt-1">
              Monitor budget allocation and utilization across categories
            </p>
          </div>
          <div className="flex gap-2 w-full lg:w-auto">
            <Button variant="outline" onClick={() => loadBudgetData()} disabled={loading} className="flex-1 lg:flex-none">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="outline" className="flex-1 lg:flex-none">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)} className="flex-1 lg:flex-none">
              <Plus className="h-4 w-4" />
              Create Budget
            </Button>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full lg:w-auto">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search budgets by code, name, category, or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select 
                value={selectedFiscalYear} 
                onValueChange={(value) => {
                  setSelectedFiscalYear(value);
                  setFiscalYearFilter(value);
                  loadBudgetData({ fiscalYear: value });
                }}
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Fiscal Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                  <SelectItem value="2021">2021</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="On Track">On Track</SelectItem>
                  <SelectItem value="Under Budget">Under Budget</SelectItem>
                  <SelectItem value="Over Budget">Over Budget</SelectItem>
                </SelectContent>
              </Select>
              <Select value={expenseTypeFilter} onValueChange={setExpenseTypeFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Expense Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CAPEX">CAPEX</SelectItem>
                  <SelectItem value="OPEX">OPEX</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <Card className="metric-card min-h-[120px]">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Budget</p>
                <p className="text-xl lg:text-2xl font-bold break-words">{formatCurrency(totalInitialBudget)}</p>
              </div>
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card min-h-[120px]">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
                <p className="text-xl lg:text-2xl font-bold break-words">{formatCurrency(totalSpent)}</p>
                <p className="text-xs text-muted-foreground">
                  {overallUtilization.toFixed(1)}% utilized
                </p>
              </div>
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-expense/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 lg:h-6 lg:w-6 text-expense" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card min-h-[120px]">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Remaining</p>
                <p className={cn("text-xl lg:text-2xl font-bold break-words", totalRemaining < 0 ? "text-destructive" : "text-foreground")}>
                  {formatCurrency(totalRemaining)}
                </p>
              </div>
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 lg:h-6 lg:w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="metric-card min-h-[120px]">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Alerts</p>
                <p className="text-xl lg:text-2xl font-bold text-warning">{alertCount}</p>
                <p className="text-xs text-muted-foreground">Categories need attention</p>
              </div>
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 lg:h-6 lg:w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Utilization Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6 mb-6">
        <UtilizationChart
          title="CAPEX Utilization"
          data={utilizationData}
          expenseType="CAPEX"
          className="min-h-[350px]"
        />
        
        <UtilizationChart
          title="OPEX Utilization"
          data={utilizationData}
          expenseType="OPEX"
          className="min-h-[350px]"
        />
      </div>



      {/* Unallocated Budgets Section - Hidden per user request */}
       {/* <UnallocatedBudgets 
         data={unallocatedBudgets}
         loading={loading}
       /> */}



      {/* Budget Details Table */}
      <Card className="mt-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Budget Details by Category</CardTitle>
          <p className="text-sm text-muted-foreground">
            {budgetData.length} budget{budgetData.length !== 1 ? 's' : ''} found
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading budget data...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-destructive">
              <AlertTriangle className="h-6 w-6" />
              <span className="ml-2">{error}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b">
                    <TableHead className="min-w-[120px]">COA</TableHead>
                    <TableHead className="min-w-[200px]">Category</TableHead>
                    <TableHead className="min-w-[120px]">Department</TableHead>
                    <TableHead className="min-w-[80px]">Type</TableHead>
                    <TableHead className="min-w-[120px] text-right">Initial Budget</TableHead>
                    <TableHead className="min-w-[100px] text-right">Spent</TableHead>
                    <TableHead className="min-w-[120px] text-right">Remaining</TableHead>
                    <TableHead className="min-w-[120px]">Utilization</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                        No budgets found matching your criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    budgetData.map((budget, index) => {
                      const totalAllocated = budget.GrandTotalAllocated || 0;
                      const totalSpent = budget.GrandTotalApproved || 0;
                      const remainingAmount = totalAllocated - totalSpent;
                      
                      return (
                        <TableRow key={`${budget.PurchaseCostCode}-${index}`} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{budget.PurchaseCostCode}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium max-w-[180px] truncate" title={budget.COAName || `Cost Code ${budget.PurchaseCostCode}`}>
                                {budget.COAName || `Cost Code ${budget.PurchaseCostCode}`}
                              </div>
                              {budget.COACode && (
                                <div className="text-sm text-muted-foreground">{budget.COACode}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground max-w-[100px] truncate" title={budget.Department || 'N/A'}>
                              {budget.Department || 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                              budget.ExpenseType === 'CAPEX' 
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                : budget.ExpenseType === 'OPEX'
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            )}>
                              {budget.ExpenseType || 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(totalAllocated)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(totalSpent)}</TableCell>
                          <TableCell className={cn(
                            "text-right font-medium",
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
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditCostCodeBudget(budget)}>
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
                    })
                  )}
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
    </div>
  );
}