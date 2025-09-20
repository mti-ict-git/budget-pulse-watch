interface CostCodeBudget {
  PurchaseCostCode: string;
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
}

interface BudgetSummary {
  totalCostCodes: number;
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
      const response = await this.getCostCodeBudgets(fiscalYear);
      
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
  async getCostCodeBudgets(fiscalYear?: number): Promise<CostCodeBudgetResponse> {
    try {
      const params = new URLSearchParams();
      if (fiscalYear) {
        params.append('fiscalYear', fiscalYear.toString());
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
}

export const budgetService = new BudgetService();
export type { CostCodeBudget, BudgetSummary, CostCodeBudgetResponse };