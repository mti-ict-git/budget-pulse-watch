-- Buyer responsible for the PO in Pronto, synced by the Pronto worker from the Purchase Orders grid:
-- "Buyer allocation", or "Officer" (the buyer who converted the requisition) when it is empty.
IF COL_LENGTH('dbo.PRF', 'AllocatedBuyer') IS NULL
BEGIN
    ALTER TABLE dbo.PRF ADD AllocatedBuyer NVARCHAR(200) NULL;
END
GO
