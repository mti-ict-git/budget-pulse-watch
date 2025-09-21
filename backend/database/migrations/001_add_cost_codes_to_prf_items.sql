-- Migration: Add cost code support to PRFItems table
-- Date: 2025-01-21
-- Purpose: Enable multiple cost codes per PRF through item-level cost code assignment

-- Add cost code fields to PRFItems table
ALTER TABLE PRFItems 
ADD PurchaseCostCode NVARCHAR(50) NULL,
    COAID INT NULL,
    BudgetYear INT NULL;

-- Add foreign key constraint for COAID
ALTER TABLE PRFItems 
ADD CONSTRAINT FK_PRFItems_ChartOfAccounts 
FOREIGN KEY (COAID) REFERENCES ChartOfAccounts(COAID);

-- Create index for better performance on cost code queries
CREATE INDEX IX_PRFItems_PurchaseCostCode ON PRFItems(PurchaseCostCode);
CREATE INDEX IX_PRFItems_COAID ON PRFItems(COAID);
CREATE INDEX IX_PRFItems_BudgetYear ON PRFItems(BudgetYear);

-- Update existing PRFItems with cost codes from their parent PRF
-- This migration handles existing data by copying cost codes from PRF level to item level
UPDATE PRFItems 
SET PurchaseCostCode = p.PurchaseCostCode,
    COAID = p.COAID,
    BudgetYear = p.BudgetYear
FROM PRFItems pi
INNER JOIN PRF p ON pi.PRFID = p.PRFID
WHERE pi.PurchaseCostCode IS NULL;

-- Add comment to document the change
EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Purchase cost code for this specific item - enables multiple cost codes per PRF',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'PRFItems',
    @level2type = N'COLUMN', @level2name = N'PurchaseCostCode';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Chart of Accounts ID for this specific item - enables multiple COA codes per PRF',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'PRFItems',
    @level2type = N'COLUMN', @level2name = N'COAID';

EXEC sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'Budget year for this specific item - enables different budget years per item',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE', @level1name = N'PRFItems',
    @level2type = N'COLUMN', @level2name = N'BudgetYear';

PRINT 'Migration completed: Added cost code support to PRFItems table';