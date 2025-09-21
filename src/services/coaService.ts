import { authService } from './authService';

// Types for COA operations
export interface ChartOfAccounts {
  COAID: number;
  COACode: string;
  COAName: string;
  Description?: string;
  Category?: string;
  ParentCOAID?: number;
  ExpenseType: 'CAPEX' | 'OPEX';
  Department: string;
  IsActive: boolean;
  CreatedAt: Date;
}

export interface CreateCOARequest {
  COACode: string;
  COAName: string;
  Category?: string;
  Description?: string;
  ParentCOAID?: number;
  ExpenseType?: 'CAPEX' | 'OPEX';
  Department?: string;
  IsActive?: boolean;
}

export interface UpdateCOARequest {
  COACode?: string;
  COAName?: string;
  Category?: string;
  Description?: string;
  ParentCOAID?: number;
  ExpenseType?: 'CAPEX' | 'OPEX';
  Department?: string;
  IsActive?: boolean;
}

export interface COAQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  parentCOAID?: number;
  expenseType?: 'CAPEX' | 'OPEX';
  department?: string;
  isActive?: boolean;
  search?: string;
}

export interface COAListResponse {
  success: boolean;
  data?: ChartOfAccounts[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
}

export interface COAResponse {
  success: boolean;
  data?: ChartOfAccounts;
  message?: string;
}

export interface COAAccountUsage {
  COAID: number;
  COACode: string;
  COAName: string;
  PRFCount: number;
  BudgetCount: number;
  TotalPRFAmount: number;
  TotalBudgetAmount: number;
}

export interface COAStatistics {
  TotalAccounts: number;
  ActiveAccounts: number;
  InactiveAccounts: number;
  RootAccounts: number;
  Categories: number;
  Departments: number;
}

export interface BulkUpdateCOARequest {
  accountIds: number[];
  updates: {
    Department?: string;
    ExpenseType?: 'CAPEX' | 'OPEX';
    Category?: string;
    IsActive?: boolean;
  };
}

export interface BulkDeleteCOARequest {
  accountIds: number[];
  hard?: boolean;
}

class COAService {
  private baseUrl = '/api/coa';

  /**
   * Get all Chart of Accounts with filtering and pagination
   */
  async getAll(params?: COAQueryParams): Promise<COAListResponse> {
    try {
      const queryString = params ? new URLSearchParams(
        Object.entries(params).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== null) {
            acc[key] = String(value);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString() : '';

      const url = queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch Chart of Accounts');
      }

      return data;
    } catch (error) {
      console.error('Error fetching Chart of Accounts:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get COA by ID
   */
  async getById(id: number): Promise<COAResponse> {
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
        throw new Error(data.message || 'Failed to fetch Chart of Account');
      }

      return data;
    } catch (error) {
      console.error('Error fetching COA by ID:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get COA by account code
   */
  async getByCode(code: string): Promise<COAResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/code/${encodeURIComponent(code)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch Chart of Account');
      }

      return data;
    } catch (error) {
      console.error('Error fetching COA by code:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Create new COA
   */
  async create(coaData: CreateCOARequest): Promise<COAResponse> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(coaData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create Chart of Account');
      }

      return data;
    } catch (error) {
      console.error('Error creating COA:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Update COA
   */
  async update(id: number, updateData: UpdateCOARequest): Promise<COAResponse> {
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
        throw new Error(data.message || 'Failed to update Chart of Account');
      }

      return data;
    } catch (error) {
      console.error('Error updating COA:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Delete COA (soft delete)
   */
  async delete(id: number): Promise<{ success: boolean; message?: string }> {
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
        throw new Error(data.message || 'Failed to delete Chart of Account');
      }

      return data;
    } catch (error) {
      console.error('Error deleting COA:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Hard delete COA (permanent deletion)
   */
  async hardDelete(id: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}/hard`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to permanently delete Chart of Account');
      }

      return data;
    } catch (error) {
      console.error('Error hard deleting COA:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get account usage statistics
   */
  async getAccountUsage(id: number): Promise<{ success: boolean; data?: COAAccountUsage; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}/usage`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch account usage');
      }

      return data;
    } catch (error) {
      console.error('Error fetching account usage:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get COA statistics
   */
  async getStatistics(): Promise<{ success: boolean; data?: COAStatistics; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/statistics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch COA statistics');
      }

      return data;
    } catch (error) {
      console.error('Error fetching COA statistics:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Bulk import COA data
   */
  async bulkImport(accounts: CreateCOARequest[]): Promise<COAListResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/bulk-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({ accounts }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to bulk import accounts');
      }

      return data;
    } catch (error) {
      console.error('Error importing COA accounts:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Bulk update multiple COA records
   */
  async bulkUpdate(bulkData: BulkUpdateCOARequest): Promise<COAListResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/bulk-update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(bulkData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to bulk update accounts');
      }

      return data;
    } catch (error) {
      console.error('Error bulk updating COA accounts:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Bulk delete multiple COA records
   */
  async bulkDelete(bulkData: BulkDeleteCOARequest): Promise<{ success: boolean; message?: string; data?: { deletedCount: number; hard: boolean } }> {
    try {
      const response = await fetch(`${this.baseUrl}/bulk-delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify(bulkData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to bulk delete accounts');
      }

      return data;
    } catch (error) {
      console.error('Error bulk deleting COA accounts:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

export const coaService = new COAService();