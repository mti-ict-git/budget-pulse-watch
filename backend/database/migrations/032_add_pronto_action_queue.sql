-- Pronto Immediate Action queue (PO M094, Approve/Review Requisitions), read hourly by the Pronto
-- worker. One row per requisition in the queue; the whole table is replaced on every successful read.
-- The backend also creates these objects at startup (initializeDatabase.ts).
IF OBJECT_ID('dbo.ProntoActionQueue', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProntoActionQueue (
        OrderNo NVARCHAR(20) NOT NULL PRIMARY KEY,
        Supplier NVARCHAR(50) NULL,
        Warehouse NVARCHAR(20) NULL,
        DueDate DATE NULL,
        RequestUser NVARCHAR(50) NULL,
        CostCategory NVARCHAR(50) NULL,
        ReqTotal DECIMAL(18,2) NULL,
        Currency NVARCHAR(10) NULL,
        LocalValue DECIMAL(18,2) NULL,
        Auth NVARCHAR(10) NULL,
        ActionGroup NVARCHAR(50) NULL,
        Buyer NVARCHAR(100) NULL,
        StockGroup NVARCHAR(100) NULL,
        Priority NVARCHAR(10) NULL,
        NextActionByJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_ProntoActionQueue_NextActionBy DEFAULT '[]',
        ApprovalsJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_ProntoActionQueue_Approvals DEFAULT '[]',
        ReadErrors NVARCHAR(1000) NULL,
        CheckedAt DATETIME2 NOT NULL
    );
END
GO

IF COL_LENGTH('dbo.AppSettings', 'ProntoQueueCheckedAt') IS NULL
    ALTER TABLE dbo.AppSettings ADD ProntoQueueCheckedAt DATETIME2 NULL;
IF COL_LENGTH('dbo.AppSettings', 'ProntoQueueLastSuccessAt') IS NULL
    ALTER TABLE dbo.AppSettings ADD ProntoQueueLastSuccessAt DATETIME2 NULL;
IF COL_LENGTH('dbo.AppSettings', 'ProntoQueueUser') IS NULL
    ALTER TABLE dbo.AppSettings ADD ProntoQueueUser NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.AppSettings', 'ProntoQueueError') IS NULL
    ALTER TABLE dbo.AppSettings ADD ProntoQueueError NVARCHAR(1000) NULL;
GO
