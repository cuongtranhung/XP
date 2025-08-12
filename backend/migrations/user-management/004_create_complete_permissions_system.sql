-- =====================================================
-- COMPLETE PERMISSIONS SYSTEM SCHEMA
-- =====================================================
-- Description: Complete permissions tables for RBAC system
-- Author: XP Development Team  
-- Date: 2025-01-11
-- Version: 2.0
-- =====================================================

-- 1. Create permission_groups table (for organizing permissions)
CREATE TABLE IF NOT EXISTS permission_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  PRIMARY KEY (role_id, permission_id)
);

-- 3. Create user_permissions table (for direct user permissions)
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT true, -- true = grant, false = revoke
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  reason TEXT,
  PRIMARY KEY (user_id, permission_id)
);

-- 4. Add missing columns to permissions table if not exists
ALTER TABLE permissions 
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES permission_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update display_name for existing permissions
UPDATE permissions SET display_name = 
  CASE 
    WHEN resource = 'users' AND action = 'create' THEN 'Create Users'
    WHEN resource = 'users' AND action = 'read' AND scope = 'own' THEN 'View Own Profile'
    WHEN resource = 'users' AND action = 'read' AND scope = 'all' THEN 'View All Users'
    WHEN resource = 'users' AND action = 'update' AND scope = 'own' THEN 'Update Own Profile'
    WHEN resource = 'users' AND action = 'update' AND scope = 'all' THEN 'Update All Users'
    WHEN resource = 'users' AND action = 'delete' THEN 'Delete Users'
    WHEN resource = 'users' AND action = 'approve' THEN 'Approve Users'
    WHEN resource = 'users' AND action = 'block' THEN 'Block Users'
    WHEN resource = 'roles' AND action = 'create' THEN 'Create Roles'
    WHEN resource = 'roles' AND action = 'read' THEN 'View Roles'
    WHEN resource = 'roles' AND action = 'update' THEN 'Update Roles'
    WHEN resource = 'roles' AND action = 'delete' THEN 'Delete Roles'
    WHEN resource = 'roles' AND action = 'assign' THEN 'Assign Roles'
    WHEN resource = 'forms' AND action = 'create' THEN 'Create Forms'
    WHEN resource = 'forms' AND action = 'read' AND scope = 'own' THEN 'View Own Forms'
    WHEN resource = 'forms' AND action = 'read' AND scope = 'all' THEN 'View All Forms'
    WHEN resource = 'forms' AND action = 'update' AND scope = 'own' THEN 'Update Own Forms'
    WHEN resource = 'forms' AND action = 'update' AND scope = 'all' THEN 'Update All Forms'
    WHEN resource = 'forms' AND action = 'delete' AND scope = 'own' THEN 'Delete Own Forms'
    WHEN resource = 'forms' AND action = 'delete' AND scope = 'all' THEN 'Delete All Forms'
    ELSE CONCAT(INITCAP(resource), ' - ', INITCAP(action), ' (', scope, ')')
  END
WHERE display_name IS NULL;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Role permissions indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_expires ON role_permissions(expires_at);

-- User permissions indexes
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_expires ON user_permissions(expires_at);

-- Permission groups indexes
CREATE INDEX IF NOT EXISTS idx_permissions_group ON permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_permissions_is_active ON permissions(is_active);

-- =====================================================
-- DEFAULT PERMISSION GROUPS
-- =====================================================

INSERT INTO permission_groups (name, display_name, description, icon, sort_order) VALUES
  ('user_management', 'User Management', 'Manage users and their access', '👤', 1),
  ('role_management', 'Role Management', 'Manage roles and permissions', '🛡️', 2),
  ('form_builder', 'Form Builder', 'Create and manage forms', '📄', 3),
  ('submissions', 'Form Submissions', 'View and manage form submissions', '📥', 4),
  ('reports', 'Reports & Analytics', 'Access reports and analytics', '📊', 5),
  ('settings', 'System Settings', 'Configure system settings', '⚙️', 6),
  ('audit', 'Audit & Logs', 'View audit logs and system activity', '📋', 7)
ON CONFLICT (name) DO NOTHING;

-- Assign existing permissions to groups
UPDATE permissions SET group_id = (SELECT id FROM permission_groups WHERE name = 'user_management')
WHERE resource = 'users' AND group_id IS NULL;

UPDATE permissions SET group_id = (SELECT id FROM permission_groups WHERE name = 'role_management')
WHERE resource = 'roles' AND group_id IS NULL;

UPDATE permissions SET group_id = (SELECT id FROM permission_groups WHERE name = 'form_builder')
WHERE resource = 'forms' AND group_id IS NULL;

UPDATE permissions SET group_id = (SELECT id FROM permission_groups WHERE name = 'audit')
WHERE resource = 'audit_logs' AND group_id IS NULL;

-- =====================================================
-- DEFAULT ROLE PERMISSIONS ASSIGNMENT
-- =====================================================

-- Super Admin gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Admin gets most permissions (except system critical operations)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin' 
  AND NOT (p.resource = 'audit_logs' AND p.action = 'export')
ON CONFLICT DO NOTHING;

-- Manager gets moderate permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager'
  AND (
    (p.resource = 'users' AND p.action IN ('read', 'create', 'update', 'approve')) OR
    (p.resource = 'roles' AND p.action IN ('read', 'assign')) OR
    (p.resource = 'forms' AND p.action IN ('create', 'read', 'update')) OR
    (p.resource = 'groups' AND p.action IN ('read', 'create', 'update', 'manage_members'))
  )
ON CONFLICT DO NOTHING;

-- User gets basic permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'user'
  AND (
    (p.resource = 'users' AND p.action IN ('read') AND p.scope = 'own') OR
    (p.resource = 'users' AND p.action IN ('update') AND p.scope = 'own') OR
    (p.resource = 'forms' AND p.action IN ('create', 'read', 'update', 'delete') AND p.scope = 'own') OR
    (p.resource = 'groups' AND p.action = 'read' AND p.scope = 'own')
  )
ON CONFLICT DO NOTHING;

-- =====================================================
-- VIEWS FOR EASIER PERMISSION CHECKING
-- =====================================================

-- View to get all permissions for a user (including role permissions and direct permissions)
CREATE OR REPLACE VIEW user_effective_permissions AS
SELECT DISTINCT
  u.id as user_id,
  u.email,
  p.id as permission_id,
  CONCAT(p.resource, '.', p.action, CASE WHEN p.scope != 'all' THEN CONCAT('.', p.scope) ELSE '' END) as permission_name,
  p.resource,
  p.action,
  p.scope,
  p.display_name,
  pg.name as permission_group,
  CASE 
    WHEN up.granted IS NOT NULL THEN up.granted
    ELSE true
  END as granted,
  COALESCE(up.expires_at, rp.expires_at) as expires_at
FROM users u
-- Get permissions from roles
LEFT JOIN user_roles ur ON u.id = ur.user_id AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
LEFT JOIN role_permissions rp ON ur.role_id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
LEFT JOIN permission_groups pg ON p.group_id = pg.id
-- Get direct user permissions (these override role permissions)
LEFT JOIN user_permissions up ON u.id = up.user_id AND p.id = up.permission_id
WHERE p.is_active = true
  AND (rp.expires_at IS NULL OR rp.expires_at > CURRENT_TIMESTAMP)
  AND (up.expires_at IS NULL OR up.expires_at > CURRENT_TIMESTAMP);

-- View to get permission summary by role
CREATE OR REPLACE VIEW role_permission_summary AS
SELECT 
  r.id as role_id,
  r.name as role_name,
  r.display_name as role_display_name,
  r.priority as role_priority,
  pg.name as permission_group,
  pg.display_name as group_display_name,
  COUNT(p.id) as permission_count,
  ARRAY_AGG(
    jsonb_build_object(
      'id', p.id,
      'resource', p.resource,
      'action', p.action,
      'scope', p.scope,
      'display_name', p.display_name
    ) ORDER BY p.resource, p.action
  ) as permissions
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
LEFT JOIN permission_groups pg ON p.group_id = pg.id
WHERE r.is_active = true
GROUP BY r.id, r.name, r.display_name, r.priority, pg.name, pg.display_name
ORDER BY r.priority DESC, pg.sort_order;

-- =====================================================
-- FUNCTIONS FOR PERMISSION CHECKING
-- =====================================================

-- Function to check if user has a specific permission
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_resource VARCHAR(100),
  p_action VARCHAR(50),
  p_scope VARCHAR(20) DEFAULT 'all'
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  -- Check for exact permission match
  SELECT EXISTS (
    SELECT 1
    FROM user_effective_permissions
    WHERE user_id = p_user_id
      AND resource = p_resource
      AND action = p_action
      AND (scope = p_scope OR scope = 'all') -- 'all' scope includes all other scopes
      AND granted = true
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql;

-- Function to get all permissions for a user
CREATE OR REPLACE FUNCTION get_user_permissions(
  p_user_id UUID
) RETURNS TABLE (
  permission_id UUID,
  permission_name TEXT,
  resource VARCHAR(100),
  action VARCHAR(50),
  scope VARCHAR(20),
  display_name VARCHAR(255),
  permission_group VARCHAR(100),
  granted BOOLEAN,
  expires_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uep.permission_id,
    uep.permission_name,
    uep.resource,
    uep.action,
    uep.scope,
    uep.display_name,
    uep.permission_group,
    uep.granted,
    uep.expires_at
  FROM user_effective_permissions uep
  WHERE uep.user_id = p_user_id
    AND uep.granted = true
    AND (uep.expires_at IS NULL OR uep.expires_at > CURRENT_TIMESTAMP)
  ORDER BY uep.permission_group, uep.resource, uep.action;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_permission_groups_updated_at
  BEFORE UPDATE ON permission_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE permission_groups IS 'Groups for organizing permissions into logical categories';
COMMENT ON TABLE role_permissions IS 'Junction table linking roles to permissions';
COMMENT ON TABLE user_permissions IS 'Direct user permission overrides (can grant or revoke)';
COMMENT ON VIEW user_effective_permissions IS 'Combined view of all user permissions from roles and direct assignments';
COMMENT ON VIEW role_permission_summary IS 'Summary of permissions grouped by role and permission group';
COMMENT ON FUNCTION user_has_permission IS 'Check if user has a specific permission';
COMMENT ON FUNCTION get_user_permissions IS 'Get all permissions for a user';