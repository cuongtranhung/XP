-- Migration: 004_create_role_permissions.sql
-- Purpose: Create junction table for role-permission relationships
-- Created: December 2024

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    granted_by INTEGER REFERENCES users(id),  -- Changed to INTEGER
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

-- Create indexes
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- Grant permissions to default roles
DO $$
DECLARE
    super_admin_id UUID;
    admin_id UUID;
    manager_id UUID;
    user_id UUID;
BEGIN
    -- Get role IDs
    SELECT id INTO super_admin_id FROM roles WHERE name = 'super_admin';
    SELECT id INTO admin_id FROM roles WHERE name = 'admin';
    SELECT id INTO manager_id FROM roles WHERE name = 'manager';
    SELECT id INTO user_id FROM roles WHERE name = 'user';
    
    -- Super Admin gets ALL permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT super_admin_id, id FROM permissions
    ON CONFLICT DO NOTHING;
    
    -- Admin gets most permissions (exclude super admin only)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT admin_id, id FROM permissions
    WHERE NOT (resource = 'roles' AND action = 'delete')
    ON CONFLICT DO NOTHING;
    
    -- Manager gets department-level permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT manager_id, id FROM permissions
    WHERE scope IN ('own', 'department')
        OR (resource = 'users' AND action IN ('read', 'approve'))
        OR (resource = 'groups' AND action IN ('read', 'create'))
        OR (resource = 'roles' AND action = 'read')
    ON CONFLICT DO NOTHING;
    
    -- User gets basic permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT user_id, id FROM permissions
    WHERE scope = 'own'
        AND resource IN ('users', 'groups', 'audit_logs', 'forms')
        AND action IN ('read', 'update')
    ON CONFLICT DO NOTHING;
END $$;