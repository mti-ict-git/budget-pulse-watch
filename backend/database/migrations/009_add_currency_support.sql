-- Migration: Add currency support to Budget and PRF
-- Date: 2026-03-16
-- Purpose: Support IDR/USD amounts with per-record exchange rate to IDR

USE PRFMonitoringDB;
GO

IF COL_LENGTH('Budget', 'CurrencyCode') IS NULL
BEGIN
  ALTER TABLE Budget
  ADD CurrencyCode NVARCHAR(3) NOT NULL CONSTRAINT DF_Budget_CurrencyCode DEFAULT 'IDR';
END
GO

IF COL_LENGTH('Budget', 'ExchangeRateToIDR') IS NULL
BEGIN
  ALTER TABLE Budget
  ADD ExchangeRateToIDR DECIMAL(18,6) NOT NULL CONSTRAINT DF_Budget_ExchangeRateToIDR DEFAULT 1;
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_Budget_CurrencyCode'
)
BEGIN
  ALTER TABLE Budget WITH CHECK
  ADD CONSTRAINT CK_Budget_CurrencyCode CHECK (CurrencyCode IN ('IDR', 'USD'));
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_Budget_ExchangeRateToIDR'
)
BEGIN
  ALTER TABLE Budget WITH CHECK
  ADD CONSTRAINT CK_Budget_ExchangeRateToIDR CHECK (ExchangeRateToIDR > 0);
END
GO

IF COL_LENGTH('PRF', 'CurrencyCode') IS NULL
BEGIN
  ALTER TABLE PRF
  ADD CurrencyCode NVARCHAR(3) NOT NULL CONSTRAINT DF_PRF_CurrencyCode DEFAULT 'IDR';
END
GO

IF COL_LENGTH('PRF', 'ExchangeRateToIDR') IS NULL
BEGIN
  ALTER TABLE PRF
  ADD ExchangeRateToIDR DECIMAL(18,6) NOT NULL CONSTRAINT DF_PRF_ExchangeRateToIDR DEFAULT 1;
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_PRF_CurrencyCode'
)
BEGIN
  ALTER TABLE PRF WITH CHECK
  ADD CONSTRAINT CK_PRF_CurrencyCode CHECK (CurrencyCode IN ('IDR', 'USD'));
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_PRF_ExchangeRateToIDR'
)
BEGIN
  ALTER TABLE PRF WITH CHECK
  ADD CONSTRAINT CK_PRF_ExchangeRateToIDR CHECK (ExchangeRateToIDR > 0);
END
GO

UPDATE Budget
SET CurrencyCode = 'IDR'
WHERE CurrencyCode IS NULL OR CurrencyCode NOT IN ('IDR', 'USD');
GO

UPDATE Budget
SET ExchangeRateToIDR = 1
WHERE ExchangeRateToIDR IS NULL OR ExchangeRateToIDR <= 0;
GO

UPDATE PRF
SET CurrencyCode = 'IDR'
WHERE CurrencyCode IS NULL OR CurrencyCode NOT IN ('IDR', 'USD');
GO

UPDATE PRF
SET ExchangeRateToIDR = 1
WHERE ExchangeRateToIDR IS NULL OR ExchangeRateToIDR <= 0;
GO

PRINT 'Migration completed: Added currency support to Budget and PRF';
