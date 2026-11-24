-- Date Required written as "ASAP" on the PRF (product owner, 2026-11-24). RequiredDate stays NULL
-- unless a real date is known (for example later from Pronto); the flag keeps "ASAP" visible.
IF COL_LENGTH('dbo.PRF', 'RequiredASAP') IS NULL
BEGIN
    ALTER TABLE dbo.PRF ADD RequiredASAP BIT NOT NULL CONSTRAINT DF_PRF_RequiredASAP DEFAULT 0;
END
GO
