import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Filter, Plus, Edit, Trash2, RefreshCw, Download, Archive, CheckSquare, ChevronDown, ChevronRight, Expand, Minimize, FolderSync, CloudDownload, Waypoints } from "lucide-react";
import * as XLSX from "xlsx";
import { PRFDetailDialog } from "@/components/prf/PRFDetailDialog";
import { ExcelImportDialog } from "@/components/prf/ExcelImportDialog";
import { PRFEditDialog } from "@/components/prf/PRFEditDialog";
import { PRFDeleteDialog } from "@/components/prf/PRFDeleteDialog";
import { PRFItemModificationModal } from "@/components/prf/PRFItemModificationModal";
import { toast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { budgetService, type ChartOfAccount } from "@/services/budgetService";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";

import type { PRFItem } from '@/types/prfItem';
import { PRFItemsPanel } from '@/components/prf/PRFItemsPanel';

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
  approvedByName?: string;
  lastUpdate: string;
  items?: PRFItem[];

  // Additional Fields
  title?: string;
  approvedAmount?: number | null;
  actualAmount?: number | null;
  currencyCode?: string;
  exchangeRateToIDR?: number;
  requiredDate?: string | null;
  approvalDate?: string | null;
  completionDate?: string | null;
  justification?: string | null;
  vendorName?: string | null;
  vendorContact?: string | null;
  notes?: string | null;
}

type SelectedItemForModification = {
  item: PRFItem;
  prfStatus: string;
};

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
  ApprovedAmount?: number;
  ActualAmount?: number;
  CurrencyCode?: string;
  ExchangeRateToIDR?: number;
  Amount?: number;
  RequiredFor?: string;
  BudgetYear?: number;
  Department?: string;
  Priority?: string;
  Status?: string;
  ApprovedByName?: string;
  RequiredDate?: string;
  ApprovalDate?: string;
  CompletionDate?: string;
  Justification?: string;
  VendorName?: string;
  VendorContact?: string;
  Notes?: string;
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

interface PRFDetailRawData {
  PRFID?: number;
  PRFNo?: string;
  Title?: string;
  Description?: string;
  Department?: string;
  PurchaseCostCode?: string;
  RequiredFor?: string;
  BudgetYear?: number;
  RequestedAmount?: number;
  ApprovedAmount?: number | null;
  ActualAmount?: number | null;
  CurrencyCode?: string;
  ExchangeRateToIDR?: number;
  Priority?: string;
  Status?: string;
  DateSubmit?: string;
  SubmitBy?: string;
  RequiredDate?: string | null;
  ApprovalDate?: string | null;
  CompletionDate?: string | null;
  ApprovedByName?: string | null;
  VendorName?: string | null;
  VendorContact?: string | null;
  Justification?: string | null;
  Notes?: string | null;
  UpdatedAt?: string;
}

interface PRFDetailApiResponse {
  success: boolean;
  data?: PRFDetailRawData;
  message?: string;
}

interface ExportPRFRow {
  PRFID: number;
  PRFNo: string;
  Title: string;
  Description: string;
  Department: string;
  PurchaseCostCode: string;
  RequiredFor: string;
  BudgetYear: number;
  RequestedAmount: number;
  ApprovedAmount: number | null;
  ActualAmount: number | null;
  CurrencyCode: string;
  ExchangeRateToIDR: number;
  Priority: string;
  Status: string;
  DateSubmit: string;
  SubmitBy: string;
  RequiredDate: string | null;
  ApprovalDate: string | null;
  CompletionDate: string | null;
  ApprovedByName: string | null;
  VendorName: string | null;
  VendorContact: string | null;
  Justification: string | null;
  Notes: string | null;
  UpdatedAt: string;
}

interface ExportPRFItemRow {
  PRFID: number;
  PRFNo: string;
  PRFItemID: number;
  ItemName: string;
  Description: string;
  Quantity: number;
  UnitPrice: number;
  TotalPrice: number;
  Status: string;
  StatusOverridden: boolean;
  PickedUpBy: string | null;
  PickedUpByUserID: number | null;
  PickedUpDate: string | null;
  Notes: string | null;
  PurchaseCostCode: string | null;
  OriginalPONumber: string | null;
  SplitPONumber: string | null;
  COAID: number | null;
  BudgetYear: number | null;
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
  const location = useLocation();
  const currentYear = new Date().getFullYear();
  const [searchTerm, setSearchTerm] = useState("");
  const [committedSearchTerm, setCommittedSearchTerm] = useState("");
  const activeListRequest = useRef<AbortController | null>(null);
  useEffect(() => () => activeListRequest.current?.abort(), []);
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(currentYear.toString());
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [splitPoFilter, setSplitPoFilter] = useState<"all" | "split">("all");
  const [prfData, setPrfData] = useState<PRFData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [availableStatusValues, setAvailableStatusValues] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activePRFId, setActivePRFId] = useState<string | null>(null);
  const [allItemsOpen, setAllItemsOpen] = useState(false);
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [itemsClosing, setItemsClosing] = useState(false);
  const itemsCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (itemsCloseTimer.current) clearTimeout(itemsCloseTimer.current); }, []);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const listRegion = useRef<HTMLDivElement>(null);
  const lastItemTrigger = useRef<HTMLElement | null>(null);
  const lastEditItemTrigger = useRef<HTMLElement | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [selectedItemForModification, setSelectedItemForModification] = useState<SelectedItemForModification | null>(null);
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
  const [isProntoSyncingId, setIsProntoSyncingId] = useState<string | null>(null);
  const [isProntoSelectedSyncing, setIsProntoSelectedSyncing] = useState<boolean>(false);
  const [availableSubmitYears, setAvailableSubmitYears] = useState<number[]>([]);
  const availableYearValues = useMemo(() => {
    const years = new Set<number>([currentYear, ...availableSubmitYears]);
    prfData.forEach((prf) => {
      const submitDate = new Date(prf.dateSubmit);
      if (!Number.isNaN(submitDate.getTime())) {
        years.add(submitDate.getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [availableSubmitYears, currentYear, prfData]);

  // Fetch PRF data from API
  const fetchPRFData = useCallback(async () => {
    activeListRequest.current?.abort();
    const controller = new AbortController();
    activeListRequest.current = controller;
    try {
      setLoading(true);
      setError(null);
      
      const listTokens = Array.from(
        new Set(
          committedSearchTerm
            .split(/[\s,]+/g)
            .map((v) => v.trim())
            .filter((v) => v.length > 0)
        )
      );
      const isListSearch = listTokens.length > 1;

      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(committedSearchTerm && !isListSearch && { search: committedSearchTerm }),
        ...(isListSearch && { searchList: listTokens.join(',') }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(departmentFilter !== 'all' && { department: departmentFilter }),
        ...(priorityFilter !== 'all' && { priority: priorityFilter }),
        ...(yearFilter !== 'all' && { year: yearFilter }),
        ...(splitPoFilter !== 'all' && { hasSplitPo: 'true' })
      });

      const response = await fetch(`/api/prfs/with-items?${queryParams}`, { signal: controller.signal });
      
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
          approvedByName: prf.ApprovedByName,
          lastUpdate: prf.UpdatedAt || prf.LastUpdate || prf.RequestDate || '',
          items: prf.Items || [],
          
          title: prf.Title,
          approvedAmount: prf.ApprovedAmount,
          actualAmount: prf.ActualAmount,
          currencyCode: prf.CurrencyCode,
          exchangeRateToIDR: prf.ExchangeRateToIDR,
          requiredDate: prf.RequiredDate,
          approvalDate: prf.ApprovalDate,
          completionDate: prf.CompletionDate,
          justification: prf.Justification,
          vendorName: prf.VendorName,
          vendorContact: prf.VendorContact,
          notes: prf.Notes
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
      if (activeListRequest.current === controller) setLoading(false);
    }
  }, [pagination.page, pagination.limit, committedSearchTerm, statusFilter, departmentFilter, priorityFilter, yearFilter, splitPoFilter]);

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

  const fetchSubmitYears = async () => {
    try {
      const response = await fetch('/api/prfs/filters/years', {
        headers: authService.getAuthHeaders()
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const years = result.data
            .map((value: unknown) => Number(value))
            .filter((value: number) => Number.isInteger(value) && value > 0);
          setAvailableSubmitYears(years);
        }
      }
    } catch (error) {
      console.error('Error fetching submit years:', error);
      setAvailableSubmitYears([]);
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
    fetchSubmitYears();
    fetchChartOfAccounts();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const search = params.get('search');
    if (search && search.trim().length > 0) {
      setSearchTerm(search.trim());
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [location.search]);

  // List requests follow committed search/filter/page state. Older responses are aborted.
  useEffect(() => {
    fetchPRFData();
    setSelectedItems(new Set());
  }, [fetchPRFData]);

  // Reset paging only when search changes, never after a page-navigation click.
  useEffect(() => {
    if (searchTerm === committedSearchTerm) return;
    const timeoutId = setTimeout(() => {
      setCommittedSearchTerm(searchTerm);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, committedSearchTerm]);

  // Since filtering is now done on the backend, we use prfData directly
  const filteredData = prfData;

  // Resolve the selected PRF from refreshed list data, never a stale record snapshot.
  const activePRF = activePRFId ? filteredData.find(prf => prf.id === activePRFId) : undefined;
  const panelPRFs = allItemsOpen ? filteredData.filter(prf => prf.items?.length) : activePRF ? [activePRF] : [];
  const panelOpen = panelPRFs.length > 0 && !itemsModalOpen;

  useEffect(() => {
    if (!loading && !error && activePRFId && !prfData.some(prf => prf.id === activePRFId)) setActivePRFId(null);
  }, [prfData, activePRFId, loading, error]);

  const cancelItemsClose = () => {
    if (itemsCloseTimer.current) clearTimeout(itemsCloseTimer.current);
    itemsCloseTimer.current = null;
    setItemsClosing(false);
  };

  const closeItemsPanel = () => {
    if (itemsClosing) return;
    const finish = () => {
      itemsCloseTimer.current = null;
      setItemsClosing(false);
      setItemsModalOpen(false);
      setActivePRFId(null);
      setAllItemsOpen(false);
    };
    if (panelOpen && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setItemsClosing(true);
      itemsCloseTimer.current = setTimeout(finish, 160);
    } else finish();
    requestAnimationFrame(() => {
      if (lastItemTrigger.current?.isConnected) lastItemTrigger.current.focus();
      else listRegion.current?.focus();
    });
  };
  const toggleRowExpansion = (prfId: string, trigger?: HTMLElement) => {
    cancelItemsClose();
    lastItemTrigger.current = trigger ?? null;
    setAllItemsOpen(false);
    setActivePRFId(prfId);
  };

  const expandAllRows = () => {
    cancelItemsClose();
    lastItemTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAllItemsOpen(true);
    setActivePRFId(null);
  };
  const collapseAllRows = closeItemsPanel;

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

  const formatExportDate = (value: unknown): string | null => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return null;
  };

  const fetchPRFDetailForExport = async (prfId: string): Promise<PRFDetailRawData | null> => {
    const response = await fetch(`/api/prfs/${encodeURIComponent(prfId)}`);
    if (!response.ok) return null;
    const result = (await response.json()) as PRFDetailApiResponse;
    if (!result.success || !result.data) return null;
    return result.data;
  };

  const handleBulkExport = async () => {
    const selectedPRFs = filteredData.filter((prf) => selectedItems.has(prf.id));
    if (selectedPRFs.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one PRF to export.",
        variant: "destructive",
      });
      return;
    }

    const detailById = new Map<string, PRFDetailRawData>();
    const chunkSize = 10;
    for (let i = 0; i < selectedPRFs.length; i += chunkSize) {
      const chunk = selectedPRFs.slice(i, i + chunkSize);
      const details = await Promise.all(chunk.map((prf) => fetchPRFDetailForExport(prf.id)));
      details.forEach((detail, idx) => {
        const prfId = chunk[idx]?.id;
        if (prfId && detail) detailById.set(prfId, detail);
      });
    }

    const prfRows: ExportPRFRow[] = selectedPRFs.map((prf) => {
      const detail = detailById.get(prf.id);
      return {
        PRFID: Number.parseInt(prf.id, 10),
        PRFNo: detail?.PRFNo || prf.prfNo,
        Title: detail?.Title || prf.title || prf.description,
        Description: detail?.Description || prf.description,
        Department: detail?.Department || prf.department,
        PurchaseCostCode: detail?.PurchaseCostCode || prf.purchaseCostCode,
        RequiredFor: detail?.RequiredFor || prf.requiredFor,
        BudgetYear: detail?.BudgetYear || prf.budgetYear,
        RequestedAmount: detail?.RequestedAmount ?? prf.amount,
        ApprovedAmount: detail?.ApprovedAmount ?? prf.approvedAmount ?? null,
        ActualAmount: detail?.ActualAmount ?? prf.actualAmount ?? null,
        CurrencyCode: detail?.CurrencyCode || prf.currencyCode || 'IDR',
        ExchangeRateToIDR: detail?.ExchangeRateToIDR ?? prf.exchangeRateToIDR ?? 1,
        Priority: detail?.Priority || prf.priority,
        Status: detail?.Status || prf.progress,
        DateSubmit: detail?.DateSubmit || prf.dateSubmit,
        SubmitBy: detail?.SubmitBy || prf.submitBy,
        RequiredDate: detail?.RequiredDate ?? prf.requiredDate ?? null,
        ApprovalDate: detail?.ApprovalDate ?? prf.approvalDate ?? null,
        CompletionDate: detail?.CompletionDate ?? prf.completionDate ?? null,
        ApprovedByName: detail?.ApprovedByName ?? prf.approvedByName ?? null,
        VendorName: detail?.VendorName ?? prf.vendorName ?? null,
        VendorContact: detail?.VendorContact ?? prf.vendorContact ?? null,
        Justification: detail?.Justification ?? prf.justification ?? null,
        Notes: detail?.Notes ?? prf.notes ?? null,
        UpdatedAt: detail?.UpdatedAt || prf.lastUpdate,
      };
    });

    const itemRows: ExportPRFItemRow[] = selectedPRFs.flatMap((prf) =>
      (prf.items || []).map((item) => ({
        PRFID: Number.parseInt(prf.id, 10),
        PRFNo: prf.prfNo,
        PRFItemID: item.PRFItemID ?? item.ItemID ?? 0,
        ItemName: item.ItemName,
        Description: item.Description,
        Quantity: item.Quantity,
        UnitPrice: item.UnitPrice,
        TotalPrice: item.TotalPrice,
        Status: item.Status || '',
        StatusOverridden: Boolean(item.StatusOverridden),
        PickedUpBy: item.PickedUpBy ?? null,
        PickedUpByUserID: item.PickedUpByUserID ?? null,
        PickedUpDate: formatExportDate(item.PickedUpDate),
        Notes: item.Notes ?? null,
        PurchaseCostCode: item.PurchaseCostCode ?? null,
        OriginalPONumber: item.OriginalPONumber ?? null,
        SplitPONumber: item.SplitPONumber ?? null,
        COAID: item.COAID ?? null,
        BudgetYear: item.BudgetYear ?? null,
      }))
    );

    const workbook = XLSX.utils.book_new();
    const prfSheet = XLSX.utils.json_to_sheet(prfRows);
    XLSX.utils.book_append_sheet(workbook, prfSheet, "PRFs");

    const itemSheet = XLSX.utils.json_to_sheet(itemRows);
    XLSX.utils.book_append_sheet(workbook, itemSheet, "PRF Items");

    const now = new Date();
    const pad = (n: number): string => n.toString().padStart(2, '0');
    const filename = `PRF_Export_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;
    XLSX.writeFile(workbook, filename);

    toast({
      title: "Export Complete",
      description: `${selectedPRFs.length} PRF exported to Excel.`,
    });
  };

  const handleBulkArchive = () => {
    // TODO: Implement bulk archive functionality
  };

  // Item modification handlers
  const handleItemModification = (item: PRFItem, prfStatus: string) => {
    lastEditItemTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedItemForModification({ item, prfStatus });
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
    const canManageContent = user.role === 'admin' || user.role === 'doccon';
    if (!canManageContent) {
      toast({ title: "Not Allowed", description: "Admin or Document Control role is required to sync.", variant: "destructive" });
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
    const canManageContent = user.role === 'admin' || user.role === 'doccon';
    if (!canManageContent) {
      toast({ title: "Not Allowed", description: "Admin or Document Control role is required to sync.", variant: "destructive" });
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

  const handleProntoSyncNow = async (prfNo: string) => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to sync", variant: "destructive" });
      return;
    }
    const canManageContent = user.role === 'admin' || user.role === 'doccon';
    if (!canManageContent) {
      toast({ title: "Not Allowed", description: "Admin or Document Control role is required to run Pronto sync.", variant: "destructive" });
      return;
    }
    setIsProntoSyncingId(prfNo);
    try {
      const response = await fetch(`/api/settings/pronto-sync/run-now?prfNo=${encodeURIComponent(prfNo)}`, {
        method: 'POST',
        headers: authService.getAuthHeaders()
      });
      if (!response.ok) {
        const text = await response.text();
        toast({ title: "Request Failed", description: text || "Failed to request Pronto sync run.", variant: "destructive" });
        return;
      }
      toast({ title: "Requested", description: `Pronto sync requested for PRF ${prfNo}. Worker will pick it up shortly.` });
    } catch (error) {
      toast({ title: "Request Failed", description: error instanceof Error ? error.message : "Network error", variant: "destructive" });
    } finally {
      setIsProntoSyncingId(null);
    }
  };

  const handleProntoSyncSelected = async () => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to sync", variant: "destructive" });
      return;
    }
    const canManageContent = user.role === 'admin' || user.role === 'doccon';
    if (!canManageContent) {
      toast({ title: "Not Allowed", description: "Admin or Document Control role is required to run Pronto sync.", variant: "destructive" });
      return;
    }
    const selectedPrfNos: string[] = prfData.filter((p) => selectedItems.has(p.id)).map((p) => p.prfNo);
    if (selectedPrfNos.length === 0) {
      toast({ title: "No Selection", description: "Select at least one PRF to sync from Pronto" });
      return;
    }
    setIsProntoSelectedSyncing(true);
    try {
      const response = await fetch('/api/settings/pronto-sync/run-now', {
        method: 'POST',
        headers: {
          ...authService.getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prfNos: selectedPrfNos })
      });
      if (!response.ok) {
        const text = await response.text();
        toast({ title: "Request Failed", description: text || "Failed to request Pronto sync run.", variant: "destructive" });
        return;
      }
      toast({ title: "Requested", description: `Pronto sync requested for ${selectedPrfNos.length} PRFs.` });
    } catch (error) {
      toast({ title: "Request Failed", description: error instanceof Error ? error.message : "Network error", variant: "destructive" });
    } finally {
      setIsProntoSelectedSyncing(false);
    }
  };

  return (
    <div className="merdeka-prf space-y-6">
      <nav className="merdeka-breadcrumb" aria-label="Breadcrumb"><a href="/">Dashboard</a><span aria-hidden="true">›</span><span aria-current="page">PRF Monitoring</span></nav>
      <div className="merdeka-page-heading flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PRF Monitoring</h1>
          <p className="text-muted-foreground">
            Track and manage purchase request forms
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
            disabled={isSelectedSyncing || selectedItems.size === 0 || !(user?.role === 'admin' || user?.role === 'doccon')}
          >
            {isSelectedSyncing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4 mr-2" />
            )}
            Sync Selected PRFs
          </Button>
          <Button
            variant="outline"
            onClick={handleProntoSyncSelected}
            disabled={isProntoSelectedSyncing || selectedItems.size === 0 || !(user?.role === 'admin' || user?.role === 'doccon')}
          >
            {isProntoSelectedSyncing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Waypoints className="h-4 w-4 mr-2" />
            )}
            Sync Selected via Pronto
          </Button>
          <ExcelImportDialog />
        </div>
      </div>

      <Card className="merdeka-filter-card mdka-v-card" data-state={filtersOpen ? 'open' : 'closed'}>
        <CardHeader className="merdeka-card-header merdeka-filter-heading">
          <CardTitle>
            <button type="button" className="merdeka-filter-toggle" aria-expanded={filtersOpen} aria-controls="prf-filter-fields" onClick={() => setFiltersOpen(open => !open)}>
              <span className="flex items-center gap-2"><Filter className="h-4 w-4" />Filters<span className="merdeka-filter-active">{[Boolean(searchTerm.trim()), statusFilter !== 'all', priorityFilter !== 'all', departmentFilter !== 'all', yearFilter !== 'all', splitPoFilter !== 'all'].filter(Boolean).length} active</span></span>
              <span className="merdeka-filter-toggle-hint" aria-hidden="true">{filtersOpen ? 'Hide filters' : 'Show filters'}<ChevronDown className={filtersOpen ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} /></span>
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent id="prf-filter-fields" hidden={!filtersOpen}>
          <div className="flex flex-col gap-4">
            <div className="merdeka-filter-grid">
              <div className="flex-1">
                <div className="merdeka-search relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    aria-label="Search purchase requests"
                    placeholder="PRF number, description, requester..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 pr-8"
                  />
                  {searchTerm && <button type="button" className="merdeka-search-clear" aria-label="Clear search" onClick={() => setSearchTerm("")}>×</button>}
                </div>
              </div>
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPagination(prev => ({ ...prev, page: 1 })); }}>
                <SelectTrigger aria-label="Filter by status" className="w-[180px]">
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
              <Select value={priorityFilter} onValueChange={(value) => { setPriorityFilter(value); setPagination(prev => ({ ...prev, page: 1 })); }}>
                <SelectTrigger aria-label="Filter by priority" className="w-[140px]">
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
              <Select value={departmentFilter} onValueChange={(value) => { setDepartmentFilter(value); setPagination(prev => ({ ...prev, page: 1 })); }}>
                <SelectTrigger aria-label="Filter by department" className="w-[140px]">
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
              <Select value={yearFilter} onValueChange={(value) => { setYearFilter(value); setPagination(prev => ({ ...prev, page: 1 })); }}>
                <SelectTrigger aria-label="Filter by year" className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYearValues.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={splitPoFilter}
                onValueChange={(value) => {
                  if (value === "all" || value === "split") { setSplitPoFilter(value); setPagination(prev => ({ ...prev, page: 1 })); }
                }}
              >
                <SelectTrigger aria-label="Filter by split PO" className="w-[160px]">
                  <SelectValue placeholder="Split PO" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All PO</SelectItem>
                  <SelectItem value="split">Split PO Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={`merdeka-prf-split ${panelOpen ? 'has-panel' : ''} ${showAllColumns ? 'show-all-columns' : ''}`}>
      <Card className="merdeka-list-card mdka-v-card">
        <CardHeader className="merdeka-card-header">
          <div className="flex items-center justify-between">
            <CardTitle>
              PRF List ({pagination.total} items)
              {loading && <span className="text-sm text-muted-foreground ml-2">Loading...</span>}
              {selectedItems.size > 0 && (
                <span className="text-sm text-blue-600 ml-2">({selectedItems.size} selected)</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={expandAllRows} disabled={loading || !filteredData.some(prf => prf.items?.length)}><Expand className="h-4 w-4 mr-1" />Show all items</Button>
              <Button variant="outline" size="sm" onClick={collapseAllRows} disabled={!panelOpen}><Minimize className="h-4 w-4 mr-1" />Close items</Button>
              {panelOpen && <Button variant="outline" size="sm" aria-pressed={showAllColumns} onClick={() => setShowAllColumns(value => !value)}>{showAllColumns ? 'Compact columns' : 'All columns'}</Button>}
              {/* Page Size Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show:</span>
                <Select value={pagination.limit.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger aria-label="Rows per page" className="w-20">
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
              <div ref={listRegion} className="merdeka-table-scroll" aria-busy={loading} role="region" aria-label="Purchase requests table" tabIndex={0}>
                <Table className="merdeka-table min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 sticky left-0 bg-background z-10">
                        <input
                          type="checkbox"
                          aria-label="Select all purchase requests on this page"
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
                      <TableHead className="min-w-[150px]">Approved By</TableHead>
                      <TableHead className="min-w-[120px] sticky right-0 bg-background z-10">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          Loading PRF data...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                        No PRF data found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((prf) => (
                      <React.Fragment key={prf.id}>
                        <TableRow
                          data-state={selectedItems.has(prf.id) ? 'selected' : undefined}
                          data-active={activePRFId === prf.id || allItemsOpen ? 'true' : undefined}
                          className={`${prf.items && prf.items.length > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                          onClick={(event) => prf.items && prf.items.length > 0 && toggleRowExpansion(prf.id, event.currentTarget.querySelector<HTMLButtonElement>('[data-item-trigger]') ?? undefined)}
                        >
                          <TableCell className="sticky left-0 bg-background z-10" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${prf.prfNo}`}
                              checked={selectedItems.has(prf.id)}
                              onChange={(e) => handleSelectItem(prf.id, e.target.checked)}
                              className="rounded border-gray-300"
                            />
                          </TableCell>
                          <TableCell className="sticky left-12 bg-background z-10">
                            {prf.items && prf.items.length > 0 && (
                              <button type="button" data-item-trigger className="merdeka-row-expand" aria-label={`View items for ${prf.prfNo}`} aria-expanded={panelOpen && (activePRFId === prf.id || allItemsOpen)} aria-controls="prf-items-panel" onClick={(event) => { event.stopPropagation(); toggleRowExpansion(prf.id, event.currentTarget); }}>
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="font-medium sticky left-20 bg-background z-10">
                            <div className="merdeka-prf-identity">
                              <div className="merdeka-prf-number"><span>{prf.prfNo}</span>
                                {prf.items && prf.items.length > 0 && (
                                  <Badge variant="secondary" className="merdeka-item-count whitespace-nowrap">
                                    {prf.items.length} {prf.items.length === 1 ? 'item' : 'items'}
                                  </Badge>
                                )}
                              </div>
                              <div className="merdeka-prf-sync-actions">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={(e) => { e.stopPropagation(); handleSyncPRF(prf.prfNo); }}
                                  disabled={syncingId === prf.prfNo || !(user?.role === 'admin' || user?.role === 'doccon')}
                                  aria-label="Sync this PRF from Cloud"
                                >
                                  {syncingId === prf.prfNo ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <CloudDownload className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={(e) => { e.stopPropagation(); handleProntoSyncNow(prf.prfNo); }}
                                  disabled={isProntoSyncingId === prf.prfNo || !(user?.role === 'admin' || user?.role === 'doccon')}
                                  aria-label="Sync this PRF from Pronto"
                                >
                                  {isProntoSyncingId === prf.prfNo ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Waypoints className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{new Date(prf.dateSubmit).toLocaleDateString('id-ID')}</TableCell>
                          <TableCell className="truncate max-w-[120px]" title={prf.submitBy}>{prf.submitBy}</TableCell>
                          <TableCell className="truncate max-w-[200px]" title={prf.description}><span className="merdeka-prf-description">{prf.description}</span></TableCell>
                          <TableCell><CostCodeDisplay prf={prf} /></TableCell>
                          <TableCell className="font-medium text-right whitespace-nowrap">{formatCurrency(prf.amount)}</TableCell>
                          <TableCell className="truncate max-w-[150px]" title={prf.requiredFor}>{prf.requiredFor}</TableCell>
                          <TableCell><Badge variant="outline" className="whitespace-nowrap">{prf.department}</Badge></TableCell>
                          <TableCell>{getPriorityBadge(prf.priority)}</TableCell>
                          <TableCell className="whitespace-nowrap">{prf.budgetYear}</TableCell>
                          <TableCell>{getStatusBadge(prf.progress)}</TableCell>
                          <TableCell className="truncate max-w-[150px]" title={prf.approvedByName || ''}>{prf.approvedByName || '-'}</TableCell>
                          <TableCell className="sticky right-0 bg-background z-10" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <PRFDetailDialog prf={prf} onRefresh={fetchPRFData} />
                              <PRFEditDialog prf={prf} onPRFUpdated={fetchPRFData} />
                              <PRFDeleteDialog prf={prf} onPRFDeleted={fetchPRFData} />
                            </div>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
              
              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="merdeka-pagination flex items-center justify-between mt-4">
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
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, index) => {
                      const first = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4));
                      const page = first + index;
                      return <Button key={page} variant={page === pagination.page ? "default" : "outline"} size="sm" aria-label={`Page ${page}`} aria-current={page === pagination.page ? "page" : undefined} disabled={loading} onClick={() => setPagination(prev => ({ ...prev, page }))}>{page}</Button>;
                    })}
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
      {panelOpen && (
        <PRFItemsPanel closing={itemsClosing} onExpand={() => { cancelItemsClose(); setItemsModalOpen(true); }} prfs={panelPRFs} allItems={allItemsOpen} loading={loading} error={error} onClose={closeItemsPanel} onRetry={fetchPRFData} onEdit={handleItemModification} statusBadge={getStatusBadge} formatCurrency={formatCurrency} getCOAName={getCOAName} />
      )}
      </div>


      <Dialog open={itemsModalOpen && panelPRFs.length > 0} onOpenChange={open => { if (!open) closeItemsPanel(); }}>
        <DialogContent className="merdeka-detail merdeka-items-dialog" onCloseAutoFocus={event => { event.preventDefault(); }}>
          <DialogTitle className="sr-only">{allItemsOpen ? 'All PRF items on this page' : `PRF ${panelPRFs[0]?.prfNo ?? ''} items`}</DialogTitle>
          <DialogDescription className="sr-only">Detailed item table including part numbers, cost codes and purchase order splits.</DialogDescription>
          {itemsModalOpen && panelPRFs.length > 0 && <PRFItemsPanel expanded prfs={panelPRFs} allItems={allItemsOpen} loading={loading} error={error} onClose={closeItemsPanel} onRetry={fetchPRFData} onEdit={handleItemModification} statusBadge={getStatusBadge} formatCurrency={formatCurrency} getCOAName={getCOAName} />}
        </DialogContent>
      </Dialog>

      {/* Item Modification Modal */}
      {selectedItemForModification && (
        <PRFItemModificationModal
          onCloseAutoFocus={event => { event.preventDefault(); if (lastEditItemTrigger.current?.isConnected) lastEditItemTrigger.current.focus(); else listRegion.current?.focus(); }}
          isOpen={isModificationModalOpen}
          onClose={() => {
            setIsModificationModalOpen(false);
            setSelectedItemForModification(null);
          }}
          item={selectedItemForModification.item}
          prfStatus={selectedItemForModification.prfStatus}
          onUpdate={handleItemUpdate}
        />
      )}
    </div>
  );
}
