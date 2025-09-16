-- Migration: Update role system to three-tier structure
-- Date: 2025-09-16
-- Description: Updates Users and LDAPUserAccess tables to support new role types: admin, doccon, user

-- First, update existing role values to match new system
UPDATE Users 
SET Role = CASE 
    WHEN Role = 'Admin' THEN 'admin'
    WHEN Role = 'Manager' THEN 'doccon'
    WHEN Role = 'User' THEN 'user'
    ELSE 'user'
END;

UPDATE LDAPUserAccess 
SET Role = CASE 
    WHEN Role = 'Admin' THEN 'admin'
    WHEN Role = 'Manager' THEN 'doccon'
    WHEN Role = 'User' THEN 'user'
    ELSE 'user'
END;

-- Drop existing constraints
ALTER TABLE Users DROP CONSTRAINT CK__Users__Role__[constraint_id];
ALTER TABLE LDAPUserAccess DROP CONSTRAINT CK__LDAPUserAccess__Role__[constraint_id];

-- Add new constraints with updated role values
ALTER TABLE Users ADD CONSTRAINT CK_Users_Role CHECK (Role IN ('admin', 'doccon', 'user'));
ALTER TABLE LDAPUserAccess ADD CONSTRAINT CK_LDAPUserAccess_Role CHECK (Role IN ('admin', 'doccon', 'user'));

-- Update default values
ALTER TABLE Users ADD CONSTRAINT DF_Users_Role DEFAULT 'user' FOR Role;
ALTER TABLE LDAPUserAccess ADD CONSTRAINT DF_LDAPUserAccess_Role DEFAULT 'user' FOR Role;

PRINT 'Role system migration completed successfully';
PRINT 'New roles: admin (full access), doccon (create/submit PRF, define budgeting), user (view only)';