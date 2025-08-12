-- Migration: Create activity log utility functions
-- Description: Functions for data retention, cleanup, and maintenance
-- Author: System
-- Date: 2025-08-04

-- Function to clean up old activity logs (configurable retention period)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs(retention_days INTEGER DEFAULT 365)
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
    cutoff_date TIMESTAMP WITH TIME ZONE;
    result_count BIGINT;
BEGIN
    cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
    
    DELETE FROM user_activity_logs 
    WHERE created_at < cutoff_date;
    
    GET DIAGNOSTICS result_count = ROW_COUNT;
    
    -- Log the cleanup operation
    INSERT INTO user_activity_logs (
        user_id, action_type, action_category, endpoint, method,
        response_status, metadata, created_at
    ) VALUES (
        0, -- System user
        'CLEANUP_LOGS',
        'SYSTEM',
        'SYSTEM/cleanup',
        'DELETE',
        200,
        jsonb_build_object(
            'retention_days', retention_days,
            'cutoff_date', cutoff_date,
            'deleted_count', result_count
        ),
        NOW()
    );
    
    RETURN QUERY SELECT result_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
    result_count BIGINT;
BEGIN
    -- Mark expired sessions as inactive
    UPDATE user_sessions 
    SET is_active = false, logout_reason = 'TOKEN_EXPIRED'
    WHERE expires_at < NOW() AND is_active = true;
    
    -- Delete old inactive sessions (older than 30 days)
    DELETE FROM user_sessions 
    WHERE is_active = false 
    AND last_activity < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS result_count = ROW_COUNT;
    
    RETURN QUERY SELECT result_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user activity statistics
CREATE OR REPLACE FUNCTION get_user_activity_stats(
    p_user_id INTEGER,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(
    total_actions BIGINT,
    login_count BIGINT,
    page_views BIGINT,
    api_calls BIGINT,
    last_activity TIMESTAMP WITH TIME ZONE,
    most_common_action VARCHAR(50),
    unique_sessions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_actions,
        COUNT(*) FILTER (WHERE action_type = 'LOGIN') as login_count,
        COUNT(*) FILTER (WHERE action_type = 'VIEW_PAGE') as page_views,
        COUNT(*) FILTER (WHERE action_type = 'API_CALL') as api_calls,
        MAX(created_at) as last_activity,
        MODE() WITHIN GROUP (ORDER BY action_type) as most_common_action,
        COUNT(DISTINCT session_id) as unique_sessions
    FROM user_activity_logs 
    WHERE user_id = p_user_id 
    AND created_at BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- Function to detect suspicious activities
CREATE OR REPLACE FUNCTION detect_suspicious_activities(
    p_user_id INTEGER DEFAULT NULL,
    p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE(
    user_id INTEGER,
    suspicious_type VARCHAR(50),
    event_count BIGINT,
    first_event TIMESTAMP WITH TIME ZONE,
    last_event TIMESTAMP WITH TIME ZONE,
    details JSONB
) AS $$
DECLARE
    time_threshold TIMESTAMP WITH TIME ZONE;
BEGIN
    time_threshold := NOW() - (p_hours_back || ' hours')::INTERVAL;
    
    -- Multiple failed logins
    RETURN QUERY
    SELECT 
        l.user_id,
        'MULTIPLE_FAILED_LOGINS'::VARCHAR(50),
        COUNT(*),
        MIN(l.created_at),
        MAX(l.created_at),
        jsonb_build_object(
            'ip_addresses', array_agg(DISTINCT l.ip_address::TEXT),
            'user_agents', array_agg(DISTINCT l.user_agent)
        )
    FROM user_activity_logs l
    WHERE l.action_type = 'FAILED_LOGIN'
    AND l.created_at >= time_threshold
    AND (p_user_id IS NULL OR l.user_id = p_user_id)
    GROUP BY l.user_id
    HAVING COUNT(*) >= 5;
    
    -- Multiple IP addresses in short time
    RETURN QUERY
    SELECT 
        l.user_id,
        'MULTIPLE_LOCATIONS'::VARCHAR(50),
        COUNT(DISTINCT l.ip_address),
        MIN(l.created_at),
        MAX(l.created_at),
        jsonb_build_object(
            'ip_addresses', array_agg(DISTINCT l.ip_address::TEXT),
            'time_span_minutes', EXTRACT(EPOCH FROM (MAX(l.created_at) - MIN(l.created_at)))/60
        )
    FROM user_activity_logs l
    WHERE l.created_at >= time_threshold
    AND (p_user_id IS NULL OR l.user_id = p_user_id)
    AND l.action_type = 'LOGIN'
    GROUP BY l.user_id
    HAVING COUNT(DISTINCT l.ip_address) >= 3;
    
END;
$$ LANGUAGE plpgsql;

-- Function to archive old logs to a separate table (optional)
CREATE TABLE IF NOT EXISTS user_activity_logs_archive (
    LIKE user_activity_logs INCLUDING ALL
);

CREATE OR REPLACE FUNCTION archive_old_activity_logs(archive_days INTEGER DEFAULT 90)
RETURNS TABLE(archived_count BIGINT) AS $$
DECLARE
    cutoff_date TIMESTAMP WITH TIME ZONE;
    result_count BIGINT;
BEGIN
    cutoff_date := NOW() - (archive_days || ' days')::INTERVAL;
    
    -- Move old records to archive table
    WITH moved_logs AS (
        DELETE FROM user_activity_logs 
        WHERE created_at < cutoff_date
        RETURNING *
    )
    INSERT INTO user_activity_logs_archive 
    SELECT * FROM moved_logs;
    
    GET DIAGNOSTICS result_count = ROW_COUNT;
    
    RETURN QUERY SELECT result_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for recent user activities (commonly used query)
CREATE OR REPLACE VIEW recent_user_activities AS
SELECT 
    l.id,
    l.user_id,
    u.full_name,
    u.email,
    l.session_id,
    l.action_type,
    l.action_category,
    l.endpoint,
    l.method,
    l.response_status,
    l.ip_address,
    l.created_at,
    l.processing_time_ms
FROM user_activity_logs l
JOIN users u ON l.user_id = u.id
WHERE l.created_at >= NOW() - INTERVAL '7 days'
ORDER BY l.created_at DESC;

-- Create materialized view for activity statistics (for performance)
CREATE MATERIALIZED VIEW user_activity_daily_stats AS
SELECT 
    user_id,
    DATE(created_at) as activity_date,
    action_category,
    COUNT(*) as action_count,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(DISTINCT ip_address) as unique_ips,
    AVG(processing_time_ms) as avg_processing_time
FROM user_activity_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id, DATE(created_at), action_category;

-- Create index on materialized view
CREATE INDEX idx_user_activity_daily_stats_user_date ON user_activity_daily_stats(user_id, activity_date DESC);

-- Function to refresh materialized view (call this daily)
CREATE OR REPLACE FUNCTION refresh_activity_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW user_activity_daily_stats;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON FUNCTION cleanup_old_activity_logs IS 'Removes activity logs older than specified days (default: 365 days)';
COMMENT ON FUNCTION cleanup_expired_sessions IS 'Cleans up expired and old inactive sessions';
COMMENT ON FUNCTION get_user_activity_stats IS 'Returns activity statistics for a specific user in a date range';
COMMENT ON FUNCTION detect_suspicious_activities IS 'Detects suspicious user activities like multiple failed logins or location changes';
COMMENT ON FUNCTION archive_old_activity_logs IS 'Archives old activity logs to separate table instead of deleting';
COMMENT ON VIEW recent_user_activities IS 'View showing recent user activities with user information';
COMMENT ON MATERIALIZED VIEW user_activity_daily_stats IS 'Materialized view with daily activity statistics for performance';