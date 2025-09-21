interface CostCodeBudget {
  PurchaseCostCode: string;
  COACode: string;
  COAName: string;
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
  ExpenseType?: 'CAPEX' | 'OPEX';
  Department?: string;
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
      const response = await fetch('/api/coa', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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
}

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
  ChartOfAccount
};