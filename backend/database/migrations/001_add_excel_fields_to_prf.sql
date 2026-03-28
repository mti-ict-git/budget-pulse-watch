-- Migration: Add Excel-based fields to PRF table
-- Date: 2025-09-14
-- Description: Adds new fields from Excel analysis to support historical data import

USE PRFMonitoringDB;
GO

IF COL_LENGTH('dbo.PRF', 'DateSubmit') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD DateSubmit DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.PRF', 'SubmitBy') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD SubmitBy NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.PRF', 'SumDescriptionRequested') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD SumDescriptionRequested NVARCHAR(500) NULL;
END
GO

IF COL_LENGTH('dbo.PRF', 'PurchaseCostCode') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD PurchaseCostCode NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.PRF', 'RequiredFor') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD RequiredFor NVARCHAR(200) NULL;
END
GO

IF COL_LENGTH('dbo.PRF', 'BudgetYear') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD BudgetYear INT NULL;
END
GO

-- Add indexes for better performance on new fields
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRF_DateSubmit' AND object_id = OBJECT_ID('dbo.PRF'))
  CREATE INDEX IX_PRF_DateSubmit ON dbo.PRF(DateSubmit);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRF_SubmitBy' AND object_id = OBJECT_ID('dbo.PRF'))
  CREATE INDEX IX_PRF_SubmitBy ON dbo.PRF(SubmitBy);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRF_PurchaseCostCode' AND object_id = OBJECT_ID('dbo.PRF'))
  CREATE INDEX IX_PRF_PurchaseCostCode ON dbo.PRF(PurchaseCostCode);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRF_BudgetYear' AND object_id = OBJECT_ID('dbo.PRF'))
  CREATE INDEX IX_PRF_BudgetYear ON dbo.PRF(BudgetYear);
GO

PRINT 'Migration completed: Added Excel fields to PRF table';
GO
