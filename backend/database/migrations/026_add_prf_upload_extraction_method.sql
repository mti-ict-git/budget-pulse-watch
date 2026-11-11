-- Apply before deploying the upload-parser feature. Existing LLM/rescan settings remain unchanged.
IF COL_LENGTH('dbo.AppSettings', 'UploadExtractionMethod') IS NULL
BEGIN
    ALTER TABLE dbo.AppSettings ADD UploadExtractionMethod NVARCHAR(10) NOT NULL
        CONSTRAINT DF_AppSettings_UploadExtractionMethod DEFAULT 'llm' WITH VALUES;
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_AppSettings_UploadExtractionMethod')
BEGIN
    ALTER TABLE dbo.AppSettings ADD CONSTRAINT CK_AppSettings_UploadExtractionMethod
        CHECK (UploadExtractionMethod IN ('llm', 'local'));
END
GO
