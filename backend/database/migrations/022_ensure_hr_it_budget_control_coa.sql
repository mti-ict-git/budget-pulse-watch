-- Migration: Ensure mandatory HR / IT budget-control COA codes exist
-- Date: 2026-07-22
-- Purpose: Add missing mandatory HR / IT OPEX COA and normalize approved business labels

USE PRFMonitoringDB;
GO

DECLARE @MandatoryCOA TABLE (
  COACode NVARCHAR(20) NOT NULL PRIMARY KEY,
  COAName NVARCHAR(200) NOT NULL,
  Description NVARCHAR(500) NULL,
  Category NVARCHAR(100) NULL,
  Department NVARCHAR(100) NOT NULL,
  ExpenseType NVARCHAR(10) NOT NULL
);

INSERT INTO @MandatoryCOA (COACode, COAName, Description, Category, Department, ExpenseType)
VALUES
  ('MTIRMRAD496137', 'Software Maintenance', 'Mandatory HR / IT OPEX budget-control COA', 'HR / IT OPEX', 'HR / IT', 'OPEX'),
  ('MTIRMRAD496232', 'Repairs and maintenance', 'Mandatory HR / IT OPEX budget-control COA', 'HR / IT OPEX', 'HR / IT', 'OPEX'),
  ('MTIRMRAD496769', 'Tools', 'Mandatory HR / IT OPEX budget-control COA', 'HR / IT OPEX', 'HR / IT', 'OPEX'),
  ('MTIRMRAD496250', 'IT consumeables', 'Mandatory HR / IT OPEX budget-control COA', 'HR / IT OPEX', 'HR / IT', 'OPEX'),
  ('MTIRMRAD496313', 'Internet', 'Mandatory HR / IT OPEX budget-control COA', 'HR / IT OPEX', 'HR / IT', 'OPEX'),
  ('MTIRMRAD496315', 'Stationery and postage', 'Mandatory HR / IT OPEX budget-control COA', 'HR / IT OPEX', 'HR / IT', 'OPEX'),
  ('MTIRMRAD496326', 'Other permit & licenses', 'Mandatory HR / IT OPEX budget-control COA', 'HR / IT OPEX', 'HR / IT', 'OPEX'),
  ('MTIRMRAD496328', 'Subscriptions', 'Mandatory HR / IT OPEX budget-control COA', 'HR / IT OPEX', 'HR / IT', 'OPEX'),
  ('MTIRMRAD496014', 'Training and seminars', 'Mandatory HR / IT OPEX budget-control COA', 'HR / IT OPEX', 'HR / IT', 'OPEX'),
  ('MTIRMRAD496314', 'Telephone and mobile comms', 'Mandatory HR / IT OPEX budget-control COA', 'HR / IT OPEX', 'HR / IT', 'OPEX');

MERGE dbo.ChartOfAccounts AS target
USING @MandatoryCOA AS source
ON target.COACode = source.COACode
WHEN MATCHED THEN
  UPDATE SET
    target.COAName = source.COAName,
    target.Description = source.Description,
    target.Category = COALESCE(target.Category, source.Category),
    target.Department = source.Department,
    target.ExpenseType = source.ExpenseType,
    target.IsActive = 1
WHEN NOT MATCHED BY TARGET THEN
  INSERT (COACode, COAName, Description, Category, ParentCOAID, IsActive, Department, ExpenseType)
  VALUES (source.COACode, source.COAName, source.Description, source.Category, NULL, 1, source.Department, source.ExpenseType);
GO

PRINT 'Migration completed: ensured mandatory HR / IT budget-control COA coverage';
