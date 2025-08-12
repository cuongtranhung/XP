-- =====================================================
-- FIX: Multi-User Access System Migration Issues
-- Date: 2025-01-12
-- =====================================================

-- Fix the view with correct column names
DROP VIEW IF EXISTS form_statistics_public;

CREATE OR REPLACE VIEW form_statistics_public AS
SELECT 
    f.id as form_id,
    f.name as form_name,  -- Changed from title to name
    f.visibility,
    COUNT(DISTINCT fs.id) as total_submissions,
    COUNT(DISTINCT fs.submitter_id) as unique_submitters,
    MAX(fs.submitted_at) as last_submission,
    MIN(fs.submitted_at) as first_submission,
    CASE 
        WHEN COUNT(fs.id) > 0 THEN 
            ROUND(100.0 * COUNT(CASE WHEN fs.status = 'completed' THEN 1 END) / COUNT(fs.id), 2)
        ELSE 0 
    END as completion_rate
FROM forms f
LEFT JOIN form_submissions fs ON f.id = fs.form_id
WHERE f.visibility IN ('public', 'organization')
    AND f.deleted_at IS NULL
    AND f.status = 'published'
GROUP BY f.id, f.name, f.visibility;

-- Fix the get_accessible_forms function
CREATE OR REPLACE FUNCTION get_accessible_forms(
    p_user_id INTEGER,
    p_include_public BOOLEAN DEFAULT true
) RETURNS TABLE(
    form_id UUID,
    form_name VARCHAR(255),  -- Changed from title to form_name
    owner_id INTEGER,
    visibility VARCHAR(50),
    permission_level VARCHAR(20),
    access_type VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    -- User's own forms
    SELECT 
        f.id,
        f.name::VARCHAR(255),
        f.owner_id,
        f.visibility::VARCHAR(50),
        'owner'::VARCHAR(20) as permission_level,
        'owned'::VARCHAR(20) as access_type
    FROM forms f
    WHERE f.owner_id = p_user_id
        AND f.deleted_at IS NULL
    
    UNION
    
    -- Shared forms
    SELECT 
        f.id,
        f.name::VARCHAR(255),
        f.owner_id,
        f.visibility::VARCHAR(50),
        fs.permission_level,
        'shared'::VARCHAR(20) as access_type
    FROM forms f
    INNER JOIN form_shares fs ON f.id = fs.form_id
    WHERE fs.shared_with_user_id = p_user_id
        AND f.deleted_at IS NULL
        AND (fs.expires_at IS NULL OR fs.expires_at > NOW())
    
    UNION
    
    -- Public forms (if requested)
    SELECT 
        f.id,
        f.name::VARCHAR(255),
        f.owner_id,
        f.visibility::VARCHAR(50),
        'view'::VARCHAR(20) as permission_level,
        'public'::VARCHAR(20) as access_type
    FROM forms f
    WHERE p_include_public = true
        AND f.visibility = 'public'
        AND f.deleted_at IS NULL
        AND f.status = 'published'
        AND f.owner_id != p_user_id; -- Exclude own forms already included
END;
$$ LANGUAGE plpgsql;

-- Create migrations tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations_log (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    version VARCHAR(50),
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    description TEXT
);

-- Log the migration
INSERT INTO migrations_log (
    name,
    version,
    executed_at,
    execution_time_ms,
    success,
    description
) VALUES (
    'multi_user_access',
    '1.0.0',
    NOW(),
    0,
    true,
    'Enable multi-user form sharing and collaboration features'
) ON CONFLICT (name) DO UPDATE 
SET 
    version = EXCLUDED.version,
    executed_at = EXCLUDED.executed_at,
    success = EXCLUDED.success;