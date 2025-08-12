-- Migration: 011_update_user_details_view.sql
-- Purpose: Update user_details_view to include role expiration information
-- Created: January 2025

-- Update user_details_view to include role assignment information
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
                'role_id', r.id,
                'name', r.name,
                'display_name', r.display_name,
                'description', r.description,
                'priority', r.priority,
                'is_system', r.is_system,
                'is_active', r.is_active,
                'assigned_at', ur.assigned_at,
                'expires_at', ur.expires_at
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
LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
LEFT JOIN user_group_members ugm ON u.id = ugm.user_id
LEFT JOIN user_groups ug ON ugm.group_id = ug.id
WHERE u.deleted_at IS NULL
GROUP BY u.id;