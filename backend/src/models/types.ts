// Database model types and interfaces

export interface User {
  UserID: number;
  Username: string;
  Email: string;
  PasswordHash: string;
  FirstName: string;
  LastName: string;
  Role: 'Admin' | 'Manager' | 'User';
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
  Role?: 'Admin' | 'Manager' | 'User';
  Department?: string;
}

export interface UpdateUserParams {
  UserID: number;
  Username?: string;
  Email?: string;
  FirstName?: string;
  LastName?: string;
  Role?: 'Admin' | 'Manager' | 'User';
  Department?: string;
  PasswordHash?: string;
}

export interface UserQueryParams {
  Offset: number;
  Limit: number;
  Search?: string;
}

export interface UsernameExistsParams {
  Username: string;
  ExcludeUserID?: number;
}

export interface EmailExistsParams {
  Email: string;
  ExcludeUserID?: number;
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
  
  // New fields from Excel analysis
  DateSubmit?: Date;
  SubmitBy?: string;
  PRFNo?: string;
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
  IsActive: boolean;
  CreatedAt: Date;
}

export interface CreateCOARequest {
  AccountCode: string;
  AccountName: string;
  AccountType?: string;
  Description?: string;
  Category?: string;
  ParentAccountID?: number;
  IsActive?: boolean;
  Department?: string;
}

export interface UpdateCOARequest {
  AccountCode?: string;
  AccountName?: string;
  AccountType?: string;
  Description?: string;
  Category?: string;
  ParentAccountID?: number;
  IsActive?: boolean;
  Department?: string;
}

export interface COAQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  accountType?: string;
  department?: string;
  parentAccountId?: number;
  isActive?: boolean;
  search?: string;
}

// COA parameter types for replacing 'any' types
export interface UpdateCOAParams {
  COAID: number;
  AccountCode?: string;
  AccountName?: string;
  AccountType?: string;
  ParentAccountID?: number;
  Description?: string;
  IsActive?: boolean;
  Department?: string;
}

export interface COAFindAllParams {
  Offset?: number;
  Limit?: number;
  AccountType?: string;
  Department?: string;
  IsActive?: boolean;
  ParentAccountID?: number;
  Search?: string;
}

export interface COABulkImportParams {
  [key: string]: string | number | boolean | null;
}

export interface COAAccountUsage {
  COAID: number;
  AccountCode: string;
  AccountName: string;
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
  AccountTypes: number;
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
}

export interface BudgetUtilizationParams {
  Department: string;
  FiscalYear?: number;
}

export interface COAExistsParams {
  AccountCode: string;
  ExcludeID?: number;
}

export interface BudgetAlert {
  BudgetID: number;
  COAID: number;
  AccountCode: string;
  AccountName: string;
  Department: string;
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
  StartDate?: Date;
  EndDate?: Date;
  Status?: string;
  Notes?: string;
}

export interface PRF {
  PRFID: number;
  PRFNumber: string;
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
  PRFNo?: string;                       // Excel: "PRF No" (different from PRFNumber)
  SumDescriptionRequested?: string;     // Excel: "Sum Description Requested"
  PurchaseCostCode?: string;            // Excel: "Purchase Cost Code"
  RequiredFor?: string;                 // Excel: "Required for"
  BudgetYear?: number;                  // Excel: "Budget"
}

export interface CreatePRFRequest {
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
  PRFNo?: string;
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
  PRFNo?: string;
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
  CreatedAt: Date;
}

export interface CreatePRFItemRequest {
  ItemName: string;
  Description?: string;
  Quantity: number;
  UnitPrice: number;
  Specifications?: string;
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
  PRFNumber: string;
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
}

export interface BudgetSummary {
  BudgetID: number;
  COAID: number;
  FiscalYear: number;
  Quarter?: number;
  Month?: number;
  AccountCode: string;
  AccountName: string;
  Category?: string;
  Department: string;
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
  status?: string;
  search?: string;
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
}

export interface BulkPRFImportRequest {
  prfData: ExcelPRFData[];
  budgetData?: ExcelBudgetData[];
  validateOnly?: boolean;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
}