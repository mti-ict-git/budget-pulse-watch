-- Migration: Add Excel Import Fields to PRF Table
-- Date: 2025-09-14
-- Description: Add fields to support Excel import functionality

USE PRFMonitoringDB;
GO

-- Add Excel import fields to PRF table
ALTER TABLE PRF ADD 
    PRFNo NVARCHAR(100) NULL, -- Original PRF number from Excel
    DateSubmit DATETIME2 NULL, -- Submit date from Excel
    SubmitBy NVARCHAR(200) NULL, -- Submitter name from Excel
    SumDescriptionRequested NVARCHAR(1000) NULL, -- Summary description from Excel
    PurchaseCostCode NVARCHAR(50) NULL, -- Cost code from Excel
    RequiredFor NVARCHAR(500) NULL, -- Required for field from Excel
    BudgetYear INT NULL; -- Budget year from Excel
GO

-- Create index on PRFNo for better performance during duplicate checks
CREATE INDEX IX_PRF_PRFNo ON PRF(PRFNo);
GO

-- Create index on BudgetYear for filtering
CREATE INDEX IX_PRF_BudgetYear ON PRF(BudgetYear);
GO

PRINT 'Migration completed: Added Excel import fields to PRF table';
GO