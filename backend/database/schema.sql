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
    Role NVARCHAR(20) DEFAULT 'User' CHECK (Role IN ('Admin', 'Manager', 'User')),
    Department NVARCHAR(100),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

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
    Priority NVARCHAR(20) DEFAULT 'Medium' CHECK (Priority IN ('Low', 'Medium', 'High', 'Critical')),
    Status NVARCHAR(20) DEFAULT 'Draft' CHECK (Status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed', 'Cancelled')),
    RequestDate DATETIME2 NOT NULL DEFAULT GETDATE(),
    RequiredDate DATETIME2,
    ApprovalDate DATETIME2 NULL,
    CompletionDate DATETIME2 NULL,
    ApprovedBy INT NULL,
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
    Quantity INT NOT NULL DEFAULT 1,
    UnitPrice DECIMAL(15,2) NOT NULL,
    TotalPrice AS (Quantity * UnitPrice) PERSISTED,
    Specifications NVARCHAR(2000),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (PRFID) REFERENCES PRF(PRFID) ON DELETE CASCADE
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
CREATE INDEX IX_BudgetTransactions_Date ON BudgetTransactions(TransactionDate);
CREATE INDEX IX_AuditLog_TableRecord ON AuditLog(TableName, RecordID);
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
    DATEDIFF(day, p.RequestDate, GETDATE()) AS DaysOpen
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
VALUES ('admin', 'admin@company.com', '$2b$10$rQZ8kHp.TB.It.NuiNvxaOZvBz4Lp8J8m8qfPXU5JtHfQy7TZjHNe', 'System', 'Administrator', 'Admin', 'IT');

-- Insert sample Chart of Accounts
INSERT INTO ChartOfAccounts (COACode, COAName, Description, Category) VALUES
('IT-001', 'Hardware Equipment', 'Computer hardware, servers, networking equipment', 'IT Equipment'),
('IT-002', 'Software Licenses', 'Software licenses and subscriptions', 'Software'),
('IT-003', 'IT Services', 'Professional services, consulting, support', 'Services'),
('IT-004', 'Telecommunications', 'Internet, phone, communication services', 'Services'),
('IT-005', 'Office Equipment', 'Printers, scanners, office hardware', 'Equipment'),
('IT-006', 'Training & Development', 'IT training, certifications, courses', 'Training'),
('IT-007', 'Maintenance & Support', 'Hardware maintenance, software support', 'Maintenance');