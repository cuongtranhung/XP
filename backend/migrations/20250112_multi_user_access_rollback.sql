-- =====================================================
-- ROLLBACK: Multi-User Access System
-- Version: 1.0.0
-- Date: 2025-01-12
-- Description: Rollback multi-user access features
-- =====================================================

-- IMPORTANT: This will permanently delete all sharing data!
-- Make sure to backup before running this rollback

BEGIN;

-- =====================================================
-- STEP 1: Drop helper functions
-- =====================================================
DROP FUNCTION IF EXISTS check_form_permission(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_accessible_forms(INTEGER, BOOLEAN);

-- =====================================================
-- STEP 2: Drop views
-- =====================================================
DROP VIEW IF EXISTS form_statistics_public;

-- =====================================================
-- STEP 3: Drop tables (in correct order due to foreign keys)
-- =====================================================
DROP TABLE IF EXISTS form_clones;
DROP TABLE IF EXISTS form_access_logs;
DROP TABLE IF EXISTS form_shares;

-- =====================================================
-- STEP 4: Remove columns from existing tables
-- =====================================================
ALTER TABLE forms DROP COLUMN IF EXISTS visibility;

-- =====================================================
-- STEP 5: Drop indexes (if they still exist)
-- =====================================================
DROP INDEX IF EXISTS idx_forms_visibility;
DROP INDEX IF EXISTS idx_forms_owner_visibility;
DROP INDEX IF EXISTS idx_forms_visibility_created;

-- =====================================================
-- STEP 6: Remove migration log entry
-- =====================================================
DELETE FROM migrations_log WHERE name = 'multi_user_access';

COMMIT;

-- =====================================================
-- POST-ROLLBACK VERIFICATION
-- =====================================================
-- Run these queries to verify rollback was successful:
/*
-- Check tables were removed
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('form_shares', 'form_access_logs', 'form_clones');

-- Check column was removed
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'forms' 
    AND column_name = 'visibility';

-- Check functions were removed
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name IN ('check_form_permission', 'get_accessible_forms');
*/