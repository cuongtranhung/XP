-- Migration: 004_performance_views
-- Description: Add performance optimization views and functions
-- Author: Dynamic Form Builder Module
-- Date: 2024-01-04

SET search_path TO formbuilder, public;

-- Create materialized view for form statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS form_statistics AS
SELECT 
    f.id,
    f.title,
    f.status,
    f.created_at,
    f.user_id,
    COUNT(DISTINCT s.id) as total_submissions,
    COUNT(DISTINCT s.submitted_by) as unique_submitters,
    AVG(s.completion_time) as avg_completion_time,
    MAX(s.submitted_at) as last_submission_at,
    COALESCE(SUM(a.views), 0) as total_views,
    COALESCE(SUM(a.completions), 0) as total_completions,
    CASE 
        WHEN COALESCE(SUM(a.starts), 0) > 0 
        THEN ROUND((COALESCE(SUM(a.completions), 0)::DECIMAL / SUM(a.starts)) * 100, 2)
        ELSE 0 
    END as completion_rate
FROM forms f
LEFT JOIN form_submissions s ON f.id = s.form_id
LEFT JOIN form_analytics a ON f.id = a.form_id
WHERE f.deleted_at IS NULL
GROUP BY f.id, f.title, f.status, f.created_at, f.user_id;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_form_stats_user_id ON form_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_form_stats_status ON form_statistics(status);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_form_statistics() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY form_statistics;
END;
$$ LANGUAGE plpgsql;

-- Create view for recent submissions
CREATE OR REPLACE VIEW recent_submissions AS
SELECT 
    s.id,
    s.form_id,
    s.data,
    s.submitted_by,
    s.submitted_at,
    s.ip_address,
    s.completion_time,
    f.title as form_title,
    f.user_id as form_owner_id,
    COUNT(sf.id) as file_count
FROM form_submissions s
JOIN forms f ON s.form_id = f.id
LEFT JOIN form_submission_files sf ON s.id = sf.submission_id
WHERE s.submitted_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY s.id, s.form_id, s.data, s.submitted_by, s.submitted_at, 
         s.ip_address, s.completion_time, f.title, f.user_id
ORDER BY s.submitted_at DESC;

-- Create view for form field usage statistics
CREATE OR REPLACE VIEW field_usage_stats AS
WITH field_stats AS (
    SELECT 
        form_id,
        jsonb_array_elements(fields) ->> 'key' as field_key,
        jsonb_array_elements(fields) ->> 'type' as field_type,
        jsonb_array_elements(fields) ->> 'label' as field_label
    FROM forms
    WHERE deleted_at IS NULL
)
SELECT 
    fs.form_id,
    fs.field_key,
    fs.field_type,
    fs.field_label,
    COUNT(DISTINCT s.id) as submission_count,
    COUNT(CASE WHEN s.data ? fs.field_key THEN 1 END) as filled_count,
    ROUND(
        (COUNT(CASE WHEN s.data ? fs.field_key THEN 1 END)::DECIMAL / 
         NULLIF(COUNT(DISTINCT s.id), 0)) * 100, 2
    ) as fill_rate
FROM field_stats fs
LEFT JOIN form_submissions s ON fs.form_id = s.form_id
GROUP BY fs.form_id, fs.field_key, fs.field_type, fs.field_label;

-- Create function for bulk analytics update
CREATE OR REPLACE FUNCTION bulk_update_analytics(
    p_updates JSONB[]
) RETURNS void AS $$
DECLARE
    v_update JSONB;
BEGIN
    FOREACH v_update IN ARRAY p_updates
    LOOP
        PERFORM update_form_analytics(
            (v_update->>'form_id')::UUID,
            v_update->>'event_type',
            v_update->>'field_key',
            v_update->>'device_type',
            (v_update->>'completion_time')::INTEGER
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create cleanup function for old data
CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS void AS $$
BEGIN
    -- Delete old webhook logs (keep 30 days)
    DELETE FROM webhook_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Delete old collaboration sessions (keep 1 day)
    DELETE FROM collaboration_sessions WHERE last_activity < CURRENT_TIMESTAMP - INTERVAL '1 day';
    
    -- Archive old forms (soft delete after 1 year of inactivity)
    UPDATE forms 
    SET status = 'archived', deleted_at = CURRENT_TIMESTAMP
    WHERE status != 'archived' 
    AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 year';
    
    -- Delete orphaned files
    DELETE FROM form_submission_files
    WHERE submission_id NOT IN (SELECT id FROM form_submissions);
END;
$$ LANGUAGE plpgsql;

-- Create scheduled job function
CREATE OR REPLACE FUNCTION schedule_maintenance() RETURNS void AS $$
BEGIN
    -- This function would be called by a cron job or scheduler
    PERFORM cleanup_old_data();
    PERFORM refresh_form_statistics();
END;
$$ LANGUAGE plpgsql;