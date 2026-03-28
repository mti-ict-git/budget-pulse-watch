-- Migration: Add Excel Import Fields to PRF Table
-- Date: 2025-09-14
-- Description: Add fields to support Excel import functionality

USE PRFMonitoringDB;
GO

IF COL_LENGTH('dbo.PRF', 'PRFNo') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD PRFNo NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.PRF', 'DateSubmit') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD DateSubmit DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.PRF', 'SubmitBy') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD SubmitBy NVARCHAR(200) NULL;
END
GO

IF COL_LENGTH('dbo.PRF', 'SumDescriptionRequested') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD SumDescriptionRequested NVARCHAR(1000) NULL;
END
GO

IF COL_LENGTH('dbo.PRF', 'PurchaseCostCode') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD PurchaseCostCode NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.PRF', 'RequiredFor') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD RequiredFor NVARCHAR(500) NULL;
END
GO

IF COL_LENGTH('dbo.PRF', 'BudgetYear') IS NULL
BEGIN
  ALTER TABLE dbo.PRF ADD BudgetYear INT NULL;
END
GO

-- Create index on PRFNo for better performance during duplicate checks
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRF_PRFNo' AND object_id = OBJECT_ID('dbo.PRF'))
  CREATE INDEX IX_PRF_PRFNo ON dbo.PRF(PRFNo);
GO

-- Create index on BudgetYear for filtering
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PRF_BudgetYear' AND object_id = OBJECT_ID('dbo.PRF'))
  CREATE INDEX IX_PRF_BudgetYear ON dbo.PRF(BudgetYear);
GO

PRINT 'Migration completed: Added Excel import fields to PRF table';
GO
