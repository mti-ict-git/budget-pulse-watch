// Database model types and interfaces

export interface User {
  UserID: number;
  Username: string;
  Email: string;
  PasswordHash?: string; // Optional for LDAP users
  FirstName: string;
  LastName: string;
  Role: 'admin' | 'doccon' | 'user';
  Department?: string;
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface CreateUserRequest {
  Username: string;
  Email: string;
  Password: string;
  FirstName: string;
  LastName: string;
  Role?: 'admin' | 'doccon' | 'user';
  Department?: string;
}

export interface UpdateUserParams {
  UserID: number;
  Username?: string;
  Email?: string;
  FirstName?: string;
  LastName?: string;
  Role?: 'admin' | 'doccon' | 'user';
  Department?: string;
  PasswordHash?: string;
  [key: string]: unknown;
}

export interface UserQueryParams {
  Offset: number;
  Limit: number;
  Search?: string;
  [key: string]: unknown;
}

export interface UsernameExistsParams {
  Username: string;
  ExcludeUserID?: number;
  [key: string]: unknown;
}

export interface EmailExistsParams {
  Email: string;
  ExcludeUserID?: number;
  [key: string]: unknown;
}

// PRF parameter types
export interface UpdatePRFParams {
  PRFID: number;
  Title?: string;
  Description?: string;
  Department?: string;
  COAID?: number;
  RequestedAmount?: number;
  Priority?: string;
  Status?: string;
  RequiredDate?: Date;
  ApprovedAmount?: number;
  ActualAmount?: number;
  ApprovalDate?: Date;
  CompletionDate?: Date;
  ApprovedBy?: number;
  Justification?: string;
  VendorName?: string;
  VendorContact?: string;
  Notes?: string;
  [key: string]: unknown;
  
  // New fields from Excel analysis
  DateSubmit?: Date;
  SubmitBy?: string;
  SumDescriptionRequested?: string;
  PurchaseCostCode?: string;
  RequiredFor?: string;
  BudgetYear?: number;
}

export interface PRFQueryParams {
  page?: number;
  limit?: number;
  Offset?: number;
  Limit?: number;
  Status?: string;
  Department?: string;
  Priority?: string;
  RequestorID?: number;
  COAID?: number;
  DateFrom?: string;
  DateTo?: string;
  Search?: string;
  [key: string]: unknown;
}

export interface AddPRFItemsParams {
  PRFID: number;
  [key: string]: string | number | null;
}

export interface UpdatePRFItemParams {
  PRFItemID: number;
  ItemName?: string;
  Description?: string;
  Quantity?: number;
  UnitPrice?: number;
  Specifications?: string;
  Status?: 'Pending' | 'Approved' | 'Picked Up' | 'Cancelled' | 'On Hold';
  PickedUpBy?: string;
  PickedUpDate?: Date;
  Notes?: string;
  UpdatedBy?: number;
  StatusOverridden?: boolean;
  
  // Cost code fields - enables multiple cost codes per PRF through item-level assignment
  PurchaseCostCode?: string;
  COAID?: number;
  BudgetYear?: number;
  [key: string]: unknown;
}

export interface PRFStatistics {
  TotalPRFs: number;
  PendingPRFs: number;
  ApprovedPRFs: number;
  CompletedPRFs: number;
  RejectedPRFs: number;
  TotalRequestedAmount: number;
  TotalApprovedAmount: number;
  AvgProcessingDays: number;
}

export interface LoginRequest {
  Username: string;
  Password: string;
}

export interface AuthResponse {
  user: Omit<User, 'PasswordHash'>;
  token: string;
}

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

// COA parameter types for replacing 'any' types
export interface UpdateCOAParams {
  COAID: number;
  COACode?: string;
  COAName?: string;
  Category?: string;
  ParentCOAID?: number;
  Description?: string;
  IsActive?: boolean;
  [key: string]: unknown;
}

export interface COAFindAllParams {
  Offset?: number;
  Limit?: number;
  Category?: string;
  IsActive?: boolean;
  ParentCOAID?: number;
  Search?: string;
  [key: string]: unknown;
}

export interface COABulkImportParams {
  [key: string]: string | number | boolean | null;
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

// Budget parameter types for replacing 'any' types
export interface BudgetUpdateParams {
  BudgetID: number;
  AllocatedAmount?: number;
  UtilizedAmount?: number;
  Description?: string;
  Department?: string;
  BudgetType?: string;
  StartDate?: Date;
  EndDate?: Date;
  Status?: string;
  Notes?: string;
  [key: string]: unknown;
}

export interface BudgetFindAllParams {
  Offset?: number;
  Limit?: number;
  FiscalYear?: number;
  Department?: string;
  BudgetType?: string;
  Status?: string;
  COAID?: number;
  Search?: string;
  [key: string]: unknown;
}

export interface BudgetUtilizationParams {
  Department: string;
  FiscalYear?: number;
  [key: string]: unknown;
}

export interface COAExistsParams {
  COACode: string;
  ExcludeID?: number;
  [key: string]: unknown;
}

export interface BudgetAlert {
  BudgetID: number;
  COAID: number;
  COACode: string;
  COAName: string;
  FiscalYear: number;
  AllocatedAmount: number;
  UtilizedAmount: number;
  RemainingAmount: number;
  UtilizationPercentage: number;
  UtilizationLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  Status: string;
}

export interface BudgetUtilizationSummary {
  Department: string;
  TotalBudgets: number;
  TotalAllocated: number;
  TotalUtilized: number;
  RemainingAmount: number;
  UtilizationPercentage: number;
  OverBudgetCount: number;
  NearLimitCount: number;
}

export interface BudgetStatistics {
  TotalBudgets: number;
  TotalAllocated: number;
  TotalUtilized: number;
  TotalRemaining: number;
  AvgUtilizationPercentage: number;
  OverBudgetCount: number;
  NearLimitCount: number;
}

export interface Budget {
  BudgetID: number;
  COAID: number;
  FiscalYear: number;
  Quarter?: number;
  Month?: number;
  AllocatedAmount: number;
  UtilizedAmount: number;
  RemainingAmount: number;
  UtilizationPercentage: number;
  ExpenseType: 'CAPEX' | 'OPEX';
  Department: string;
  Notes?: string;
  CreatedBy: number;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface CreateBudgetRequest {
  COAID: number;
  FiscalYear: number;
  Quarter?: number;
  Month?: number;
  AllocatedAmount: number;
  ExpenseType?: 'CAPEX' | 'OPEX';
  Description?: string;
  Department: string;
  BudgetType?: string;
  StartDate?: Date;
  EndDate?: Date;
  Notes?: string;
}

export interface UpdateBudgetRequest {
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
}

export interface PRF {
  PRFID: number;
  PRFNo: string;
  Title: string;
  Description?: string;
  RequestorID: number;
  Department: string;
  COAID: number;
  RequestedAmount: number;
  ApprovedAmount?: number;
  ActualAmount?: number;
  Priority: 'Low' | 'Medium' | 'High' | 'Critical';
  Status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed' | 'Cancelled';
  RequestDate: Date;
  RequiredDate?: Date;
  ApprovalDate?: Date;
  CompletionDate?: Date;
  ApprovedBy?: number;
  Justification?: string;
  VendorName?: string;
  VendorContact?: string;
  AttachmentPath?: string;
  Notes?: string;
  CreatedAt: Date;
  UpdatedAt: Date;
  
  // New fields from Excel analysis
  DateSubmit?: Date;                    // Excel: "Date Submit"
  SubmitBy?: string;                    // Excel: "Submit By"
  SumDescriptionRequested?: string;     // Excel: "Sum Description Requested"
  PurchaseCostCode?: string;            // Excel: "Purchase Cost Code"
  RequiredFor?: string;                 // Excel: "Required for"
  BudgetYear?: number;                  // Excel: "Budget"
}

export interface CreatePRFRequest {
  PRFNo: string;
  Title: string;
  Description?: string;
  Department: string;
  COAID: number;
  RequestedAmount: number;
  Priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  RequiredDate?: Date;
  Justification?: string;
  VendorName?: string;
  VendorContact?: string;
  Notes?: string;
  Items?: CreatePRFItemRequest[];
  
  // New fields from Excel analysis
  DateSubmit?: Date;
  SubmitBy?: string;
  SumDescriptionRequested?: string;
  PurchaseCostCode?: string;
  RequiredFor?: string;
  BudgetYear?: number;
}

export interface UpdatePRFRequest {
  Title?: string;
  Description?: string;
  Department?: string;
  COAID?: number;
  RequestedAmount?: number;
  Priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  Status?: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed' | 'Cancelled';
  RequiredDate?: Date;
  ApprovedAmount?: number;
  ActualAmount?: number;
  ApprovalDate?: Date;
  CompletionDate?: Date;
  ApprovedBy?: number;
  Justification?: string;
  VendorName?: string;
  VendorContact?: string;
  Notes?: string;
  
  // New fields from Excel analysis
  DateSubmit?: Date;
  SubmitBy?: string;
  SumDescriptionRequested?: string;
  PurchaseCostCode?: string;
  RequiredFor?: string;
  BudgetYear?: number;
}

export interface PRFItem {
  PRFItemID: number;
  PRFID: number;
  ItemName: string;
  Description?: string;
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

export interface CreatePRFItemRequest {
  ItemName: string;
  Description?: string;
  Quantity: number;
  UnitPrice: number;
  Specifications?: string;
  
  // Cost code fields - enables multiple cost codes per PRF through item-level assignment
  PurchaseCostCode?: string;
  COAID?: number;
  BudgetYear?: number;
}

export interface PRFApproval {
  ApprovalID: number;
  PRFID: number;
  ApproverID: number;
  ApprovalLevel: number;
  Status: 'Pending' | 'Approved' | 'Rejected';
  Comments?: string;
  ApprovalDate?: Date;
  CreatedAt: Date;
}

export interface CreateApprovalRequest {
  PRFID: number;
  ApproverID: number;
  ApprovalLevel: number;
  Status: 'Approved' | 'Rejected';
  Comments?: string;
}

export interface BudgetTransaction {
  TransactionID: number;
  BudgetID: number;
  PRFID?: number;
  TransactionType: 'Allocation' | 'Utilization' | 'Transfer' | 'Adjustment';
  Amount: number;
  Description?: string;
  ReferenceNumber?: string;
  TransactionDate: Date;
  CreatedBy: number;
  CreatedAt: Date;
}

export interface CreateTransactionRequest {
  BudgetID: number;
  PRFID?: number;
  TransactionType: 'Allocation' | 'Utilization' | 'Transfer' | 'Adjustment';
  Amount: number;
  Description?: string;
  ReferenceNumber?: string;
}

// View types
export interface PRFSummary {
  PRFID: number;
  PRFNo: string;
  Title: string;
  Department: string;
  RequestedAmount: number;
  ApprovedAmount?: number;
  Status: string;
  Priority: string;
  RequestDate: Date;
  RequiredDate?: Date;
  RequestorName: string;
  COACode: string;
  COAName: string;
  DaysOpen: number;
  // Excel import fields
  DateSubmit?: Date;
  SubmitBy?: string;
  SumDescriptionRequested?: string;
  PurchaseCostCode?: string;
  RequiredFor?: string;
  BudgetYear?: number;
  Description?: string;
  UpdatedAt?: Date;
}

export interface BudgetSummary {
  BudgetID: number;
  COAID: number;
  FiscalYear: number;
  Quarter?: number;
  Month?: number;
  COACode: string;
  COAName: string;
  Category?: string;
  BudgetType: string;
  AllocatedAmount: number;
  UtilizedAmount: number;
  RemainingAmount: number;
  UtilizationPercentage: number;
  Status: string;
  StartDate?: Date;
  EndDate?: Date;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface BudgetUtilization {
  BudgetID: number;
  FiscalYear: number;
  Quarter?: number;
  Month?: number;
  COACode: string;
  COAName: string;
  Category?: string;
  AllocatedAmount: number;
  UtilizedAmount: number;
  RemainingAmount: number;
  UtilizationPercentage: number;
  UtilizationLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Query parameters
export interface PRFQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  department?: string;
  priority?: string;
  requestorId?: number;
  coaId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface BudgetQueryParams {
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
  [key: string]: unknown;
}

// Dashboard metrics
export interface DashboardMetrics {
  totalPRFs: number;
  pendingPRFs: number;
  approvedPRFs: number;
  totalBudgetAllocated: number;
  totalBudgetUtilized: number;
  budgetUtilizationPercentage: number;
  criticalBudgets: number;
  recentPRFs: PRFSummary[];
  budgetAlerts: BudgetUtilization[];
}

// Excel upload types
export interface ExcelUploadResult {
  success: boolean;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: string[];
  data?: unknown[];
}

// Error types
export interface ApiError {
  message: string;
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;
}

// Excel Import Types for PRF Data
export interface ExcelPRFData {
  No: number;                           // Excel: "No"
  Budget: number;                       // Excel: "Budget" (Year)
  'Date Submit': number | Date;         // Excel: "Date Submit" (Excel date serial)
  'Submit By': string;                  // Excel: "Submit By"
  'PRF No': number | string;            // Excel: "PRF No"
  'Sum Description Requested': string;  // Excel: "Sum Description Requested"
  Description: string;                  // Excel: "Description"
  'Purchase Cost Code': string;         // Excel: "Purchase Cost Code"
  Amount: number;                       // Excel: "Amount"
  'Required for': string;               // Excel: "Required for"
  'Status in Pronto': string;           // Excel: "Status in Pronto"
}

export interface ExcelBudgetData {
  COA: string;                          // Excel: "COA"
  Category: string;                     // Excel: "Category"
  'Initial Budget': number;             // Excel: "Initial Budget"
  'Remaining Budget': number;           // Excel: "Remaining Budget"
}

export interface PRFImportResult {
  success: boolean;
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
    data?: unknown;
  }>;
  warnings: Array<{
    row: number;
    message: string;
    data?: unknown;
  }>;
  // Enhanced reporting fields
  totalPRFs?: number;
  successfulPRFs?: number;
  failedPRFs?: number;
  prfDetails?: {
    successful: Array<{
      prfNo: string;
      prfId: number;
      itemCount: number;
    }>;
    failed: Array<{
      prfNo: string;
      reason: string;
      rows: number[];
    }>;
  };
}

export interface BulkPRFImportRequest {
  prfData: ExcelPRFData[];
  budgetData?: ExcelBudgetData[];
  validateOnly?: boolean;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
}