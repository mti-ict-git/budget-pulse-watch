import { authService } from './authService';

interface CostCodeBudget {
  PurchaseCostCode: string;
  COACode: string;
  COAName: string;
  Department: string;
  ExpenseType: 'CAPEX' | 'OPEX';
  GrandTotalAllocated: number | null;
  GrandTotalRequested: number | null;
  GrandTotalApproved: number | null;
  GrandTotalActual: number | null;
  TotalRequests: number;
  YearsActive: number;
  FirstYear: number;
  LastYear: number;
  UtilizationPercentage: number;
  ApprovalRate: number | null;
  BudgetStatus: string;
  // Computed properties for display
  RemainingAmount?: number;
  AllocatedAmount?: number;
}

interface Budget {
  BudgetID: number;
  COAID: number;
  FiscalYear: number;
  Quarter?: number;
  Month?: number;
  AllocatedAmount: number;
  UtilizedAmount: number;
  RemainingAmount: number;
  UtilizationPercentage: number;
  Notes?: string;
  CreatedBy: number;
  CreatedAt: Date;
  UpdatedAt: Date;
  Description?: string;
  IsActive?: boolean;
  ExpenseType?: 'CAPEX' | 'OPEX';
  // Additional fields from joins
  COACode?: string;
  COAName?: string;
  Department?: string;
  BudgetType?: string;
}

interface CreateBudgetRequest {
  COAID: number;
  FiscalYear: number;
  Quarter?: number;
  Month?: number;
  AllocatedAmount: number;
  Description?: string;
  Department: string;
  BudgetType?: string;
  ExpenseType?: 'CAPEX' | 'OPEX';
  StartDate?: Date;
  EndDate?: Date;
  Notes?: string;
}

interface UpdateBudgetRequest {
  COAID?: number;
  FiscalYear?: number;
  AllocatedAmount?: number;
  UtilizedAmount?: number;
  Description?: string;
  Department?: string;
  BudgetType?: string;
  ExpenseType?: 'CAPEX' | 'OPEX';
  StartDate?: Date;
  EndDate?: Date;
  Status?: string;
  Notes?: string;
  IsActive?: boolean;
}

interface BudgetQueryParams {
  page?: number;
  limit?: number;
  fiscalYear?: number;
  quarter?: number;
  month?: number;
  coaId?: number;
  category?: string;
  utilizationLevel?: string;
  department?: string;
  budgetType?: string;
  expenseType?: 'CAPEX' | 'OPEX';
  status?: string;
  search?: string;
}

interface BudgetListResponse {
  success: boolean;
  data?: Budget[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
  error?: string;
}

interface BudgetResponse {
  success: boolean;
  data?: Budget;
  message?: string;
  error?: string;
}

interface ChartOfAccount {
  COAID: number;
  COACode: string;
  COAName: string;
  Description?: string;
  Category?: string;
}

interface BudgetSummary {
  totalCostCodes: number;
  totalBudgetAllocated: number;
  totalBudgetRequested: number;
  totalBudgetApproved: number;
  totalBudgetActual: number;
  overallUtilization: number;
  overallApprovalRate: number;
  // Legacy properties for backward compatibility
  totalBudget?: number;
  totalSpent?: number;
  totalRemaining?: number;
  overBudgetCount?: number;
  criticalCount?: number;
  warningCount?: number;
  healthyCount?: number;
}

export interface DashboardMetrics {
  fiscalYear: number;
  budget: {
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    overallUtilization: number;
    totalBudgetItems: number;
    overBudgetCount: number;
  };
  prfs: {
    totalPRFs: number;
    approvedPRFs: number;
    pendingPRFs: number;
    rejectedPRFs: number;
  };
  expenseBreakdown: {
    expenseType: string;
    totalAllocated: number;
    totalSpent: number;
    budgetCount: number;
    utilization: number;
  }[];
}

interface UtilizationData {
  category: string;
  expenseType: string;
  totalAllocated: number;
  totalSpent: number;
  utilizationPercentage: number;
  budgetCount: number;
  department?: string;
}

interface DashboardResponse {
  success: boolean;
  data?: DashboardMetrics;
  message?: string;
  error?: string;
}

interface UtilizationResponse {
  success: boolean;
  data?: UtilizationData[];
  message?: string;
  error?: string;
}

interface UnallocatedBudget {
  budgetId: number;
  purchaseCostCode: string;
  coaCode: string;
  coaName: string;
  category: string;
  department: string;
  expenseType: string;
  allocatedAmount: number;
  totalSpent: number;
  reasonType: 'Zero Allocation' | 'Non-IT Department' | 'Other';
}

interface UnallocatedBudgetSummary {
  zeroAllocationCount: number;
  nonITCount: number;
  zeroAllocationSpent: number;
  nonITBudget: number;
  nonITSpent: number;
  totalItems: number;
}

interface UnallocatedBudgetData {
  fiscalYear: number;
  budgets: UnallocatedBudget[];
  summary: UnallocatedBudgetSummary;
}

interface UnallocatedBudgetResponse {
  success: boolean;
  data?: UnallocatedBudgetData;
  message?: string;
  error?: string;
}

interface PRFCostCodeBudget {
  CostCode: string;
  COAName: string;
  TotalBudget: number;
  TotalSpent: number;
  RemainingBudget: number;
  PRFSpent: number;
  ItemCount: number;
  ItemNames: string;
  UtilizationPercentage: number;
}

interface CostCodeBudgetResponse {
  success: boolean;
  data?: {
    costCodes: CostCodeBudget[];
    summary: BudgetSummary;
    fiscalYear: number;
  };
  message?: string;
  error?: string;
}

class BudgetService {
  private baseUrl = '/api/budgets';

  /**
   * Get budget summary data
   */
  async getBudgetSummary(fiscalYear?: number): Promise<BudgetSummary | null> {
    try {
      const response = await this.getCostCodeBudgets(fiscalYear ? { fiscalYear } : undefined);
      
      if (!response.success || !response.data) {
        return null;
      }

      return response.data.summary;
    } catch (error) {
      console.error('Error fetching budget summary:', error);
      return null;
    }
  }

  /**
   * Get cost code budget data
   */
  async getCostCodeBudgets(searchParams?: { search?: string; status?: string; fiscalYear?: number }): Promise<CostCodeBudgetResponse> {
    try {
      const params = new URLSearchParams();
      
      if (searchParams?.fiscalYear) {
        params.append('fiscalYear', searchParams.fiscalYear.toString());
      }
      if (searchParams?.search) {
        params.append('search', searchParams.search);
      }
      if (searchParams?.status) {
        params.append('status', searchParams.status);
      }

      const url = `${this.baseUrl}/cost-codes${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch cost code budget data');
      }

      return data;
    } catch (error) {
      console.error('Error fetching cost code budgets:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Get status badge color based on budget status
   */
  getStatusColor(status: CostCodeBudget['BudgetStatus']): string {
    switch (status) {
      case 'Over Budget':
        return 'bg-red-100 text-red-800';
      case 'Under Budget':
        return 'bg-green-100 text-green-800';
      case 'On Track':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  /**
   * Get utilization level based on percentage
   */
  getUtilizationLevel(percentage: number): 'Low' | 'Medium' | 'High' | 'Critical' {
    if (percentage >= 100) return 'Critical';
    if (percentage >= 90) return 'Critical';
    if (percentage >= 75) return 'High';
    if (percentage >= 50) return 'Medium';
    return 'Low';
  }

  /**
   * Calculate percentage safely
   */
  calculatePercentage(used: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((used / total) * 100);
  }

  /**
   * Get all budgets with filtering and pagination
   */
  async getBudgets(params?: BudgetQueryParams): Promise<BudgetListResponse> {
    try {
      const searchParams = new URLSearchParams();
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            searchParams.append(key, value.toString());
          }
        });
      }

      const url = `${this.baseUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch budgets');
      }

      return data;
    } catch (error) {
      console.error('Error fetching budgets:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get a single budget by ID
   */
  async getBudgetById(id: number): Promise<BudgetResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch budget');
      }

      return data;
    } catch (error) {
      console.error('Error fetching budget:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Create a new budget
   */
  async createBudget(budgetData: CreateBudgetRequest): Promise<BudgetResponse> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(budgetData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create budget');
      }

      return data;
    } catch (error) {
      console.error('Error creating budget:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Update an existing budget
   */
  async updateBudget(id: number, updateData: UpdateBudgetRequest): Promise<BudgetResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update budget');
      }

      return data;
    } catch (error) {
      console.error('Error updating budget:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Delete a budget
   */
  async deleteBudget(id: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete budget');
      }

      return data;
    } catch (error) {
      console.error('Error deleting budget:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get Chart of Accounts for budget creation
   */
  async getChartOfAccounts(): Promise<{ success: boolean; data?: ChartOfAccount[]; message?: string }> {
    try {
      // Request a large limit to get all COA records for the dropdown
      const response = await fetch('/api/coa?limit=1000&isActive=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch chart of accounts');
      }

      return data;
    } catch (error) {
      console.error('Error fetching chart of accounts:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get dashboard metrics including budget totals and utilization
   */
  async getDashboardMetrics(fiscalYear?: number, department?: string): Promise<DashboardResponse> {
    try {
      const params = new URLSearchParams();
      
      if (fiscalYear) {
        params.append('fiscalYear', fiscalYear.toString());
      }
      if (department && department !== 'all') {
        params.append('department', department);
      }

      const response = await fetch(`/api/reports/dashboard?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch dashboard metrics');
      }

      return data;
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get budget utilization data by category and expense type
   */
  async getBudgetUtilization(fiscalYear?: number, expenseType?: string, department?: string): Promise<UtilizationResponse> {
    try {
      const params = new URLSearchParams();
      
      if (fiscalYear) {
        params.append('fiscalYear', fiscalYear.toString());
      }
      if (expenseType && expenseType !== 'all') {
        params.append('expenseType', expenseType);
      }
      if (department && department !== 'all') {
        params.append('department', department);
      }

      const response = await fetch(`/api/reports/budget-utilization?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch budget utilization');
      }

      return data;
    } catch (error) {
      console.error('Error fetching budget utilization:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get cost code budget information for a specific PRF
   */
  async getPRFCostCodeBudgets(prfId: string): Promise<{ success: boolean; data?: PRFCostCodeBudget[]; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/prf/${prfId}/cost-codes`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch PRF cost code budgets');
      }

      return data;
    } catch (error) {
      console.error('Error fetching PRF cost code budgets:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

export const getUtilizationData = async (fiscalYear?: number): Promise<UtilizationData[]> => {
  try {
    const params = new URLSearchParams();
    if (fiscalYear) {
      params.append('fiscalYear', fiscalYear.toString());
    }

    const response = await fetch(`/api/reports/utilization?${params}`, {
      headers: authService.getAuthHeaders(),
    });
    const result: UtilizationResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch utilization data');
    }

    return result.data || [];
  } catch (error) {
    console.error('Error fetching utilization data:', error);
    throw error;
  }
};

export const getUnallocatedBudgets = async (fiscalYear?: number): Promise<UnallocatedBudgetData> => {
  try {
    const params = new URLSearchParams();
    if (fiscalYear) {
      params.append('fiscalYear', fiscalYear.toString());
    }

    const response = await fetch(`/api/reports/unallocated-budgets?${params}`, {
      headers: authService.getAuthHeaders(),
    });
    const result: UnallocatedBudgetResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch unallocated budgets');
    }

    return result.data || {
      fiscalYear: fiscalYear || new Date().getFullYear(),
      budgets: [],
      summary: {
        zeroAllocationCount: 0,
        nonITCount: 0,
        zeroAllocationSpent: 0,
        nonITBudget: 0,
        nonITSpent: 0,
        totalItems: 0
      }
    };
  } catch (error) {
    console.error('Error fetching unallocated budgets:', error);
    throw error;
  }
};

export const budgetService = new BudgetService();
export type { 
  CostCodeBudget, 
  BudgetSummary, 
  CostCodeBudgetResponse, 
  Budget, 
  CreateBudgetRequest, 
  UpdateBudgetRequest, 
  BudgetQueryParams,
  BudgetListResponse,
  BudgetResponse,
  ChartOfAccount,
  UtilizationData,
  UnallocatedBudgetData,
  UnallocatedBudget,
  UnallocatedBudgetSummary
};