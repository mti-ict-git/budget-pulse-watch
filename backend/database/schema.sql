-- PRF Monitoring Database Schema
-- MS SQL Server Database: PRFMonitoringDB

-- Users table for authentication
CREATE TABLE Users (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(50) UNIQUE NOT NULL,
    Email NVARCHAR(100) UNIQUE NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    FirstName NVARCHAR(50) NOT NULL,
    LastName NVARCHAR(50) NOT NULL,
    Role NVARCHAR(20) DEFAULT 'user' CHECK (Role IN ('admin', 'doccon', 'user')),
    Department NVARCHAR(100),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

-- Application Settings table for storing OCR and general app configuration
CREATE TABLE AppSettings (
    SettingsID INT IDENTITY(1,1) PRIMARY KEY,
    Provider NVARCHAR(20) NOT NULL CHECK (Provider IN ('gemini','openai')),
    GeminiApiKeyEnc NVARCHAR(MAX) NULL,
    OpenAIApiKeyEnc NVARCHAR(MAX) NULL,
    Enabled BIT NOT NULL DEFAULT 0,
    Model NVARCHAR(100) NULL,
    SharedFolderPath NVARCHAR(500) NULL,
    ProntoSyncEnabled BIT NOT NULL DEFAULT 0,
    ProntoSyncHeaderEnabled BIT NOT NULL DEFAULT 1,
    ProntoSyncItemsEnabled BIT NOT NULL DEFAULT 1,
    ProntoSyncBudgetYear INT NULL,
    ProntoSyncIntervalMinutes INT NOT NULL DEFAULT 60,
    ProntoSyncApply BIT NOT NULL DEFAULT 0,
    ProntoSyncMaxPrfs INT NULL,
    ProntoSyncLimit INT NOT NULL DEFAULT 1000,
    ProntoSyncLogEvery INT NOT NULL DEFAULT 25,
    ProntoHeadless BIT NOT NULL DEFAULT 1,
    ProntoCaptureScreenshots BIT NOT NULL DEFAULT 0,
    ProntoWritePerPoJson BIT NOT NULL DEFAULT 0,
    ProntoSyncReplaceItem BIT NOT NULL DEFAULT 0,
    ProntoSyncAddMissingItem BIT NOT NULL DEFAULT 0,
    ProntoSyncSyncItemDescription BIT NOT NULL DEFAULT 0,
    ProntoSyncRunNowRequestedAt DATETIME2 NULL,
    ProntoSyncRunNowRequestedBy NVARCHAR(100) NULL,
    ProntoSyncLastRunStartedAt DATETIME2 NULL,
    ProntoSyncLastRunFinishedAt DATETIME2 NULL,
    ProntoSyncLastRunExitCode INT NULL,
    ProntoSyncTimeZone NVARCHAR(64) NULL,
    ProntoSyncProgressJson NVARCHAR(MAX) NULL,
    ProntoSyncProgressUpdatedAt DATETIME2 NULL,
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

-- Chart of Accounts (COA) for budget categories
CREATE TABLE ChartOfAccounts (
    COAID INT IDENTITY(1,1) PRIMARY KEY,
    COACode NVARCHAR(20) UNIQUE NOT NULL,
    COAName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500),
    Category NVARCHAR(100), -- e.g., 'IT Equipment', 'Software', 'Services'
    ParentCOAID INT NULL,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (ParentCOAID) REFERENCES ChartOfAccounts(COAID)
);

-- Budget allocation table
CREATE TABLE Budget (
    BudgetID INT IDENTITY(1,1) PRIMARY KEY,
    COAID INT NOT NULL,
    FiscalYear INT NOT NULL,
    Quarter INT CHECK (Quarter BETWEEN 1 AND 4),
    Month INT CHECK (Month BETWEEN 1 AND 12),
    AllocatedAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
    UtilizedAmount DECIMAL(15,2) NOT NULL DEFAULT 0,
    CurrencyCode NVARCHAR(3) NOT NULL DEFAULT 'IDR' CHECK (CurrencyCode IN ('IDR', 'USD')),
    ExchangeRateToIDR DECIMAL(18,6) NOT NULL DEFAULT 1 CHECK (ExchangeRateToIDR > 0),
    RemainingAmount AS (AllocatedAmount - UtilizedAmount) PERSISTED,
    UtilizationPercentage AS (CASE WHEN AllocatedAmount > 0 THEN (UtilizedAmount / AllocatedAmount) * 100 ELSE 0 END) PERSISTED,
    Notes NVARCHAR(1000),
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (COAID) REFERENCES ChartOfAccounts(COAID),
    FOREIGN KEY (CreatedBy) REFERENCES Users(UserID),
    UNIQUE (COAID, FiscalYear, Quarter, Month)
);

CREATE TABLE BudgetCutoff (
    FiscalYear INT PRIMARY KEY,
    IsClosed BIT NOT NULL DEFAULT 0,
    ClosedAt DATETIME2 NULL,
    ClosedBy INT NULL,
    ReopenedAt DATETIME2 NULL,
    ReopenedBy INT NULL,
    Notes NVARCHAR(1000) NULL,
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (ClosedBy) REFERENCES Users(UserID),
    FOREIGN KEY (ReopenedBy) REFERENCES Users(UserID)
);

CREATE TABLE BudgetCutoffAudit (
    CutoffAuditID INT IDENTITY(1,1) PRIMARY KEY,
    FiscalYear INT NOT NULL,
    Action NVARCHAR(20) NOT NULL CHECK (Action IN ('CLOSE', 'REOPEN')),
    ActionBy INT NOT NULL,
    ActionAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    Notes NVARCHAR(1000) NULL,
    FOREIGN KEY (FiscalYear) REFERENCES BudgetCutoff(FiscalYear),
    FOREIGN KEY (ActionBy) REFERENCES Users(UserID)
);

-- Notifications table
CREATE TABLE Notifications (
    NotificationID INT IDENTITY(1,1) PRIMARY KEY,
    UserID INT NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Message NVARCHAR(1000) NOT NULL,
    ReferenceType NVARCHAR(50) NOT NULL, -- e.g., 'PRF'
    ReferenceID INT NULL,                -- e.g., PRFID
    IsRead BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);

-- PRF (Purchase Request Form) table
CREATE TABLE PRF (
    PRFID INT IDENTITY(1,1) PRIMARY KEY,
    PRFNo NVARCHAR(50) UNIQUE NOT NULL, -- Business identifier from Excel
    Title NVARCHAR(200) NOT NULL,
    Description NVARCHAR(2000),
    RequestorID INT NOT NULL,
    Department NVARCHAR(100) NOT NULL,
    COAID INT NOT NULL,
    RequestedAmount DECIMAL(15,2) NOT NULL,
    ApprovedAmount DECIMAL(15,2) NULL,
    ActualAmount DECIMAL(15,2) NULL,
    CurrencyCode NVARCHAR(3) NOT NULL DEFAULT 'IDR' CHECK (CurrencyCode IN ('IDR', 'USD')),
    ExchangeRateToIDR DECIMAL(18,6) NOT NULL DEFAULT 1 CHECK (ExchangeRateToIDR > 0),
    Priority NVARCHAR(20) DEFAULT 'Medium' CHECK (Priority IN ('Low', 'Medium', 'High', 'Critical')),
    Status NVARCHAR(100) DEFAULT 'Draft', -- No CHECK constraint - accepts any Excel 'Status in Pronto' values
    RequestDate DATETIME2 NOT NULL DEFAULT GETDATE(),
    RequiredDate DATETIME2,
    ApprovalDate DATETIME2 NULL,
    CompletionDate DATETIME2 NULL,
    ApprovedBy INT NULL,
    ApprovedByName NVARCHAR(200) NULL,
    Justification NVARCHAR(2000),
    VendorName NVARCHAR(200),
    VendorContact NVARCHAR(500),
    AttachmentPath NVARCHAR(500),
    Notes NVARCHAR(2000),
    -- Excel Import Fields (PRFNo moved to main fields above)
    DateSubmit DATETIME2 NULL, -- Submit date from Excel
    SubmitBy NVARCHAR(200) NULL, -- Submitter name from Excel
    SumDescriptionRequested NVARCHAR(1000) NULL, -- Summary description from Excel
    PurchaseCostCode NVARCHAR(50) NULL, -- Cost code from Excel
    RequiredFor NVARCHAR(500) NULL, -- Required for field from Excel
    BudgetYear INT NULL, -- Budget year from Excel
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (RequestorID) REFERENCES Users(UserID),
    FOREIGN KEY (COAID) REFERENCES ChartOfAccounts(COAID),
    FOREIGN KEY (ApprovedBy) REFERENCES Users(UserID)
);

-- PRF Items (line items for each PRF)
CREATE TABLE PRFItems (
    PRFItemID INT IDENTITY(1,1) PRIMARY KEY,
    PRFID INT NOT NULL,
    ItemName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(1000),
    ItemCode NVARCHAR(64) NULL,
    Quantity INT NOT NULL DEFAULT 1,
    UnitPrice DECIMAL(15,2) NOT NULL,
    TotalPrice AS (Quantity * UnitPrice) PERSISTED,
    Specifications NVARCHAR(2000),
    Status NVARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (Status IN ('Pending', 'Approved', 'Picked Up', 'Cancelled', 'On Hold')),
    PickedUpBy NVARCHAR(200) NULL,
    PickedUpByUserID INT NULL,
    PickedUpDate DATETIME2 NULL,
    Notes NVARCHAR(1000) NULL,
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    UpdatedBy INT NULL,
    StatusOverridden BIT NOT NULL DEFAULT 0,
    PurchaseCostCode NVARCHAR(50) NULL,
    OriginalPONumber NVARCHAR(50) NULL,
    SplitPONumber NVARCHAR(50) NULL,
    COAID INT NULL,
    BudgetYear INT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (PRFID) REFERENCES PRF(PRFID) ON DELETE CASCADE,
    FOREIGN KEY (UpdatedBy) REFERENCES Users(UserID),
    FOREIGN KEY (PickedUpByUserID) REFERENCES Users(UserID),
    FOREIGN KEY (COAID) REFERENCES ChartOfAccounts(COAID)
);

-- PRF Approval Workflow
CREATE TABLE PRFApprovals (
    ApprovalID INT IDENTITY(1,1) PRIMARY KEY,
    PRFID INT NOT NULL,
    ApproverID INT NOT NULL,
    ApprovalLevel INT NOT NULL, -- 1=Department Head, 2=Finance, 3=CEO, etc.
    Status NVARCHAR(20) DEFAULT 'Pending' CHECK (Status IN ('Pending', 'Approved', 'Rejected')),
    Comments NVARCHAR(1000),
    ApprovalDate DATETIME2 NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (PRFID) REFERENCES PRF(PRFID) ON DELETE CASCADE,
    FOREIGN KEY (ApproverID) REFERENCES Users(UserID),
    UNIQUE (PRFID, ApproverID, ApprovalLevel)
);

-- Budget Transactions (tracks all budget movements)
CREATE TABLE BudgetTransactions (
    TransactionID INT IDENTITY(1,1) PRIMARY KEY,
    BudgetID INT NOT NULL,
    PRFID INT NULL, -- Link to PRF if transaction is PRF-related
    TransactionType NVARCHAR(20) NOT NULL CHECK (TransactionType IN ('Allocation', 'Utilization', 'Transfer', 'Adjustment')),
    Amount DECIMAL(15,2) NOT NULL,
    Description NVARCHAR(500),
    ReferenceNumber NVARCHAR(100),
    TransactionDate DATETIME2 NOT NULL DEFAULT GETDATE(),
    CreatedBy INT NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (BudgetID) REFERENCES Budget(BudgetID),
    FOREIGN KEY (PRFID) REFERENCES PRF(PRFID),
    FOREIGN KEY (CreatedBy) REFERENCES Users(UserID)
);

-- Audit Log for tracking changes
CREATE TABLE AuditLog (
    AuditID INT IDENTITY(1,1) PRIMARY KEY,
    TableName NVARCHAR(100) NOT NULL,
    RecordID INT NOT NULL,
    Action NVARCHAR(20) NOT NULL CHECK (Action IN ('INSERT', 'UPDATE', 'DELETE')),
    OldValues NVARCHAR(MAX),
    NewValues NVARCHAR(MAX),
    ChangedBy INT NOT NULL,
    ChangedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (ChangedBy) REFERENCES Users(UserID)
);

-- Create indexes for better performance
CREATE INDEX IX_PRF_Status ON PRF(Status);
CREATE INDEX IX_PRF_RequestDate ON PRF(RequestDate);
CREATE INDEX IX_PRF_Department ON PRF(Department);
CREATE INDEX IX_PRF_COAID ON PRF(COAID);
CREATE INDEX IX_Budget_FiscalYear ON Budget(FiscalYear);
CREATE INDEX IX_Budget_COAID ON Budget(COAID);
CREATE INDEX IX_BudgetCutoff_IsClosed ON BudgetCutoff(IsClosed);
CREATE INDEX IX_BudgetCutoffAudit_FiscalYear_ActionAt ON BudgetCutoffAudit(FiscalYear, ActionAt);
CREATE INDEX IX_BudgetTransactions_Date ON BudgetTransactions(TransactionDate);
CREATE INDEX IX_AuditLog_TableRecord ON AuditLog(TableName, RecordID);
CREATE INDEX IX_PRFItems_Status ON PRFItems(Status);
CREATE INDEX IX_PRFItems_PickedUpBy ON PRFItems(PickedUpBy);
CREATE INDEX IX_PRFItems_PickedUpByUserID ON PRFItems(PickedUpByUserID);
CREATE INDEX IX_PRFItems_UpdatedAt ON PRFItems(UpdatedAt);
CREATE INDEX IX_PRFItems_StatusOverridden ON PRFItems(StatusOverridden);
CREATE INDEX IX_PRFItems_PurchaseCostCode ON PRFItems(PurchaseCostCode);
CREATE INDEX IX_PRFItems_COAID ON PRFItems(COAID);
CREATE INDEX IX_PRFItems_BudgetYear ON PRFItems(BudgetYear);
GO

-- Create views for common queries
CREATE VIEW vw_PRFSummary AS
SELECT 
    p.PRFID,
    p.PRFNo,
    p.Title,
    p.Department,
    p.RequestedAmount,
    p.ApprovedAmount,
    p.Status,
    p.Priority,
    p.RequestDate,
    p.RequiredDate,
    u.FirstName + ' ' + u.LastName AS RequestorName,
    coa.COACode,
    coa.COAName,
    DATEDIFF(day, p.RequestDate, GETDATE()) AS DaysOpen,
    -- Excel import fields
    p.DateSubmit,
    p.SubmitBy,
    p.SumDescriptionRequested,
    p.PurchaseCostCode,
    p.RequiredFor,
    p.BudgetYear,
    p.Description,
    p.UpdatedAt,
    p.ApprovedByName
FROM PRF p
INNER JOIN Users u ON p.RequestorID = u.UserID
INNER JOIN ChartOfAccounts coa ON p.COAID = coa.COAID;
GO

CREATE VIEW vw_BudgetUtilization AS
SELECT 
    b.BudgetID,
    b.FiscalYear,
    b.Quarter,
    b.Month,
    coa.COACode,
    coa.COAName,
    coa.Category,
    b.AllocatedAmount,
    b.UtilizedAmount,
    b.RemainingAmount,
    b.UtilizationPercentage,
    CASE 
        WHEN b.UtilizationPercentage > 90 THEN 'Critical'
        WHEN b.UtilizationPercentage > 75 THEN 'High'
        WHEN b.UtilizationPercentage > 50 THEN 'Medium'
        ELSE 'Low'
    END AS UtilizationLevel
FROM Budget b
INNER JOIN ChartOfAccounts coa ON b.COAID = coa.COAID;
GO

-- Insert default admin user (password: admin123 - should be changed)
INSERT INTO Users (Username, Email, PasswordHash, FirstName, LastName, Role, Department)
VALUES ('admin', 'admin@company.com', '$2b$10$rQZ8kHp.TB.It.NuiNvxaOZvBz4Lp8J8m8qfPXU5JtHfQy7TZjHNe', 'System', 'Administrator', 'admin', 'IT');

-- PRF Files table for document management
CREATE TABLE PRFFiles (
    FileID INT IDENTITY(1,1) PRIMARY KEY,
    PRFID INT NOT NULL,
    OriginalFileName NVARCHAR(255) NOT NULL,
    FilePath NVARCHAR(500) NOT NULL, -- Local storage path
    SharedPath NVARCHAR(500) NULL, -- Network shared storage path
    FileSize BIGINT NOT NULL, -- File size in bytes
    FileType NVARCHAR(50) NOT NULL, -- e.g., 'pdf', 'jpg', 'png', 'xlsx'
    MimeType NVARCHAR(100) NOT NULL, -- e.g., 'application/pdf', 'image/jpeg'
    UploadDate DATETIME2 NOT NULL DEFAULT GETDATE(),
    UploadedBy INT NOT NULL,
    IsOriginalDocument BIT DEFAULT 0, -- True for OCR source documents
    Description NVARCHAR(500) NULL, -- Optional file description
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (PRFID) REFERENCES PRF(PRFID) ON DELETE CASCADE,
    FOREIGN KEY (UploadedBy) REFERENCES Users(UserID)
);

-- Create indexes for PRF Files
CREATE INDEX IX_PRFFiles_PRFID ON PRFFiles(PRFID);
CREATE INDEX IX_PRFFiles_UploadDate ON PRFFiles(UploadDate);
CREATE INDEX IX_PRFFiles_FileType ON PRFFiles(FileType);
GO

-- Insert sample Chart of Accounts
INSERT INTO ChartOfAccounts (COACode, COAName, Description, Category) VALUES
('IT-001', 'Hardware Equipment', 'Computer hardware, servers, networking equipment', 'IT Equipment'),
('IT-002', 'Software Licenses', 'Software licenses and subscriptions', 'Software'),
('IT-003', 'IT Services', 'Professional services, consulting, support', 'Services'),
('IT-004', 'Telecommunications', 'Internet, phone, communication services', 'Services'),
('IT-005', 'Office Equipment', 'Printers, scanners, office hardware', 'Equipment'),
('IT-006', 'Training & Development', 'IT training, certifications, courses', 'Training'),
('IT-007', 'Maintenance & Support', 'Hardware maintenance, software support', 'Maintenance');

-- LDAP User Access table for Active Directory authentication
CREATE TABLE LDAPUserAccess (
    AccessID INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(100) UNIQUE NOT NULL, -- AD username
    Email NVARCHAR(100) UNIQUE NOT NULL, -- AD email
    DisplayName NVARCHAR(200) NOT NULL, -- AD display name
    Department NVARCHAR(100) NULL, -- AD department
    Role NVARCHAR(20) DEFAULT 'user' CHECK (Role IN ('admin', 'doccon', 'user')),
    IsActive BIT DEFAULT 1,
    GrantedBy INT NOT NULL, -- Admin who granted access
    GrantedAt DATETIME2 DEFAULT GETDATE(),
    LastLogin DATETIME2 NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (GrantedBy) REFERENCES Users(UserID)
);

-- Create indexes for LDAP User Access
CREATE INDEX IX_LDAPUserAccess_Username ON LDAPUserAccess(Username);
CREATE INDEX IX_LDAPUserAccess_Email ON LDAPUserAccess(Email);
CREATE INDEX IX_LDAPUserAccess_IsActive ON LDAPUserAccess(IsActive);
CREATE INDEX IX_LDAPUserAccess_Role ON LDAPUserAccess(Role);
GO
