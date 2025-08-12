-- =====================================================
-- Migration: Multi-User Access System
-- Version: 1.0.0
-- Date: 2025-01-12
-- Author: XP Development Team
-- Description: Enable multi-user form sharing and collaboration
-- =====================================================

-- =====================================================
-- STEP 1: Create form_shares table for sharing mechanism
-- =====================================================
CREATE TABLE IF NOT EXISTS form_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL,
    shared_with_user_id INTEGER NOT NULL,
    shared_by_user_id INTEGER NOT NULL,
    permission_level VARCHAR(20) NOT NULL DEFAULT 'view',
    shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    notes TEXT,
    
    -- Constraints
    CONSTRAINT fk_form_shares_form 
        FOREIGN KEY (form_id) 
        REFERENCES forms(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_form_shares_user 
        FOREIGN KEY (shared_with_user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_form_shares_by_user 
        FOREIGN KEY (shared_by_user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL,
    
    CONSTRAINT chk_permission_level 
        CHECK (permission_level IN ('view', 'submit', 'edit', 'admin')),
    
    -- Prevent duplicate shares
    CONSTRAINT uq_form_user_share 
        UNIQUE(form_id, shared_with_user_id)
);

-- Add indexes for performance
CREATE INDEX idx_form_shares_form ON form_shares(form_id);
CREATE INDEX idx_form_shares_user ON form_shares(shared_with_user_id);
CREATE INDEX idx_form_shares_expires ON form_shares(expires_at) WHERE expires_at IS NOT NULL;

-- Add comments
COMMENT ON TABLE form_shares IS 'Tracks form sharing between users with granular permissions';
COMMENT ON COLUMN form_shares.permission_level IS 'Permission level: view (read-only), submit (can submit), edit (can modify), admin (full control)';

-- =====================================================
-- STEP 2: Add visibility column to forms table
-- =====================================================
ALTER TABLE forms 
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private';

-- Add constraint for visibility values
ALTER TABLE forms 
ADD CONSTRAINT chk_form_visibility 
CHECK (visibility IN ('private', 'shared', 'public', 'organization'));

-- Add index for visibility queries
CREATE INDEX idx_forms_visibility ON forms(visibility);
CREATE INDEX idx_forms_owner_visibility ON forms(owner_id, visibility);
CREATE INDEX idx_forms_visibility_created ON forms(visibility, created_at DESC);

-- Add comment
COMMENT ON COLUMN forms.visibility IS 'Form visibility: private (owner only), shared (specific users), public (anyone), organization (org members)';

-- =====================================================
-- STEP 3: Create form_access_logs audit table
-- =====================================================
CREATE TABLE IF NOT EXISTS form_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL,
    user_id INTEGER,
    session_id VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_access_logs_form 
        FOREIGN KEY (form_id) 
        REFERENCES forms(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_access_logs_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL,
    
    CONSTRAINT chk_action_type 
        CHECK (action IN (
            'view', 'submit', 'edit', 'delete', 'share', 
            'unshare', 'clone', 'export', 'publish', 'unpublish',
            'permission_change', 'access_denied'
        ))
);

-- Add indexes for efficient querying
CREATE INDEX idx_access_logs_form ON form_access_logs(form_id);
CREATE INDEX idx_access_logs_user ON form_access_logs(user_id);
CREATE INDEX idx_access_logs_action ON form_access_logs(action);
CREATE INDEX idx_access_logs_created ON form_access_logs(created_at DESC);
CREATE INDEX idx_access_logs_form_user_action ON form_access_logs(form_id, user_id, action);

-- Add comment
COMMENT ON TABLE form_access_logs IS 'Audit log for all form access and actions for security and analytics';

-- =====================================================
-- STEP 4: Create form_clones tracking table
-- =====================================================
CREATE TABLE IF NOT EXISTS form_clones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_form_id UUID NOT NULL,
    cloned_form_id UUID NOT NULL,
    cloned_by_user_id INTEGER NOT NULL,
    cloned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_clones_original 
        FOREIGN KEY (original_form_id) 
        REFERENCES forms(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_clones_cloned 
        FOREIGN KEY (cloned_form_id) 
        REFERENCES forms(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_clones_user 
        FOREIGN KEY (cloned_by_user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Add indexes
CREATE INDEX idx_form_clones_original ON form_clones(original_form_id);
CREATE INDEX idx_form_clones_cloned ON form_clones(cloned_form_id);
CREATE INDEX idx_form_clones_user ON form_clones(cloned_by_user_id);

-- =====================================================
-- STEP 5: Add public form statistics view
-- =====================================================
CREATE OR REPLACE VIEW form_statistics_public AS
SELECT 
    f.id as form_id,
    f.title,
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
GROUP BY f.id, f.title, f.visibility;

-- Add comment
COMMENT ON VIEW form_statistics_public IS 'Public statistics for forms available without authentication';

-- =====================================================
-- STEP 6: Add helper functions
-- =====================================================

-- Function to check user permission for a form
CREATE OR REPLACE FUNCTION check_form_permission(
    p_form_id UUID,
    p_user_id INTEGER
) RETURNS TABLE(
    can_view BOOLEAN,
    can_submit BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN,
    permission_source VARCHAR(20)
) AS $$
DECLARE
    v_owner_id INTEGER;
    v_visibility VARCHAR(20);
    v_share_permission VARCHAR(20);
BEGIN
    -- Get form details
    SELECT owner_id, visibility 
    INTO v_owner_id, v_visibility
    FROM forms 
    WHERE id = p_form_id AND deleted_at IS NULL;
    
    -- Check if user is owner
    IF v_owner_id = p_user_id THEN
        RETURN QUERY SELECT true, true, true, true, 'owner'::VARCHAR(20);
        RETURN;
    END IF;
    
    -- Check if form is public
    IF v_visibility = 'public' THEN
        RETURN QUERY SELECT true, true, false, false, 'public'::VARCHAR(20);
        RETURN;
    END IF;
    
    -- Check if form is shared with user
    SELECT permission_level 
    INTO v_share_permission
    FROM form_shares 
    WHERE form_id = p_form_id 
        AND shared_with_user_id = p_user_id
        AND (expires_at IS NULL OR expires_at > NOW());
    
    IF v_share_permission IS NOT NULL THEN
        RETURN QUERY SELECT 
            true,
            v_share_permission IN ('submit', 'edit', 'admin'),
            v_share_permission IN ('edit', 'admin'),
            v_share_permission = 'admin',
            'shared'::VARCHAR(20);
        RETURN;
    END IF;
    
    -- No permission
    RETURN QUERY SELECT false, false, false, false, 'none'::VARCHAR(20);
END;
$$ LANGUAGE plpgsql;

-- Function to get all accessible forms for a user
CREATE OR REPLACE FUNCTION get_accessible_forms(
    p_user_id INTEGER,
    p_include_public BOOLEAN DEFAULT true
) RETURNS TABLE(
    form_id UUID,
    title VARCHAR(255),
    owner_id INTEGER,
    visibility VARCHAR(20),
    permission_level VARCHAR(20),
    access_type VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    -- User's own forms
    SELECT 
        f.id,
        f.title,
        f.owner_id,
        f.visibility,
        'owner'::VARCHAR(20) as permission_level,
        'owned'::VARCHAR(20) as access_type
    FROM forms f
    WHERE f.owner_id = p_user_id
        AND f.deleted_at IS NULL
    
    UNION
    
    -- Shared forms
    SELECT 
        f.id,
        f.title,
        f.owner_id,
        f.visibility,
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
        f.title,
        f.owner_id,
        f.visibility,
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

-- =====================================================
-- STEP 7: Add triggers for audit logging
-- =====================================================

-- Trigger function for automatic audit logging
CREATE OR REPLACE FUNCTION log_form_access() RETURNS TRIGGER AS $$
BEGIN
    -- Log to form_access_logs automatically
    -- This is a placeholder - actual implementation depends on app logic
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 8: Insert initial data for testing
-- =====================================================

-- Create some test shares (optional, remove in production)
/*
INSERT INTO form_shares (form_id, shared_with_user_id, shared_by_user_id, permission_level)
SELECT 
    f.id,
    2, -- Share with user ID 2
    f.owner_id,
    'view'
FROM forms f
WHERE f.deleted_at IS NULL
LIMIT 1;
*/

-- =====================================================
-- MIGRATION METADATA
-- =====================================================
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
) ON CONFLICT DO NOTHING;