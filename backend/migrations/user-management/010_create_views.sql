-- Migration: 010_create_views.sql
-- Purpose: Create database views for simplified queries (Simplified)
-- Created: December 2024

-- View for user permissions (combines roles and permissions)
CREATE OR REPLACE VIEW user_permissions_view AS
SELECT DISTINCT
    u.id as user_id,
    u.email,
    u.username,
    p.resource,
    p.action,
    p.scope,
    r.name as role_name,
    r.priority as role_priority
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE u.deleted_at IS NULL
    AND u.status = 'active'
    AND u.is_approved = true
    AND u.is_blocked = false
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND r.is_active = true;

-- View for user groups with member count
CREATE OR REPLACE VIEW user_groups_summary AS
SELECT 
    ug.id,
    ug.name,
    ug.display_name,
    ug.description,
    ug.group_type,
    ug.parent_group_id,
    COUNT(DISTINCT ugm.user_id) as member_count,
    ug.is_active,
    ug.created_at
FROM user_groups ug
LEFT JOIN user_group_members ugm ON ug.id = ugm.group_id
GROUP BY ug.id;

-- View for user details with roles and groups
CREATE OR REPLACE VIEW user_details_view AS
SELECT 
    u.id,
    u.email,
    u.username,
    u.full_name,
    u.phone_number,
    u.department,
    u.position,
    u.status,
    u.is_approved,
    u.is_blocked,
    u.created_at,
    u.updated_at,
    u.last_login,
    u.last_activity,
    COALESCE(
        json_agg(DISTINCT 
            jsonb_build_object(
                'id', r.id,
                'name', r.name,
                'display_name', r.display_name,
                'priority', r.priority
            )
        ) FILTER (WHERE r.id IS NOT NULL), 
        '[]'::json
    ) as roles,
    COALESCE(
        json_agg(DISTINCT 
            jsonb_build_object(
                'id', ug.id,
                'name', ug.name,
                'display_name', ug.display_name,
                'role_in_group', ugm.role_in_group
            )
        ) FILTER (WHERE ug.id IS NOT NULL), 
        '[]'::json
    ) as groups
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
LEFT JOIN user_group_members ugm ON u.id = ugm.user_id
LEFT JOIN user_groups ug ON ugm.group_id = ug.id
WHERE u.deleted_at IS NULL
GROUP BY u.id;

-- View for user statistics by department
CREATE OR REPLACE VIEW department_statistics AS
SELECT 
    department,
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE status = 'active') as active_users,
    COUNT(*) FILTER (WHERE is_blocked = true) as blocked_users,
    COUNT(*) FILTER (WHERE is_approved = false) as unapproved_users
FROM users
WHERE deleted_at IS NULL AND department IS NOT NULL
GROUP BY department;

-- View for role statistics
CREATE OR REPLACE VIEW role_statistics AS
SELECT 
    r.id,
    r.name,
    r.display_name,
    COUNT(DISTINCT ur.user_id) as user_count,
    r.is_active
FROM roles r
LEFT JOIN user_roles ur ON r.id = ur.role_id
GROUP BY r.id;