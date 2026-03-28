USE PRFMonitoringDB;
GO

DECLARE @constraintName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

SELECT @constraintName = cc.name
FROM sys.check_constraints cc
JOIN sys.columns c ON cc.parent_object_id = c.object_id AND cc.parent_column_id = c.column_id
JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name = 'PRFItems' AND c.name = 'Status';

IF @constraintName IS NOT NULL
BEGIN
  SET @sql = N'ALTER TABLE dbo.PRFItems DROP CONSTRAINT ' + QUOTENAME(@constraintName) + N';';
  EXEC sp_executesql @sql;
END
GO

ALTER TABLE dbo.PRFItems ALTER COLUMN Status NVARCHAR(100) NULL;
GO

UPDATE i
SET i.Status = p.Status,
    i.StatusOverridden = 0,
    i.UpdatedAt = GETDATE()
FROM dbo.PRFItems i
JOIN dbo.PRF p ON p.PRFID = i.PRFID;
GO
