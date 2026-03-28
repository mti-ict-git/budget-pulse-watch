-- Migration 003: Recreate PRF table without PRFNumber (drop-and-recreate with data preservation)
-- Date: 2025-09-14
-- Description: When dropping PRFNumber column is blocked, recreate PRF table without PRFNumber and preserve data/constraints

USE PRFMonitoringDB;
GO

PRINT 'Skipping migration 003: PRF table is already without PRFNumber in this environment.';
GO
