-- Migration: 012_optimize_group_management_indexes.sql
-- Purpose: Optimize database performance for group management features
-- Created: January 2025
-- Related to: User Group Modal implementation enhancements

-- Create view for group summary with member counts
CREATE OR REPLACE VIEW user_groups_summary AS
SELECT 
    g.*,
    COALESCE(member_counts.member_count, 0) as member_count,
    COALESCE(member_counts.active_member_count, 0) as active_member_count
FROM user_groups g
LEFT JOIN (
    SELECT 
        ugm.group_id,
        COUNT(*) as member_count,
        COUNT(CASE WHEN u.is_blocked = false AND u.deleted_at IS NULL THEN 1 END) as active_member_count
    FROM user_group_members ugm
    LEFT JOIN users u ON ugm.user_id = u.id
    GROUP BY ugm.group_id
) member_counts ON g.id = member_counts.group_id;

-- Add composite indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_groups_type_active ON user_groups(group_type, is_active);
CREATE INDEX IF NOT EXISTS idx_user_groups_active_name ON user_groups(is_active, name) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_groups_parent_active ON user_groups(parent_group_id, is_active) WHERE parent_group_id IS NOT NULL;

-- Optimize user_group_members table
CREATE INDEX IF NOT EXISTS idx_group_members_composite ON user_group_members(group_id, user_id, role_in_group);
CREATE INDEX IF NOT EXISTS idx_group_members_role_joined ON user_group_members(role_in_group, joined_at);
CREATE INDEX IF NOT EXISTS idx_group_members_added_by ON user_group_members(added_by) WHERE added_by IS NOT NULL;

-- Add indexes for user table to support group member searches
CREATE INDEX IF NOT EXISTS idx_users_active_search ON users(is_blocked, deleted_at, full_name, email) 
    WHERE is_blocked = false AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_department_active ON users(department, is_blocked, deleted_at) 
    WHERE is_blocked = false AND deleted_at IS NULL;

-- Add partial indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_groups_custom_active ON user_groups(name, display_name) 
    WHERE group_type = 'custom' AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_groups_system_active ON user_groups(name, display_name) 
    WHERE group_type = 'system' AND is_active = true;

-- Create function for efficient member count updates
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
    -- This function can be used for real-time member count updates
    -- Currently using view for simplicity, but can be enhanced with triggers
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add metadata column for storing additional group properties if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_groups' AND column_name = 'metadata') THEN
        ALTER TABLE user_groups ADD COLUMN metadata JSONB DEFAULT '{}';
        CREATE INDEX idx_user_groups_metadata ON user_groups USING GIN(metadata);
    END IF;
END $$;

-- Create indexes for audit performance (if audit table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        -- Indexes for group-related audit queries
        CREATE INDEX IF NOT EXISTS idx_audit_logs_group_entity ON audit_logs(entity_type, entity_id, created_at) 
            WHERE entity_type = 'group';
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_group_actions ON audit_logs(action, entity_type, created_at) 
            WHERE action LIKE '%GROUP%';
    END IF;
END $$;

-- Add constraints to ensure data integrity
DO $$
BEGIN
    -- Ensure role_in_group has valid values
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'chk_role_in_group_valid') THEN
        ALTER TABLE user_group_members 
        ADD CONSTRAINT chk_role_in_group_valid 
        CHECK (role_in_group IN ('member', 'manager', 'owner'));
    END IF;

    -- Ensure group_type has valid values
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                   WHERE constraint_name = 'chk_group_type_valid') THEN
        ALTER TABLE user_groups 
        ADD CONSTRAINT chk_group_type_valid 
        CHECK (group_type IN ('system', 'department', 'project', 'custom'));
    END IF;
END $$;

-- Update statistics for query planner optimization
ANALYZE user_groups;
ANALYZE user_group_members;
ANALYZE users;

-- Comments for documentation
COMMENT ON VIEW user_groups_summary IS 'Optimized view for group management with member counts';
COMMENT ON INDEX idx_user_groups_type_active IS 'Composite index for filtering by type and active status';
COMMENT ON INDEX idx_group_members_composite IS 'Composite index for efficient member lookups';
COMMENT ON INDEX idx_users_active_search IS 'Index for searching available users for group assignment';