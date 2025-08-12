-- Migration: 011_add_location_tracking_actions.sql
-- Purpose: Add GPS tracking action types to user activity logs

-- Add new action types for location tracking
ALTER TABLE user_activity_logs DROP CONSTRAINT IF EXISTS chk_action_type;
ALTER TABLE user_activity_logs ADD CONSTRAINT chk_action_type 
CHECK (action_type IN (
    'LOGIN', 'LOGOUT', 'TOKEN_REFRESH', 'FAILED_LOGIN',
    'VIEW_PROFILE', 'UPDATE_PROFILE', 'CHANGE_PASSWORD', 'UPLOAD_AVATAR',
    'VIEW_SETTINGS', 'UPDATE_SETTINGS',
    'VIEW_DASHBOARD', 'VIEW_PAGE',
    'API_CALL',
    'SUSPICIOUS_ACTIVITY', 'ERROR_OCCURRED',
    'LOCATION_UPDATE', 'LOCATION_SESSION_START', 'LOCATION_SESSION_END'
));

-- Add TRACKING category
ALTER TABLE user_activity_logs DROP CONSTRAINT IF EXISTS chk_action_category;
ALTER TABLE user_activity_logs ADD CONSTRAINT chk_action_category 
CHECK (action_category IN ('AUTH', 'PROFILE', 'SETTINGS', 'NAVIGATION', 'SECURITY', 'SYSTEM', 'TRACKING'));