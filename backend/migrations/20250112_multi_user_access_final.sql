-- =====================================================
-- FINAL FIX: Multi-User Access System
-- Date: 2025-01-12
-- =====================================================

-- Drop existing function to recreate
DROP FUNCTION IF EXISTS get_accessible_forms(INTEGER, BOOLEAN);

-- Create the correct view
DROP VIEW IF EXISTS form_statistics_public;

CREATE OR REPLACE VIEW form_statistics_public AS
SELECT 
    f.id as form_id,
    f.name as form_name,
    f.visibility,
    COUNT(DISTINCT fs.id) as total_submissions,
    COUNT(DISTINCT fs.submitter_id) as unique_submitters,
    MAX(fs.created_at) as last_submission,  -- Changed to created_at
    MIN(fs.created_at) as first_submission,  -- Changed to created_at
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

-- Recreate the function with correct signature
CREATE OR REPLACE FUNCTION get_accessible_forms(
    p_user_id INTEGER,
    p_include_public BOOLEAN DEFAULT true
) RETURNS TABLE(
    form_id UUID,
    form_name VARCHAR(255),
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
        AND f.owner_id != p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Verify tables were created
SELECT 'Tables created:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('form_shares', 'form_access_logs', 'form_clones')
ORDER BY table_name;

-- Verify columns were added
SELECT 'Columns added:' as info;
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'forms' 
    AND column_name = 'visibility';

-- Update migration log
UPDATE migrations_log 
SET success = true,
    executed_at = NOW()
WHERE name = 'multi_user_access';