IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_PRFItems_PickedUpByUserID'
      AND object_id = OBJECT_ID('dbo.PRFItems')
)
BEGIN
    DROP INDEX IX_PRFItems_PickedUpByUserID ON PRFItems;
END
GO

IF EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_PRFItems_PickedUpByUserID'
)
BEGIN
    ALTER TABLE PRFItems DROP CONSTRAINT FK_PRFItems_PickedUpByUserID;
END
GO

IF COL_LENGTH('dbo.PRFItems', 'PickedUpByUserID') IS NOT NULL
BEGIN
    ALTER TABLE PRFItems DROP COLUMN PickedUpByUserID;
END
GO

IF OBJECT_ID('dbo.BudgetCutoffAudit', 'U') IS NOT NULL
BEGIN
    DROP TABLE BudgetCutoffAudit;
END
GO

IF OBJECT_ID('dbo.BudgetCutoff', 'U') IS NOT NULL
BEGIN
    DROP TABLE BudgetCutoff;
END
GO

PRINT 'Migration 008 rollback completed';
