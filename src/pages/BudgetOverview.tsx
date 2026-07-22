import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Wallet, TrendingDown, TrendingUp, AlertTriangle, Download, RefreshCw, Plus, Search, MoreHorizontal, Edit, Lock, LockOpen, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { budgetService, type CostCodeBudget, type BudgetSummary, type Budget, type DashboardMetrics, type UtilizationData, type BudgetCutoffState, type OpexImportRow, type OpexImportResult, type BudgetReadinessData, type BudgetReadinessItem } from '@/services/budgetService';
import { UtilizationChart } from '@/components/budget/UtilizationChart';
import { BudgetCreateDialog } from '@/components/budget/BudgetCreateDialog';
import { BudgetEditDialog } from '@/components/budget/BudgetEditDialog';
import { toast } from "sonner";
import { authService } from "@/services/authService";

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
    'Over Budget': { label: "Over Budget", variant: "destructive" as const },
    'No Budget': { label: "No Budget", variant: "outline" as const }
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

const BUDGET_OVERVIEW_DEPARTMENT = 'HR / IT';
const BUDGET_OVERVIEW_EXPENSE_TYPES = new Set(['CAPEX', 'OPEX']);

const isBudgetOverviewRowAllowed = (row: Pick<CostCodeBudget, 'Department' | 'ExpenseType'>) =>
  row.Department === BUDGET_OVERVIEW_DEPARTMENT && BUDGET_OVERVIEW_EXPENSE_TYPES.has(row.ExpenseType);

const buildBudgetSummaryFromRows = (rows: CostCodeBudget[]): BudgetSummary => {
  const totalBudgetAllocated = rows.reduce((sum, row) => sum + (row.GrandTotalAllocated || 0), 0);
  const totalBudgetRequested = rows.reduce((sum, row) => sum + (row.GrandTotalRequested || 0), 0);
  const totalBudgetApproved = rows.reduce((sum, row) => sum + (row.GrandTotalApproved || 0), 0);
  const totalBudgetActual = rows.reduce((sum, row) => sum + (row.GrandTotalActual || 0), 0);

  return {
    totalCostCodes: rows.length,
    totalBudgetAllocated,
    totalBudgetRequested,
    totalBudgetApproved,
    totalBudgetActual,
    overallUtilization: totalBudgetAllocated > 0 ? (totalBudgetApproved / totalBudgetAllocated) * 100 : 0,
    overallApprovalRate: totalBudgetRequested > 0 ? (totalBudgetApproved / totalBudgetRequested) * 100 : 0
  };
};

export default function BudgetOverview() {
  const [budgetData, setBudgetData] = useState<CostCodeBudget[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [utilizationData, setUtilizationData] = useState<UtilizationData[]>([]);
  const [readinessData, setReadinessData] = useState<BudgetReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<string>('all');
  
  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(new Date().getFullYear().toString());
  const [cutoffStatus, setCutoffStatus] = useState<BudgetCutoffState | null>(null);
  const [cutoffActionLoading, setCutoffActionLoading] = useState(false);
  const [carryForwardLoadingCoaId, setCarryForwardLoadingCoaId] = useState<number | null>(null);
  const [opexImporting, setOpexImporting] = useState(false);
  const [opexImportResult, setOpexImportResult] = useState<OpexImportResult | null>(null);
  const [opexPayload, setOpexPayload] = useState(`[
  {
    "coaCode": "MTIRMRAD496232",
    "allocatedAmount": 100000000,
    "department": "IT",
    "currencyCode": "IDR",
    "exchangeRateToIDR": 1,
    "budgetType": "Annual",
    "notes": "FY2026 OPEX import"
  }
]`);

  const canManageBudgets = authService.canManageContent();
  const canReopenCutoff = authService.isAdmin();
  const canApproveCarryForward = authService.isAdmin();
  const activeFiscalYear = selectedFiscalYear !== 'all' ? parseInt(selectedFiscalYear, 10) : null;
  const isFiscalClosed = cutoffStatus?.isClosed ?? false;

  const loadBudgetData = useCallback(async (searchParams?: {
    search?: string;
    status?: string;
    fiscalYear?: number | string;
    expenseType?: 'CAPEX' | 'OPEX';
  }) => {
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
      
      const requestedExpenseType = searchParams?.expenseType && searchParams.expenseType !== 'all'
        ? searchParams.expenseType
        : undefined;

      // Load budget data, dashboard metrics, and utilization data in parallel
       const readinessPromise = fiscalYear
         ? budgetService.getBudgetReadiness(fiscalYear)
         : Promise.resolve({ success: true } as const);

       const [budgetResponse, dashboardResponse, utilizationResponse, readinessResponse] = await Promise.all([
         budgetService.getCostCodeBudgets({
           search: searchParams?.search,
           fiscalYear: fiscalYear,
           department: BUDGET_OVERVIEW_DEPARTMENT,
           expenseType: requestedExpenseType
         }),
         budgetService.getDashboardMetrics(fiscalYear, BUDGET_OVERVIEW_DEPARTMENT),
         budgetService.getBudgetUtilization(fiscalYear, undefined, BUDGET_OVERVIEW_DEPARTMENT),
         readinessPromise
       ]);

      if (budgetResponse.success && budgetResponse.data) {
        const filteredCostCodes = budgetResponse.data.costCodes.filter((row) => {
          if (!isBudgetOverviewRowAllowed(row)) {
            return false;
          }

          if (requestedExpenseType) {
            return row.ExpenseType === requestedExpenseType;
          }

          return true;
        });

        setBudgetData(filteredCostCodes);
        setBudgetSummary(buildBudgetSummaryFromRows(filteredCostCodes));
      } else {
        setError(budgetResponse.message || 'Failed to load budget data');
      }

      // Dashboard metrics - extract data from response
      if (dashboardResponse.success && dashboardResponse.data) {
        setDashboardMetrics(dashboardResponse.data);
      } else {
        setDashboardMetrics(null);
      }

      if (utilizationResponse.success && utilizationResponse.data) {
        const filteredUtilization = utilizationResponse.data.filter((item) => {
          if (item.department !== BUDGET_OVERVIEW_DEPARTMENT) {
            return false;
          }

          if (requestedExpenseType) {
            return item.expenseType === requestedExpenseType;
          }

          return true;
        });

        setUtilizationData(filteredUtilization);
      } else {
        setUtilizationData([]);
      }

      if ('data' in readinessResponse && readinessResponse.success && readinessResponse.data) {
        setReadinessData(readinessResponse.data);
      } else {
        setReadinessData(null);
      }
    } catch (error) {
      console.error('Error loading budget data:', error);
      setError('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  }, [selectedFiscalYear]);

  const loadCutoffStatus = useCallback(async (fiscalYear: number | null) => {
    if (!fiscalYear) {
      setCutoffStatus(null);
      return;
    }

    const response = await budgetService.getCutoffStatus(fiscalYear);
    if (response.success && response.data) {
      setCutoffStatus(response.data);
    } else {
      setCutoffStatus(null);
      if (response.message) {
        toast.error(response.message);
      }
    }
  }, []);

  const handleCutoffAction = async (action: 'close' | 'reopen') => {
    if (!activeFiscalYear) {
      toast.error('Please select a specific fiscal year');
      return;
    }

    setCutoffActionLoading(true);
    try {
      const notes = action === 'close' ? 'Closed from Budget Overview' : 'Reopened from Budget Overview';
      const response = action === 'close'
        ? await budgetService.closeCutoff(activeFiscalYear, notes)
        : await budgetService.reopenCutoff(activeFiscalYear, notes);

      if (!response.success) {
        toast.error(response.message || 'Failed to update cutoff status');
        return;
      }

      toast.success(response.message || `Fiscal year ${activeFiscalYear} updated`);
      await loadCutoffStatus(activeFiscalYear);
      await loadBudgetData({ fiscalYear: activeFiscalYear });
    } finally {
      setCutoffActionLoading(false);
    }
  };

  const handleOpexImport = async () => {
    if (!activeFiscalYear) {
      toast.error('Please select a specific fiscal year');
      return;
    }

    let rows: OpexImportRow[] = [];
    try {
      const parsed = JSON.parse(opexPayload) as unknown;
      if (!Array.isArray(parsed)) {
        toast.error('OPEX payload must be a JSON array');
        return;
      }
      rows = parsed as OpexImportRow[];
    } catch {
      toast.error('Invalid JSON format for OPEX payload');
      return;
    }

    setOpexImporting(true);
    try {
      const response = await budgetService.importOpexBudgets(activeFiscalYear, rows);
      if (!response.success || !response.data) {
        toast.error(response.message || 'Failed to import OPEX rows');
        return;
      }

      setOpexImportResult(response.data);
      toast.success(response.message || 'OPEX import completed');
      await loadBudgetData({ fiscalYear: activeFiscalYear });
    } finally {
      setOpexImporting(false);
    }
  };

  const handleDeleteBudget = async (budgetId: number) => {
    if (isFiscalClosed) {
      toast.error(`Fiscal year ${activeFiscalYear} is closed`);
      return;
    }
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

  const openBudgetEditorByCoa = async (
    coaCode: string,
    department: string,
    expenseType: 'CAPEX' | 'OPEX',
    coaName?: string,
    utilizedAmount = 0
  ) => {
    try {
      setLoading(true);

      const coaResponse = await fetch(`/api/coa/code/${encodeURIComponent(coaCode)}`);
      const coaData = await coaResponse.json();

      if (!coaData.success || !coaData.data) {
        setError(`Chart of Account not found for code: ${coaCode}`);
        setLoading(false);
        return;
      }

      const coa = coaData.data;
      const budgetResponse = await fetch(`/api/budgets/coa/${coa.COAID}/year/${selectedFiscalYear}`);
      const budgetData = await budgetResponse.json();

      let budget: Budget;

      if (budgetData.success && budgetData.data) {
        budget = budgetData.data;
      } else {
        budget = {
          BudgetID: 0,
          COAID: coa.COAID,
          COACode: coa.COACode,
          COAName: coaName || coa.COAName,
          Department: department || coa.Department,
          ExpenseType: expenseType || coa.ExpenseType,
          FiscalYear: parseInt(selectedFiscalYear, 10),
          AllocatedAmount: 0,
          UtilizedAmount: utilizedAmount,
          RemainingAmount: 0,
          UtilizationPercentage: 0,
          CurrencyCode: 'IDR',
          ExchangeRateToIDR: 1,
          IsActive: true,
          Status: 'Active',
          CreatedBy: 1,
          CreatedAt: new Date(),
          UpdatedAt: new Date()
        };
      }

      setSelectedBudget(budget);
      setEditDialogOpen(true);
      setLoading(false);
    } catch (openError) {
      console.error('Error opening budget editor:', openError);
      setError('Failed to load budget data for editing');
      setLoading(false);
    }
  };

  const handleEditBudget = (budget: Budget) => {
    setSelectedBudget(budget);
    setEditDialogOpen(true);
  };

  const handleEditCostCodeBudget = async (costCodeBudget: CostCodeBudget) => {
    if (isFiscalClosed) {
      toast.error(`Fiscal year ${activeFiscalYear} is closed`);
      return;
    }
    await openBudgetEditorByCoa(
      costCodeBudget.COACode,
      costCodeBudget.Department,
      costCodeBudget.ExpenseType,
      costCodeBudget.COAName,
      costCodeBudget.GrandTotalActual || 0
    );
  };

  const handleEditReadinessItem = async (item: BudgetReadinessItem) => {
    if (isFiscalClosed) {
      toast.error(`Fiscal year ${activeFiscalYear} is closed`);
      return;
    }
    await openBudgetEditorByCoa(item.coaCode, item.department, item.expenseType, item.coaName);
  };

  const handleApplyCarryForward = async (item: BudgetReadinessItem) => {
    if (!activeFiscalYear) {
      toast.error('Please select a specific fiscal year');
      return;
    }

    setCarryForwardLoadingCoaId(item.coaId);
    try {
      const response = await budgetService.applyCarryForward(activeFiscalYear, {
        coaId: item.coaId,
        sourceFiscalYear: item.previousFiscalYear,
        amount: item.previousCarryForwardSourceAmount,
        notes: `Approved from Budget Overview for FY${activeFiscalYear}`
      });

      if (!response.success) {
        toast.error(response.message || 'Failed to apply carry forward');
        return;
      }

      toast.success(response.message || 'Carry forward applied');
      await loadBudgetData({ fiscalYear: activeFiscalYear, expenseType: expenseTypeFilter !== 'all' ? expenseTypeFilter as 'CAPEX' | 'OPEX' : undefined });
    } finally {
      setCarryForwardLoadingCoaId(null);
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
  }, [loadBudgetData]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const searchParams = {
        search: searchTerm || undefined,
        fiscalYear: selectedFiscalYear !== 'all' ? selectedFiscalYear : 'all',
        status: statusFilter !== 'all' ? statusFilter : undefined,
        expenseType: expenseTypeFilter !== 'all' ? expenseTypeFilter as 'CAPEX' | 'OPEX' : undefined,
      };
      loadBudgetData(searchParams);
    }, 300); // 300ms delay

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedFiscalYear, statusFilter, expenseTypeFilter, loadBudgetData]);

  useEffect(() => {
    loadCutoffStatus(activeFiscalYear);
  }, [activeFiscalYear, loadCutoffStatus]);

  // Use dashboard metrics if available, fallback to budget summary
  const totalInitialBudget = dashboardMetrics?.budget.totalBudget || budgetSummary?.totalBudgetAllocated || budgetSummary?.totalBudget || 0;
  const totalSpent = dashboardMetrics?.budget.totalSpent || budgetSummary?.totalBudgetApproved || budgetSummary?.totalSpent || 0;
  const totalRemaining = dashboardMetrics?.budget.totalRemaining || (totalInitialBudget - totalSpent);
  const overallUtilization = dashboardMetrics?.budget.overallUtilization || budgetSummary?.overallUtilization || 0;
  const overBudgetCount = dashboardMetrics?.budget.overBudgetCount || budgetData.filter((b) => b.BudgetStatus === 'Over Budget').length;
  const needAttentionCount = readinessData?.summary.needAttentionCount || 0;
  const alertCount = overBudgetCount + needAttentionCount;
  
  // CAPEX and OPEX utilization data is now handled by the UtilizationChart component using utilizationData

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Budget Overview</h1>
            <p className="text-muted-foreground mt-1">
              Monitor HR / IT CAPEX and OPEX allocation and utilization
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
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="flex-1 lg:flex-none"
              disabled={!canManageBudgets || isFiscalClosed || !activeFiscalYear}
            >
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
                  placeholder="Search budgets by code, name, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select 
                value={selectedFiscalYear} 
                onValueChange={(value) => {
                  setSelectedFiscalYear(value);
                  loadBudgetData({ fiscalYear: value });
                }}
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Fiscal Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
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
                  <SelectItem value="No Budget">No Budget</SelectItem>
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

        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 md:col-span-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fiscal Year Cut-Off</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Selected fiscal year
                </div>
                <Badge variant="outline">{activeFiscalYear ?? 'All Years'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Status</div>
                {isFiscalClosed ? (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" />
                    Closed
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <LockOpen className="h-3.5 w-3.5" />
                    Open
                  </Badge>
                )}
              </div>
              {isFiscalClosed && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Budget write actions are locked for FY {activeFiscalYear}.
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleCutoffAction('close')}
                  disabled={!canManageBudgets || cutoffActionLoading || !activeFiscalYear || isFiscalClosed}
                >
                  Close FY
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCutoffAction('reopen')}
                  disabled={!canReopenCutoff || cutoffActionLoading || !activeFiscalYear || !isFiscalClosed}
                >
                  Reopen FY
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-12 md:col-span-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">OPEX FY Import</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Paste JSON array payload for OPEX rows.
              </div>
              <div className="space-y-2">
                <Label htmlFor="opex-payload">Payload</Label>
                <Textarea
                  id="opex-payload"
                  value={opexPayload}
                  onChange={(event) => setOpexPayload(event.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
              <Button
                onClick={handleOpexImport}
                disabled={!canManageBudgets || opexImporting || isFiscalClosed || !activeFiscalYear}
                className="w-full"
              >
                <Upload className="h-4 w-4" />
                Import OPEX Rows
              </Button>
              {opexImportResult && (
                <div className="grid grid-cols-12 gap-2 rounded-md border p-3 text-sm">
                  <div className="col-span-6">Inserted: {opexImportResult.insertedCount}</div>
                  <div className="col-span-6">Updated: {opexImportResult.updatedCount}</div>
                  <div className="col-span-6">Rejected: {opexImportResult.rejectedCount}</div>
                  <div className="col-span-6">Total: {opexImportResult.totalRows}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-12 gap-4 lg:gap-6">
        <Card className="metric-card min-h-[120px] col-span-12 md:col-span-6 xl:col-span-3">
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

        <Card className="metric-card min-h-[120px] col-span-12 md:col-span-6 xl:col-span-3">
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

        <Card className="metric-card min-h-[120px] col-span-12 md:col-span-6 xl:col-span-3">
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

        <Card className="metric-card min-h-[120px] col-span-12 md:col-span-6 xl:col-span-3">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Alerts</p>
                <p className="text-xl lg:text-2xl font-bold text-warning">{alertCount}</p>
                <p className="text-xs text-muted-foreground">
                  {needAttentionCount} need setup, {overBudgetCount} over budget
                </p>
              </div>
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 lg:h-6 lg:w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {activeFiscalYear && readinessData && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">New Fiscal Year Readiness</CardTitle>
            <p className="text-sm text-muted-foreground">
              Mandatory HR / IT OPEX COAs for FY {readinessData.fiscalYear}. Missing budgets stay virtual with zero allocation until you create budget or approve carry forward.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-12 gap-4">
              <Card className="col-span-12 md:col-span-3">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Mandatory COAs</div>
                  <div className="text-2xl font-bold">{readinessData.summary.mandatoryCoaCount}</div>
                </CardContent>
              </Card>
              <Card className="col-span-12 md:col-span-3">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Ready</div>
                  <div className="text-2xl font-bold text-green-700">{readinessData.summary.readyCount}</div>
                </CardContent>
              </Card>
              <Card className="col-span-12 md:col-span-3">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Need Attention</div>
                  <div className="text-2xl font-bold text-warning">{readinessData.summary.needAttentionCount}</div>
                </CardContent>
              </Card>
              <Card className="col-span-12 md:col-span-3">
                <CardContent className="p-4">
                  <div className="text-sm text-muted-foreground">Carry Forward</div>
                  <div className="text-2xl font-bold text-blue-700">{readinessData.summary.carryForwardAppliedCount}</div>
                </CardContent>
              </Card>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>COA</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Previous Remaining (Reset)</TableHead>
                    <TableHead className="text-right">Annual</TableHead>
                    <TableHead className="text-right">Carry Forward</TableHead>
                    <TableHead className="text-right">Total Available</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readinessData.items.map((item) => (
                    <TableRow key={item.coaId}>
                      <TableCell className="font-medium">{item.coaCode}</TableCell>
                      <TableCell>{item.coaName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.previousRemainingAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.currentAnnualAllocation)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.currentCarryForwardAmount)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.totalAvailableBudget)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.readinessStatus === 'Need Attention'
                              ? 'destructive'
                              : item.readinessStatus === 'Carry Forward Applied'
                              ? 'secondary'
                              : 'default'
                          }
                        >
                          {item.readinessStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditReadinessItem(item)}
                            disabled={!canManageBudgets || isFiscalClosed}
                          >
                            <Edit className="h-4 w-4" />
                            Edit Budget
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleApplyCarryForward(item)}
                            disabled={
                              !canApproveCarryForward ||
                              isFiscalClosed ||
                              !item.canCarryForward ||
                              carryForwardLoadingCoaId === item.coaId
                            }
                          >
                            {carryForwardLoadingCoaId === item.coaId ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <TrendingUp className="h-4 w-4" />
                            )}
                            Carry Forward
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Utilization Charts */}
      <div className="grid grid-cols-12 gap-4 lg:gap-6 mb-6">
        <UtilizationChart
          title="CAPEX Utilization"
          data={utilizationData}
          expenseType="CAPEX"
          className="min-h-[350px] col-span-12 xl:col-span-6"
        />
        
        <UtilizationChart
          title="OPEX Utilization"
          data={utilizationData}
          expenseType="OPEX"
          className="min-h-[350px] col-span-12 xl:col-span-6"
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
                    <TableHead className="min-w-[120px] text-right">Annual</TableHead>
                    <TableHead className="min-w-[120px] text-right">Carry Forward</TableHead>
                    <TableHead className="min-w-[120px] text-right">Total Available</TableHead>
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
                      <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                        No budgets found matching your criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    budgetData.map((budget, index) => {
                      const annualAllocated = budget.AnnualAllocated || 0;
                      const carryForwardAmount = budget.CarryForwardAmount || 0;
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
                          <TableCell className="text-right font-medium">{formatCurrency(annualAllocated)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(carryForwardAmount)}</TableCell>
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
                                <Button
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  disabled={!canManageBudgets || isFiscalClosed}
                                >
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleEditCostCodeBudget(budget)}
                                  disabled={!canManageBudgets || isFiscalClosed}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
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
