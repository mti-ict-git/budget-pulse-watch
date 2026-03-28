USE PRFMonitoringDB;
GO

UPDATE dbo.Users
SET Role = CASE
  WHEN Role = 'Admin' THEN 'admin'
  WHEN Role = 'Manager' THEN 'doccon'
  WHEN Role = 'User' THEN 'user'
  WHEN Role = 'admin' THEN 'admin'
  WHEN Role = 'doccon' THEN 'doccon'
  WHEN Role = 'user' THEN 'user'
  ELSE 'user'
END;
GO

IF OBJECT_ID('dbo.LDAPUserAccess', 'U') IS NOT NULL
BEGIN
  UPDATE dbo.LDAPUserAccess
  SET Role = CASE
    WHEN Role = 'Admin' THEN 'admin'
    WHEN Role = 'Manager' THEN 'doccon'
    WHEN Role = 'User' THEN 'user'
    WHEN Role = 'admin' THEN 'admin'
    WHEN Role = 'doccon' THEN 'doccon'
    WHEN Role = 'user' THEN 'user'
    ELSE 'user'
  END;
END
GO

DECLARE @sql NVARCHAR(MAX);

SELECT TOP 1 @sql = N'ALTER TABLE dbo.Users DROP CONSTRAINT ' + QUOTENAME(cc.name)
FROM sys.check_constraints cc
JOIN sys.columns c ON cc.parent_object_id = c.object_id AND c.column_id = cc.parent_column_id
WHERE cc.parent_object_id = OBJECT_ID('dbo.Users')
  AND c.name = 'Role';
IF @sql IS NOT NULL EXEC sp_executesql @sql;
GO

SELECT TOP 1 @sql = N'ALTER TABLE dbo.Users DROP CONSTRAINT ' + QUOTENAME(dc.name)
FROM sys.default_constraints dc
JOIN sys.columns c ON dc.parent_object_id = c.object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.Users')
  AND c.name = 'Role';
IF @sql IS NOT NULL EXEC sp_executesql @sql;
GO

IF OBJECT_ID('dbo.LDAPUserAccess', 'U') IS NOT NULL
BEGIN
  SELECT TOP 1 @sql = N'ALTER TABLE dbo.LDAPUserAccess DROP CONSTRAINT ' + QUOTENAME(cc.name)
  FROM sys.check_constraints cc
  JOIN sys.columns c ON cc.parent_object_id = c.object_id AND c.column_id = cc.parent_column_id
  WHERE cc.parent_object_id = OBJECT_ID('dbo.LDAPUserAccess')
    AND c.name = 'Role';
  IF @sql IS NOT NULL EXEC sp_executesql @sql;
END
GO

IF OBJECT_ID('dbo.LDAPUserAccess', 'U') IS NOT NULL
BEGIN
  SELECT TOP 1 @sql = N'ALTER TABLE dbo.LDAPUserAccess DROP CONSTRAINT ' + QUOTENAME(dc.name)
  FROM sys.default_constraints dc
  JOIN sys.columns c ON dc.parent_object_id = c.object_id AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.LDAPUserAccess')
    AND c.name = 'Role';
  IF @sql IS NOT NULL EXEC sp_executesql @sql;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Role' AND parent_object_id = OBJECT_ID('dbo.Users'))
BEGIN
  ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_Role CHECK (Role IN ('admin', 'doccon', 'user'));
END
GO

IF OBJECT_ID('dbo.LDAPUserAccess', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_LDAPUserAccess_Role' AND parent_object_id = OBJECT_ID('dbo.LDAPUserAccess'))
  BEGIN
    ALTER TABLE dbo.LDAPUserAccess ADD CONSTRAINT CK_LDAPUserAccess_Role CHECK (Role IN ('admin', 'doccon', 'user'));
  END
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Users_Role' AND parent_object_id = OBJECT_ID('dbo.Users'))
BEGIN
  ALTER TABLE dbo.Users ADD CONSTRAINT DF_Users_Role DEFAULT 'user' FOR Role;
END
GO

IF OBJECT_ID('dbo.LDAPUserAccess', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_LDAPUserAccess_Role' AND parent_object_id = OBJECT_ID('dbo.LDAPUserAccess'))
  BEGIN
    ALTER TABLE dbo.LDAPUserAccess ADD CONSTRAINT DF_LDAPUserAccess_Role DEFAULT 'user' FOR Role;
  END
END
GO

PRINT 'Role system migration completed successfully';
GO
