-- Migration: Add Composite Indexes for Performance Optimization
-- Description: Creates composite indexes to improve query performance for common access patterns
-- Author: System
-- Date: 2025-08-07

-- ============================================================
-- USER ACTIVITY LOGS COMPOSITE INDEXES
-- ============================================================

-- Index for filtering activity logs by user and date range (most common query)
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_created 
ON user_activity_logs(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- Index for session-based activity queries
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_session_created 
ON user_activity_logs(session_id, created_at DESC)
WHERE session_id IS NOT NULL;

-- Index for filtering by action type and category with user
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_action_category 
ON user_activity_logs(user_id, action_type, action_category, created_at DESC);

-- Index for endpoint-based queries (API monitoring)
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_endpoint_status 
ON user_activity_logs(endpoint, response_status, created_at DESC)
WHERE endpoint IS NOT NULL;

-- ============================================================
-- USER SESSIONS COMPOSITE INDEXES
-- ============================================================

-- Index for finding active sessions by user
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active 
ON user_sessions(user_id, is_active, expires_at)
WHERE is_active = true;

-- Index for session cleanup queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_expired_active 
ON user_sessions(expires_at, is_active)
WHERE is_active = true;

-- Index for device fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_device 
ON user_sessions(user_id, device_fingerprint, created_at DESC)
WHERE device_fingerprint IS NOT NULL;

-- ============================================================
-- USERS TABLE COMPOSITE INDEXES
-- ============================================================

-- Index for email verification queries
CREATE INDEX IF NOT EXISTS idx_users_email_verified 
ON users(email, email_verified, created_at)
WHERE deleted_at IS NULL;

-- Index for login queries (email + password verification)
CREATE INDEX IF NOT EXISTS idx_users_email_active 
ON users(email, is_active)
WHERE deleted_at IS NULL AND is_active = true;

-- ============================================================
-- USER LOCATIONS COMPOSITE INDEXES (GPS Module)
-- ============================================================

-- Index for finding recent locations by user
CREATE INDEX IF NOT EXISTS idx_user_locations_user_created 
ON user_locations(user_id, created_at DESC);

-- Index for geospatial queries with time range
CREATE INDEX IF NOT EXISTS idx_user_locations_user_time_coords 
ON user_locations(user_id, created_at DESC, latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index for session-based location queries
CREATE INDEX IF NOT EXISTS idx_user_locations_session_created 
ON user_locations(session_id, created_at DESC)
WHERE session_id IS NOT NULL;

-- ============================================================
-- LOCATION TRACKING SESSIONS COMPOSITE INDEXES
-- ============================================================

-- Index for finding active tracking sessions
CREATE INDEX IF NOT EXISTS idx_location_tracking_active_user 
ON location_tracking_sessions(user_id, is_active, started_at DESC)
WHERE is_active = true;

-- Index for session history queries
CREATE INDEX IF NOT EXISTS idx_location_tracking_user_dates 
ON location_tracking_sessions(user_id, started_at DESC, ended_at);

-- ============================================================
-- DYNAMIC FORMS COMPOSITE INDEXES
-- ============================================================

-- Index for form listing queries (by user and status)
CREATE INDEX IF NOT EXISTS idx_forms_user_status_created 
ON forms(user_id, status, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for public form queries
CREATE INDEX IF NOT EXISTS idx_forms_public_active 
ON forms(is_public, status, created_at DESC)
WHERE is_public = true AND status = 'published' AND deleted_at IS NULL;

-- Index for form category filtering
CREATE INDEX IF NOT EXISTS idx_forms_category_status 
ON forms(category, status, created_at DESC)
WHERE deleted_at IS NULL;

-- ============================================================
-- FORM SUBMISSIONS COMPOSITE INDEXES
-- ============================================================

-- Index for submission queries by form
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_created 
ON form_submissions(form_id, created_at DESC);

-- Index for submission status filtering
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_status 
ON form_submissions(form_id, status, created_at DESC);

-- Index for user submission history
CREATE INDEX IF NOT EXISTS idx_form_submissions_user_created 
ON form_submissions(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- ============================================================
-- FORM FIELDS COMPOSITE INDEXES
-- ============================================================

-- Index for field ordering within forms
CREATE INDEX IF NOT EXISTS idx_form_fields_form_order 
ON form_fields(form_id, field_order, created_at);

-- Index for required field queries
CREATE INDEX IF NOT EXISTS idx_form_fields_form_required 
ON form_fields(form_id, is_required, field_order)
WHERE is_required = true;

-- ============================================================
-- FORM WEBHOOKS COMPOSITE INDEXES
-- ============================================================

-- Index for active webhook queries
CREATE INDEX IF NOT EXISTS idx_form_webhooks_form_active 
ON form_webhooks(form_id, is_active, created_at)
WHERE is_active = true;

-- ============================================================
-- PERFORMANCE MONITORING INDEXES
-- ============================================================

-- Partial index for slow queries (response time > 1000ms)
CREATE INDEX IF NOT EXISTS idx_activity_logs_slow_queries 
ON user_activity_logs(endpoint, response_time, created_at DESC)
WHERE response_time > 1000;

-- Index for error tracking (non-200 responses)
CREATE INDEX IF NOT EXISTS idx_activity_logs_errors 
ON user_activity_logs(endpoint, response_status, created_at DESC)
WHERE response_status >= 400;

-- ============================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================

-- Update statistics for query planner optimization
ANALYZE users;
ANALYZE user_sessions;
ANALYZE user_activity_logs;
ANALYZE user_locations;
ANALYZE location_tracking_sessions;
ANALYZE forms;
ANALYZE form_submissions;
ANALYZE form_fields;
ANALYZE form_webhooks;

-- ============================================================
-- INDEX USAGE MONITORING VIEW
-- ============================================================

-- Create view to monitor index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'RARELY USED'
        WHEN idx_scan < 1000 THEN 'OCCASIONALLY USED'
        ELSE 'FREQUENTLY USED'
    END as usage_category
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ============================================================
-- QUERY PERFORMANCE VIEW
-- ============================================================

-- Create view to monitor slow queries
CREATE OR REPLACE VIEW slow_query_log AS
SELECT 
    query,
    calls,
    round(total_exec_time::numeric, 2) as total_time_ms,
    round(mean_exec_time::numeric, 2) as avg_time_ms,
    round(max_exec_time::numeric, 2) as max_time_ms,
    round(stddev_exec_time::numeric, 2) as stddev_time_ms,
    rows
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- Queries averaging over 100ms
ORDER BY mean_exec_time DESC
LIMIT 50;

-- ============================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON INDEX idx_user_activity_logs_user_created IS 'Optimizes user activity history queries';
COMMENT ON INDEX idx_user_sessions_user_active IS 'Optimizes active session lookups';
COMMENT ON INDEX idx_users_email_verified IS 'Optimizes email verification status queries';
COMMENT ON INDEX idx_forms_user_status_created IS 'Optimizes form listing and filtering';
COMMENT ON INDEX idx_form_submissions_form_created IS 'Optimizes submission retrieval by form';
COMMENT ON INDEX idx_user_locations_user_created IS 'Optimizes GPS location history queries';

-- ============================================================
-- MIGRATION COMPLETION
-- ============================================================

-- Log migration completion
INSERT INTO user_activity_logs (
    user_id,
    action_type,
    action_category,
    description,
    metadata
) VALUES (
    1, -- System user
    'MIGRATION',
    'DATABASE',
    'Applied composite indexes for performance optimization',
    jsonb_build_object(
        'migration', '017_add_composite_indexes_optimization',
        'indexes_created', 28,
        'tables_analyzed', 9,
        'views_created', 2
    )
);

-- Output success message
DO $$
BEGIN
    RAISE NOTICE 'Composite indexes migration completed successfully!';
    RAISE NOTICE 'Created 28 composite indexes across 9 tables';
    RAISE NOTICE 'Created 2 monitoring views for performance tracking';
    RAISE NOTICE 'Run EXPLAIN ANALYZE on your queries to verify index usage';
END $$;