-- Migration: Add cost code support to PRFItems table
-- Date: 2025-01-21
-- Purpose: Enable multiple cost codes per PRF through item-level cost code assignment

USE PRFMonitoringDB;
GO

IF COL_LENGTH('dbo.PRFItems', 'PurchaseCostCode') IS NULL
BEGIN
  ALTER TABLE dbo.PRFItems ADD PurchaseCostCode NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.PRFItems', 'COAID') IS NULL
BEGIN
  ALTER TABLE dbo.PRFItems ADD COAID INT NULL;
END
GO

IF COL_LENGTH('dbo.PRFItems', 'BudgetYear') IS NULL
BEGIN
  ALTER TABLE dbo.PRFItems ADD BudgetYear INT NULL;
END
GO

-- Add foreign key constraint for COAID
IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_PRFItems_ChartOfAccounts'
)
BEGIN
  ALTER TABLE dbo.PRFItems
  ADD CONSTRAINT FK_PRFItems_ChartOfAccounts
  FOREIGN KEY (COAID) REFERENCES dbo.ChartOfAccounts(COAID);
END
GO

-- Create index for better performance on cost code queries
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_PRFItems_PurchaseCostCode'
    AND object_id = OBJECT_ID('dbo.PRFItems')
)
BEGIN
  CREATE INDEX IX_PRFItems_PurchaseCostCode ON dbo.PRFItems(PurchaseCostCode);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_PRFItems_COAID'
    AND object_id = OBJECT_ID('dbo.PRFItems')
)
BEGIN
  CREATE INDEX IX_PRFItems_COAID ON dbo.PRFItems(COAID);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_PRFItems_BudgetYear'
    AND object_id = OBJECT_ID('dbo.PRFItems')
)
BEGIN
  CREATE INDEX IX_PRFItems_BudgetYear ON dbo.PRFItems(BudgetYear);
END
GO

-- Update existing PRFItems with cost codes from their parent PRF
-- This migration handles existing data by copying cost codes from PRF level to item level
UPDATE pi
SET PurchaseCostCode = p.PurchaseCostCode,
    COAID = p.COAID,
    BudgetYear = p.BudgetYear
FROM dbo.PRFItems pi
INNER JOIN dbo.PRF p ON pi.PRFID = p.PRFID
WHERE pi.PurchaseCostCode IS NULL;
GO

-- Add comment to document the change
IF NOT EXISTS (
  SELECT 1
  FROM sys.extended_properties ep
  WHERE ep.name = 'MS_Description'
    AND ep.major_id = OBJECT_ID('dbo.PRFItems')
    AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.PRFItems'), 'PurchaseCostCode', 'ColumnId')
)
BEGIN
  EXEC sp_addextendedproperty 
      @name = N'MS_Description',
      @value = N'Purchase cost code for this specific item - enables multiple cost codes per PRF',
      @level0type = N'SCHEMA', @level0name = N'dbo',
      @level1type = N'TABLE', @level1name = N'PRFItems',
      @level2type = N'COLUMN', @level2name = N'PurchaseCostCode';
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.extended_properties ep
  WHERE ep.name = 'MS_Description'
    AND ep.major_id = OBJECT_ID('dbo.PRFItems')
    AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.PRFItems'), 'COAID', 'ColumnId')
)
BEGIN
  EXEC sp_addextendedproperty 
      @name = N'MS_Description',
      @value = N'Chart of Accounts ID for this specific item - enables multiple COA codes per PRF',
      @level0type = N'SCHEMA', @level0name = N'dbo',
      @level1type = N'TABLE', @level1name = N'PRFItems',
      @level2type = N'COLUMN', @level2name = N'COAID';
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.extended_properties ep
  WHERE ep.name = 'MS_Description'
    AND ep.major_id = OBJECT_ID('dbo.PRFItems')
    AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.PRFItems'), 'BudgetYear', 'ColumnId')
)
BEGIN
  EXEC sp_addextendedproperty 
      @name = N'MS_Description',
      @value = N'Budget year for this specific item - enables different budget years per item',
      @level0type = N'SCHEMA', @level0name = N'dbo',
      @level1type = N'TABLE', @level1name = N'PRFItems',
      @level2type = N'COLUMN', @level2name = N'BudgetYear';
END
GO

PRINT 'Migration completed: Added cost code support to PRFItems table';
