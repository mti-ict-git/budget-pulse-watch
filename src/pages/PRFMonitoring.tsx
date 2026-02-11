import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Filter, Plus, Edit, Trash2, RefreshCw, Download, Archive, CheckSquare, ChevronDown, ChevronRight, Expand, Minimize, FolderSync, CloudDownload } from "lucide-react";
import { PRFDetailDialog } from "@/components/prf/PRFDetailDialog";
import { ExcelImportDialog } from "@/components/prf/ExcelImportDialog";
import { PRFEditDialog } from "@/components/prf/PRFEditDialog";
import { PRFDeleteDialog } from "@/components/prf/PRFDeleteDialog";
import { PRFItemModificationModal } from "@/components/prf/PRFItemModificationModal";
import { toast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { budgetService, type ChartOfAccount } from "@/services/budgetService";
import { useAuth } from "@/contexts/AuthContext";

// PRF Item interface
interface PRFItem {
  PRFItemID: number;
  ItemID?: number; // Legacy field for compatibility
  PRFID: number;
  ItemName: string;
  Description: string;
  Quantity: number;
  UnitPrice: number;
  TotalPrice: number;
  Specifications?: string;
  Status?: 'Pending' | 'Approved' | 'Picked Up' | 'Cancelled' | 'On Hold';
  PickedUpBy?: string;
  PickedUpDate?: Date;
  Notes?: string;
  UpdatedAt?: Date;
  UpdatedBy?: number;
  CreatedAt: Date;
  StatusOverridden?: boolean; // Indicates if item status was manually overridden vs following PRF status
  
  // Cost code fields - enables multiple cost codes per PRF through item-level assignment
  PurchaseCostCode?: string;
  COAID?: number;
  BudgetYear?: number;
}

// PRF data interface
interface PRFData {
  id: string;
  prfNo: string;
  dateSubmit: string;
  submitBy: string;
  description: string;
  sumDescriptionRequested: string;
  purchaseCostCode: string;
  amount: number;
  requiredFor: string;
  budgetYear: number;
  department: string;
  priority: string;
  progress: string;
  lastUpdate: string;
  items?: PRFItem[];
}

// Raw API data interface (from backend)
interface PRFRawData {
  PRFID?: number;
  PRFNo?: string;
  RequestDate?: string;
  DateSubmit?: string;
  RequestorName?: string;
  SubmitBy?: string;
  Title?: string;
  Description?: string;
  SumDescriptionRequested?: string;
  PurchaseCostCode?: string;
  RequestedAmount?: number;
  Amount?: number;
  RequiredFor?: string;
  BudgetYear?: number;
  Department?: string;
  Priority?: string;
  Status?: string;
  UpdatedAt?: string;
  LastUpdate?: string;
  Items?: PRFItem[];
}

// API response interface
interface PRFApiResponse {
  success: boolean;
  data: PRFRawData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const getStatusBadge = (status: string) => {
  // Use the actual status value from Excel without modification
  const displayStatus = status || 'Unknown';
  
  // Determine badge variant based on common status patterns
  const getVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "success" => {
    const lowerStatus = status.toLowerCase();
    
    if (lowerStatus.includes('approved') || lowerStatus.includes('complete')) {
      return 'success';
    }
    if (lowerStatus.includes('reject') || lowerStatus.includes('cancel') || lowerStatus.includes('denied')) {
      return 'destructive';
    }
    if (lowerStatus.includes('pending') || lowerStatus.includes('review') || lowerStatus.includes('pronto')) {
      return 'secondary';
    }
    if (lowerStatus.includes('draft') || lowerStatus.includes('hold')) {
      return 'outline';
    }
    return 'default';
  };
  
  return <Badge variant={getVariant(displayStatus)}>{displayStatus}</Badge>;
};

const getPriorityBadge = (priority: string) => {
  const priorityConfig = {
    Low: { label: "Low", variant: "outline" as const },
    Medium: { label: "Medium", variant: "secondary" as const },
    High: { label: "High", variant: "default" as const },
    Critical: { label: "Critical", variant: "destructive" as const }
  };
  
  const config = priorityConfig[priority as keyof typeof priorityConfig] || { label: priority, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};



const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

export default function PRFMonitoring() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [prfData, setPrfData] = useState<PRFData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [availableStatusValues, setAvailableStatusValues] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [selectedItemForModification, setSelectedItemForModification] = useState<PRFItem | null>(null);
  const [isModificationModalOpen, setIsModificationModalOpen] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isSelectedSyncing, setIsSelectedSyncing] = useState<boolean>(false);
  const [isOneDriveTesting, setIsOneDriveTesting] = useState<boolean>(false);
  const [isOneDriveDialogOpen, setIsOneDriveDialogOpen] = useState<boolean>(false);
  const [oneDriveTestOutput, setOneDriveTestOutput] = useState<string>("");

  // Fetch PRF data from API
  const fetchPRFData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(departmentFilter !== 'all' && { department: departmentFilter }),
        ...(priorityFilter !== 'all' && { priority: priorityFilter }),
        ...(yearFilter !== 'all' && { year: yearFilter })
      });

      const response = await fetch(`/api/prfs/with-items?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: PRFApiResponse = await response.json();
      
      if (result.success) {
        // Transform API data to match frontend interface
        const transformedData = result.data.map((prf: PRFRawData) => ({
          id: prf.PRFID?.toString() || '',
          prfNo: prf.PRFNo || '',
          dateSubmit: prf.DateSubmit || prf.RequestDate || '',
          submitBy: prf.SubmitBy || prf.RequestorName || '',
          description: prf.Title || prf.Description || '',
          sumDescriptionRequested: prf.SumDescriptionRequested || '',
          purchaseCostCode: prf.PurchaseCostCode || '',
          amount: prf.RequestedAmount || prf.Amount || 0,
          requiredFor: prf.RequiredFor || '',
          budgetYear: prf.BudgetYear || new Date().getFullYear(),
          department: prf.Department || '',
          priority: prf.Priority || 'Medium',
          progress: prf.Status || 'pending',
          lastUpdate: prf.UpdatedAt || prf.LastUpdate || prf.RequestDate || '',
          items: prf.Items || []
        }));
        
        setPrfData(transformedData);
        setPagination(result.pagination);
      } else {
        throw new Error('Failed to fetch PRF data');
      }
    } catch (err) {
      console.error('Error fetching PRF data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch PRF data');
      setPrfData([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm, statusFilter, departmentFilter, priorityFilter, yearFilter]);

  // Fetch available status values from API
  const fetchStatusValues = async () => {
    try {
      const response = await fetch('/api/prfs/filters/status', {
        headers: authService.getAuthHeaders()
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAvailableStatusValues(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching status values:', error);
      // Fallback to empty array if fetch fails
      setAvailableStatusValues([]);
    }
  };

  // Fetch Chart of Accounts data
  const fetchChartOfAccounts = async () => {
    try {
      const result = await budgetService.getChartOfAccounts();
      if (result.success && result.data) {
        setChartOfAccounts(result.data);
      }
    } catch (error) {
      console.error('Error fetching chart of accounts:', error);
    }
  };

  // Helper function to get COA name by ID
  const getCOAName = (coaId: number): string => {
    const coa = chartOfAccounts.find(account => account.COAID === coaId);
    return coa ? coa.COAName : `COA ID: ${coaId}`;
  };



  // Helper function to get cost code summary with amounts
  const getCostCodeSummary = (prf: PRFData) => {
    const costCodeAmounts = prf.items?.reduce((acc, item) => {
      if (item.PurchaseCostCode) {
        acc[item.PurchaseCostCode] = (acc[item.PurchaseCostCode] || 0) + item.TotalPrice;
      }
      return acc;
    }, {} as Record<string, number>) || {};

    return Object.entries(costCodeAmounts);
  };

  // Helper function to safely format percentage values
  const formatPercentage = (value: number | null | undefined): string => {
    if (value == null || isNaN(value)) return '0.0';
    return value.toFixed(1);
  };

  // Helper function to get percentage color class
  const getPercentageColorClass = (value: number | null | undefined): string => {
    if (value == null || isNaN(value)) return 'text-green-500';
    if (value > 100) return 'text-red-500';
    if (value > 80) return 'text-yellow-500';
    return 'text-green-500';
  };

  // Enhanced React component to display all cost codes with budget information
  const CostCodeDisplay: React.FC<{ prf: PRFData }> = ({ prf }) => {
    const [costCodeBudgets, setCostCodeBudgets] = React.useState<Array<{
      CostCode: string;
      COAName: string;
      TotalBudget: number;
      TotalSpent: number;
      RemainingBudget: number;
      PRFSpent: number;
      ItemCount: number;
      ItemNames: string;
      UtilizationPercentage: number | null;
    }>>([]);
    const [isLoading, setIsLoading] = React.useState(false);

    // Fetch cost code budget data when component mounts or PRF changes
    React.useEffect(() => {
      const fetchCostCodeBudgets = async () => {
        if (!prf.prfNo) return;
        
        setIsLoading(true);
        try {
          const response = await budgetService.getPRFCostCodeBudgets(prf.prfNo);
          if (response.success && response.data) {
            setCostCodeBudgets(response.data);
          }
        } catch (error) {
          console.error('Error fetching cost code budgets:', error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchCostCodeBudgets();
    }, [prf.prfNo]);

    if (isLoading) {
      return <span className="text-muted-foreground text-sm">Loading...</span>;
    }

    if (costCodeBudgets.length === 0) {
      // Fallback to PRF-level cost code if no budget data
      return prf.purchaseCostCode ? (
        <span className="font-mono text-sm">{prf.purchaseCostCode}</span>
      ) : (
        <span className="text-muted-foreground text-sm">No cost code</span>
      );
    }

    if (costCodeBudgets.length === 1) {
      const budget = costCodeBudgets[0];
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-sm cursor-help">
                {budget.CostCode}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div className="space-y-2">
                <div className="font-medium">{budget.CostCode}</div>
                <div className="text-xs text-muted-foreground">{budget.COAName}</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Total Budget:</span>
                    <span className="font-mono">{formatCurrency(budget.TotalBudget)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Spent:</span>
                    <span className="font-mono">{formatCurrency(budget.TotalSpent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining:</span>
                    <span className={`font-mono ${budget.RemainingBudget < 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {formatCurrency(budget.RemainingBudget)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>This PRF:</span>
                    <span className="font-mono">{formatCurrency(budget.PRFSpent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Utilization:</span>
                    <span className={`font-mono ${getPercentageColorClass(budget.UtilizationPercentage)}`}>
                      {formatPercentage(budget.UtilizationPercentage)}%
                    </span>
                  </div>
                </div>
                {budget.ItemNames && (
                  <div className="border-t pt-2 mt-2">
                    <div className="text-xs text-muted-foreground">
                      Items ({budget.ItemCount}): {budget.ItemNames}
                    </div>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } else {
      const totalPRFSpent = costCodeBudgets.reduce((sum, budget) => sum + budget.PRFSpent, 0);
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-sm cursor-help">
                {costCodeBudgets[0].CostCode} (+{costCodeBudgets.length - 1} more)
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <div className="space-y-2">
                <div className="font-medium">Cost Code Budget Summary ({costCodeBudgets.length} codes):</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {costCodeBudgets.map((budget, index) => (
                    <div key={index} className="border-b pb-2 last:border-b-0">
                      <div className="font-mono text-sm font-medium">{budget.CostCode}</div>
                      <div className="text-xs text-muted-foreground mb-1">{budget.COAName}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span>Budget:</span>
                          <span className="font-mono">{formatCurrency(budget.TotalBudget)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Spent:</span>
                          <span className="font-mono">{formatCurrency(budget.TotalSpent)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Remaining:</span>
                          <span className={`font-mono ${budget.RemainingBudget < 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {formatCurrency(budget.RemainingBudget)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>This PRF:</span>
                          <span className="font-mono">{formatCurrency(budget.PRFSpent)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span>Utilization:</span>
                        <span className={`font-mono ${getPercentageColorClass(budget.UtilizationPercentage)}`}>
                          {formatPercentage(budget.UtilizationPercentage)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between items-center font-medium text-sm">
                    <span>Total PRF Amount:</span>
                    <span className="font-mono">{formatCurrency(totalPRFSpent)}</span>
                  </div>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
  };

  // Fetch status values and Chart of Accounts on component mount
  useEffect(() => {
    fetchStatusValues();
    fetchChartOfAccounts();
  }, []);

  // Fetch data on component mount and when filters change
  useEffect(() => {
    fetchPRFData();
    setSelectedItems(new Set()); // Clear selections when data changes
  }, [pagination.page, pagination.limit, statusFilter, departmentFilter, priorityFilter, yearFilter, fetchPRFData]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pagination.page === 1) {
        fetchPRFData();
      } else {
        setPagination(prev => ({ ...prev, page: 1 }));
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fetchPRFData, pagination.page]);

  // Since filtering is now done on the backend, we use prfData directly
  const filteredData = prfData;

  // Toggle row expansion
  const toggleRowExpansion = (prfId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(prfId)) {
        newSet.delete(prfId);
      } else {
        newSet.add(prfId);
      }
      return newSet;
    });
  };

  // Expand all rows that have items
  const expandAllRows = () => {
    const expandableRows = filteredData
      .filter(prf => prf.items && prf.items.length > 0)
      .map(prf => prf.id);
    setExpandedRows(new Set(expandableRows));
  };

  // Collapse all rows
  const collapseAllRows = () => {
    setExpandedRows(new Set());
  };

  // Bulk action handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(filteredData.map(prf => prf.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkExport = () => {
    // TODO: Implement bulk export functionality
  };

  const handleBulkArchive = () => {
    // TODO: Implement bulk archive functionality
  };

  // Item modification handlers
  const handleItemModification = (item: PRFItem) => {
    setSelectedItemForModification(item);
    setIsModificationModalOpen(true);
  };

  const handleItemUpdate = async (itemId: number, updateData: Partial<PRFItem>) => {
    try {
      const response = await fetch(`/api/prfs/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Item Updated",
          description: "PRF item has been successfully updated.",
        });
        
        // Refresh the data to show updated item
        await fetchPRFData();
      } else {
        throw new Error(result.message || 'Failed to update item');
      }
    } catch (error) {
      console.error('Error updating item:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update PRF item.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedItems.size} selected PRF records? This action cannot be undone.`)) {
      try {
        setLoading(true);
        const ids = Array.from(selectedItems);
        
        const response = await fetch('/api/prfs/bulk', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({ ids: ids.map(id => parseInt(id, 10)) }),
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Show success message
          alert(`Successfully deleted ${result.data.deletedCount} PRF records`);
          
          // Clear selection and refresh data
          setSelectedItems(new Set());
          await fetchPRFData();
        } else {
          throw new Error(result.message || 'Failed to delete PRF records');
        }
      } catch (error) {
        console.error('Error deleting PRF records:', error);
        alert(`Error deleting PRF records: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBulkStatusUpdate = (newStatus: string) => {
    // TODO: Implement bulk status update functionality
  };

  const handleBulkSync = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to perform bulk sync",
        variant: "destructive",
      });
      return;
    }

    setIsBulkSyncing(true);
    try {
      const response = await fetch('/api/prf-documents/bulk-sync', {
        method: 'POST',
        headers: authService.getAuthHeaders(),
        body: JSON.stringify({ userId: user.id }),
      });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Bulk Sync Completed",
          description: `Synced ${result.data.totalSynced} files across ${result.data.foldersProcessed} PRF folders`,
        });
        
        // Optionally refresh PRF data
        fetchPRFData();
      } else {
        throw new Error(result.message || 'Failed to perform bulk sync');
      }
    } catch (error) {
      console.error('Error during bulk sync:', error);
      toast({
        title: "Bulk Sync Failed",
        description: error instanceof Error ? error.message : 'Failed to sync folders',
        variant: "destructive",
      });
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const handleSyncPRF = async (prfNo: string) => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to sync", variant: "destructive" });
      return;
    }
    setSyncingId(prfNo);
    try {
      const yearParam = yearFilter !== 'all' ? `&year=${encodeURIComponent(yearFilter)}` : '';
      const response = await fetch(`/api/cloud-sync/pull/prf/${encodeURIComponent(prfNo)}?mode=scan${yearParam}`, { method: 'POST', headers: authService.getAuthHeaders() });
      const result = await response.json();
      if (result.success) {
        toast({ title: "Synced From Cloud", description: result.message });
        fetchPRFData();
      } else {
        throw new Error((result && (result.error || result.message)) || 'Failed to sync');
      }
    } catch (error) {
      toast({ title: "Sync Failed", description: error instanceof Error ? error.message : 'Error syncing PRF', variant: "destructive" });
    } finally {
      setSyncingId(null);
    }
  };

  const handlePageSizeChange = (newLimit: string) => {
    setPagination(prev => ({ ...prev, limit: parseInt(newLimit), page: 1 }));
  };

  const handleSyncSelected = async () => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to sync", variant: "destructive" });
      return;
    }
    const selectedPrfNos: string[] = prfData.filter((p) => selectedItems.has(p.id)).map((p) => p.prfNo);
    if (selectedPrfNos.length === 0) {
      toast({ title: "No Selection", description: "Select at least one PRF to sync" });
      return;
    }
    setIsSelectedSyncing(true);
    try {
      const yearParam = yearFilter !== 'all' ? `&year=${encodeURIComponent(yearFilter)}` : '';
      const promises = selectedPrfNos.map((prfNo) =>
        fetch(`/api/cloud-sync/pull/prf/${encodeURIComponent(prfNo)}?mode=scan${yearParam}`, { method: 'POST', headers: authService.getAuthHeaders() })
          .then(async (res) => ({ prfNo, res, body: await res.json() }))
      );
      const results = await Promise.allSettled(promises);
      let successCount = 0;
      let failureCount = 0;
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          if (r.value.res.ok && r.value.body && r.value.body.success) {
            successCount += 1;
          } else {
            failureCount += 1;
          }
        } else {
          failureCount += 1;
        }
      });
      toast({ title: "Sync Selected Completed", description: `Success: ${successCount}, Failed: ${failureCount}` });
      fetchPRFData();
    } catch (error) {
      toast({ title: "Sync Selected Failed", description: error instanceof Error ? error.message : 'Error syncing selected PRFs', variant: "destructive" });
    } finally {
      setIsSelectedSyncing(false);
    }
  };

  const handleTestOneDriveAccess = async () => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to test OneDrive access", variant: "destructive" });
      return;
    }

    setIsOneDriveTesting(true);
    try {
      const response = await fetch('/api/cloud-sync/test', {
        method: 'GET',
        headers: authService.getAuthHeaders(),
      });

      const body: unknown = await response.json();
      const pretty = JSON.stringify(body, null, 2);
      setOneDriveTestOutput(pretty);
      setIsOneDriveDialogOpen(true);

      if (response.ok) {
        toast({ title: "OneDrive Test Completed", description: "Read-only access request finished" });
      } else {
        toast({ title: "OneDrive Test Failed", description: "Request returned an error", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "OneDrive Test Failed", description: error instanceof Error ? error.message : 'Error testing OneDrive access', variant: "destructive" });
    } finally {
      setIsOneDriveTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={isOneDriveDialogOpen} onOpenChange={setIsOneDriveDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>OneDrive Access Test</DialogTitle>
            <DialogDescription>
              Read-only output from GET /api/cloud-sync/test
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4 text-xs">
            {oneDriveTestOutput}
          </pre>
        </DialogContent>
      </Dialog>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PRF Monitoring</h1>
          <p className="text-muted-foreground">
            Track and manage Purchase Request Forms with enhanced Excel field support
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleBulkSync}
            disabled={isBulkSyncing}
          >
            {isBulkSyncing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FolderSync className="h-4 w-4 mr-2" />
            )}
            Bulk Sync Folders
          </Button>
          <Button
            variant="outline"
            onClick={handleSyncSelected}
            disabled={isSelectedSyncing || selectedItems.size === 0}
          >
            {isSelectedSyncing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4 mr-2" />
            )}
            Sync Selected PRFs
          </Button>
          {user?.role === 'admin' && (
            <Button
              variant="outline"
              onClick={handleTestOneDriveAccess}
              disabled={isOneDriveTesting}
            >
              {isOneDriveTesting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Test OneDrive
            </Button>
          )}
          <ExcelImportDialog />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by PRF No, description, submit by, or required for..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {availableStatusValues.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="IT">IT</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                </SelectContent>
              </Select>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              PRF List ({pagination.total} items)
              {loading && <span className="text-sm text-muted-foreground ml-2">Loading...</span>}
              {selectedItems.size > 0 && (
                <span className="text-sm text-blue-600 ml-2">({selectedItems.size} selected)</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Page Size Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show:</span>
                <Select value={pagination.limit.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Bulk Actions */}
              {selectedItems.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleBulkExport}>
                    <Download className="h-4 w-4 mr-1" />
                    Export ({selectedItems.size})
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleBulkArchive}>
                    <Archive className="h-4 w-4 mr-1" />
                    Archive ({selectedItems.size})
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete ({selectedItems.size})
                  </Button>
                  <Select onValueChange={handleBulkStatusUpdate}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Update Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">Error loading PRF data: {error}</p>
              <Button onClick={() => fetchPRFData()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : (
            <div>
              {/* Expand/Collapse All Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={expandAllRows}
                    disabled={loading || filteredData.filter(prf => prf.items && prf.items.length > 0).length === 0}
                  >
                    <Expand className="h-4 w-4 mr-1" />
                    Expand All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={collapseAllRows}
                    disabled={loading || expandedRows.size === 0}
                  >
                    <Minimize className="h-4 w-4 mr-1" />
                    Collapse All
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {filteredData.filter(prf => prf.items && prf.items.length > 0).length} expandable rows
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 sticky left-0 bg-background z-10">
                        <input
                          type="checkbox"
                          checked={selectedItems.size === filteredData.length && filteredData.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead className="w-8 sticky left-12 bg-background z-10"></TableHead>
                      <TableHead className="min-w-[120px] sticky left-20 bg-background z-10 font-medium">PRF No</TableHead>
                      <TableHead className="min-w-[100px]">Date Submit</TableHead>
                      <TableHead className="min-w-[120px]">Submit By</TableHead>
                      <TableHead className="min-w-[200px]">Description</TableHead>
                      <TableHead className="min-w-[140px]">Cost Code</TableHead>
                      <TableHead className="min-w-[100px] text-right">Amount</TableHead>
                      <TableHead className="min-w-[150px]">Required For</TableHead>
                      <TableHead className="min-w-[100px]">Department</TableHead>
                      <TableHead className="min-w-[80px]">Priority</TableHead>
                      <TableHead className="min-w-[80px]">Budget Year</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[120px] sticky right-0 bg-background z-10">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          Loading PRF data...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                        No PRF data found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((prf) => (
                      <React.Fragment key={prf.id}>
                        <TableRow 
                          className={`${prf.items && prf.items.length > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                          onClick={() => prf.items && prf.items.length > 0 && toggleRowExpansion(prf.id)}
                        >
                          <TableCell className="sticky left-0 bg-background z-10" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedItems.has(prf.id)}
                              onChange={(e) => handleSelectItem(prf.id, e.target.checked)}
                              className="rounded border-gray-300"
                            />
                          </TableCell>
                          <TableCell className="sticky left-12 bg-background z-10">
                            {prf.items && prf.items.length > 0 && (
                              <div className="flex items-center justify-center">
                                {expandedRows.has(prf.id) ? (
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-500" />
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium sticky left-20 bg-background z-10">
                            <div className="flex items-center gap-2">
                              <span className="whitespace-nowrap">{prf.prfNo}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={(e) => { e.stopPropagation(); handleSyncPRF(prf.prfNo); }}
                                disabled={syncingId === prf.prfNo}
                                aria-label="Sync this PRF from Cloud"
                              >
                                {syncingId === prf.prfNo ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CloudDownload className="h-4 w-4" />
                                )}
                              </Button>
                              {prf.items && prf.items.length > 0 && (
                                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                                  {prf.items.length} items
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{new Date(prf.dateSubmit).toLocaleDateString('id-ID')}</TableCell>
                          <TableCell className="truncate max-w-[120px]" title={prf.submitBy}>{prf.submitBy}</TableCell>
                          <TableCell className="truncate max-w-[200px]" title={prf.description}>{prf.description}</TableCell>
                          <TableCell><CostCodeDisplay prf={prf} /></TableCell>
                          <TableCell className="font-medium text-right whitespace-nowrap">{formatCurrency(prf.amount)}</TableCell>
                          <TableCell className="truncate max-w-[150px]" title={prf.requiredFor}>{prf.requiredFor}</TableCell>
                          <TableCell><Badge variant="outline" className="whitespace-nowrap">{prf.department}</Badge></TableCell>
                          <TableCell>{getPriorityBadge(prf.priority)}</TableCell>
                          <TableCell className="whitespace-nowrap">{prf.budgetYear}</TableCell>
                          <TableCell>{getStatusBadge(prf.progress)}</TableCell>
                          <TableCell className="sticky right-0 bg-background z-10" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <PRFDetailDialog prf={prf} />
                              <PRFEditDialog prf={prf} onPRFUpdated={fetchPRFData} />
                              <PRFDeleteDialog prf={prf} onPRFDeleted={fetchPRFData} />
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedRows.has(prf.id) && prf.items && prf.items.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={14} className="bg-gray-50 p-0">
                              <div className="p-4">
                                <h4 className="font-medium mb-3 text-sm text-gray-700">PRF Items ({prf.items.length})</h4>
                                <div className="space-y-2">
                                  {prf.items.map((item, index) => (
                                    <div key={item.PRFItemID || item.ItemID} className="flex items-center justify-between p-3 bg-white rounded border">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <div className="font-medium text-sm">{item.ItemName}</div>
                                          {item.Status && (
                                            <div className="flex items-center gap-1">
                                              <Badge 
                                                className={
                                                  item.Status === 'Approved' ? 'bg-green-100 text-green-800' :
                                                  item.Status === 'Picked Up' ? 'bg-blue-100 text-blue-800' :
                                                  item.Status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                                  item.Status === 'On Hold' ? 'bg-orange-100 text-orange-800' :
                                                  'bg-yellow-100 text-yellow-800'
                                                }
                                              >
                                                {item.Status}
                                              </Badge>
                                              {item.StatusOverridden && (
                                                <Badge 
                                                  variant="outline" 
                                                  className="text-xs bg-purple-50 text-purple-700 border-purple-200"
                                                  title="Status manually overridden - does not follow PRF status"
                                                >
                                                  Manual
                                                </Badge>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                        {item.Description && (
                                          <div className="text-xs text-gray-600 mt-1">{item.Description}</div>
                                        )}
                                        
                                        {/* Cost Code Information */}
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          {item.PurchaseCostCode && (
                                            <Badge variant="secondary" className="text-xs font-mono">
                                              Cost: {item.PurchaseCostCode}
                                            </Badge>
                                          )}
                                          {item.COAID && (
                                            <Badge variant="outline" className="text-xs" title={`COA ID: ${item.COAID}`}>
                                              COA: {getCOAName(item.COAID)}
                                            </Badge>
                                          )}
                                          {item.BudgetYear && (
                                            <Badge variant="outline" className="text-xs">
                                              Year: {item.BudgetYear}
                                            </Badge>
                                          )}
                                        </div>
                                        
                                        {item.Specifications && (
                                          <div className="text-xs text-gray-500 mt-1">
                                            <details className="cursor-pointer">
                                              <summary className="hover:text-gray-700">
                                                Specifications {JSON.parse(item.Specifications).originalRow ? `(Row ${JSON.parse(item.Specifications).originalRow})` : ''}
                                              </summary>
                                              <div className="mt-1 pl-2 border-l-2 border-gray-200">
                                                {(() => {
                                                  try {
                                                    const specs = JSON.parse(item.Specifications);
                                                    return (
                                                      <div className="space-y-1">
                                                        {specs.originalRow && (
                                                          <div><strong>Row:</strong> {specs.originalRow}</div>
                                                        )}
                                                        {(specs.purchaseCostCode || specs.PurchaseCostCode) && (
                                                          <div><strong>Cost Code:</strong> {specs.purchaseCostCode || specs.PurchaseCostCode}</div>
                                                        )}
                                                        {(specs.coaid || specs.COAID) && (
                                                          <div><strong>COA:</strong> {getCOAName(specs.coaid || specs.COAID)} (ID: {specs.coaid || specs.COAID})</div>
                                                        )}
                                                        {(specs.budgetYear || specs.BudgetYear) && (
                                                          <div><strong>Budget Year:</strong> {specs.budgetYear || specs.BudgetYear}</div>
                                                        )}
                                                        {Object.entries(specs).map(([key, value]) => {
                                                          if (!['originalRow', 'PurchaseCostCode', 'COAID', 'BudgetYear'].includes(key) && value) {
                                                            return <div key={key}><strong>{key}:</strong> {String(value)}</div>;
                                                          }
                                                          return null;
                                                        })}
                                                      </div>
                                                    );
                                                  } catch {
                                                    return <div>{item.Specifications}</div>;
                                                  }
                                                })()}
                                              </div>
                                            </details>
                                          </div>
                                        )}
                                        {item.PickedUpBy && (
                                          <div className="text-xs text-blue-600 mt-1">
                                            Picked up by: {item.PickedUpBy} {item.PickedUpDate && `on ${new Date(item.PickedUpDate).toLocaleDateString()}`}
                                          </div>
                                        )}
                                        {item.Notes && (
                                          <div className="text-xs text-gray-500 mt-1 italic">
                                            Note: {item.Notes}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-right flex items-center gap-2">
                                        <div>
                                          <div className="text-sm font-medium">{formatCurrency(item.UnitPrice)}</div>
                                          <div className="text-xs text-gray-500">Qty: {item.Quantity}</div>
                                          {item.TotalPrice && (
                                            <div className="text-xs font-medium text-gray-700">Total: {formatCurrency(item.TotalPrice)}</div>
                                          )}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleItemModification(item)}
                                          className="ml-2"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
              
              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page <= 1 || loading}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages || loading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Item Modification Modal */}
      {selectedItemForModification && (
        <PRFItemModificationModal
          isOpen={isModificationModalOpen}
          onClose={() => {
            setIsModificationModalOpen(false);
            setSelectedItemForModification(null);
          }}
          item={selectedItemForModification}
          onUpdate={handleItemUpdate}
        />
      )}
    </div>
  );
}
