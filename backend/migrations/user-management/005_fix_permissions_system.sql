-- =====================================================
-- FIX PERMISSIONS SYSTEM FOR INTEGER USER IDS
-- =====================================================
-- Description: Fix permissions tables to work with integer user IDs
-- Author: XP Development Team  
-- Date: 2025-01-11
-- =====================================================

-- Drop existing problematic constraints if exists
DROP TABLE IF EXISTS user_permissions CASCADE;

-- Create user_permissions table with correct types
CREATE TABLE user_permissions (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT true,
  granted_by INTEGER REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  reason TEXT,
  PRIMARY KEY (user_id, permission_id)
);

-- Add expires_at to role_permissions if not exists
ALTER TABLE role_permissions 
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_expires ON user_permissions(expires_at);
CREATE INDEX IF NOT EXISTS idx_role_permissions_expires ON role_permissions(expires_at);

-- =====================================================
-- RECREATE VIEWS WITH CORRECT TYPES
-- =====================================================

DROP VIEW IF EXISTS user_effective_permissions CASCADE;
DROP VIEW IF EXISTS role_permission_summary CASCADE;

-- View to get all permissions for a user
CREATE VIEW user_effective_permissions AS
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
-- Get direct user permissions
LEFT JOIN user_permissions up ON u.id = up.user_id AND p.id = up.permission_id
WHERE p.id IS NOT NULL 
  AND COALESCE(p.is_active, true) = true
  AND (rp.expires_at IS NULL OR rp.expires_at > CURRENT_TIMESTAMP)
  AND (up.expires_at IS NULL OR up.expires_at > CURRENT_TIMESTAMP);

-- View to get permission summary by role
CREATE VIEW role_permission_summary AS
SELECT 
  r.id as role_id,
  r.name as role_name,
  r.display_name as role_display_name,
  r.priority as role_priority,
  pg.name as permission_group,
  pg.display_name as group_display_name,
  pg.sort_order as group_sort_order,
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
LEFT JOIN permissions p ON rp.permission_id = p.id AND COALESCE(p.is_active, true) = true
LEFT JOIN permission_groups pg ON p.group_id = pg.id
WHERE r.is_active = true
GROUP BY r.id, r.name, r.display_name, r.priority, pg.name, pg.display_name, pg.sort_order
ORDER BY r.priority DESC, pg.sort_order;

-- =====================================================
-- RECREATE FUNCTIONS WITH CORRECT TYPES
-- =====================================================

DROP FUNCTION IF EXISTS user_has_permission CASCADE;
DROP FUNCTION IF EXISTS get_user_permissions CASCADE;

-- Function to check if user has permission
CREATE FUNCTION user_has_permission(
  p_user_id INTEGER,
  p_resource VARCHAR(100),
  p_action VARCHAR(50),
  p_scope VARCHAR(20) DEFAULT 'all'
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM user_effective_permissions
    WHERE user_id = p_user_id
      AND resource = p_resource
      AND action = p_action
      AND (scope = p_scope OR scope = 'all')
      AND granted = true
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  ) INTO v_has_permission;
  
  RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql;

-- Function to get user permissions
CREATE FUNCTION get_user_permissions(
  p_user_id INTEGER
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
-- ADD MORE PERMISSIONS FOR COMPREHENSIVE SYSTEM
-- =====================================================

-- Add new permissions for upload module
INSERT INTO permissions (resource, action, scope, description, display_name) VALUES
  ('uploads', 'create', 'all', 'Upload files', 'Upload Files'),
  ('uploads', 'read', 'own', 'View own uploads', 'View Own Uploads'),
  ('uploads', 'read', 'all', 'View all uploads', 'View All Uploads'),
  ('uploads', 'delete', 'own', 'Delete own uploads', 'Delete Own Uploads'),
  ('uploads', 'delete', 'all', 'Delete any upload', 'Delete Any Upload')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- Add new permissions for comments
INSERT INTO permissions (resource, action, scope, description, display_name) VALUES
  ('comments', 'create', 'all', 'Create comments', 'Create Comments'),
  ('comments', 'read', 'all', 'Read all comments', 'Read All Comments'),
  ('comments', 'update', 'own', 'Update own comments', 'Update Own Comments'),
  ('comments', 'update', 'all', 'Update any comment', 'Update Any Comment'),
  ('comments', 'delete', 'own', 'Delete own comments', 'Delete Own Comments'),
  ('comments', 'delete', 'all', 'Delete any comment', 'Delete Any Comment')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- Add new permissions for settings
INSERT INTO permissions (resource, action, scope, description, display_name) VALUES
  ('settings', 'read', 'all', 'View system settings', 'View System Settings'),
  ('settings', 'update', 'all', 'Update system settings', 'Update System Settings'),
  ('settings', 'backup', 'all', 'Backup system', 'Backup System'),
  ('settings', 'restore', 'all', 'Restore system', 'Restore System')
ON CONFLICT (resource, action, scope) DO NOTHING;

-- Assign new permissions to appropriate groups
UPDATE permissions SET group_id = (SELECT id FROM permission_groups WHERE name = 'settings')
WHERE resource = 'settings' AND group_id IS NULL;

UPDATE permissions SET group_id = (SELECT id FROM permission_groups WHERE name = 'form_builder')
WHERE resource IN ('uploads', 'comments') AND group_id IS NULL;

-- =====================================================
-- ASSIGN NEW PERMISSIONS TO ROLES
-- =====================================================

-- Super Admin gets all new permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.resource IN ('uploads', 'comments', 'settings')
ON CONFLICT DO NOTHING;

-- Admin gets most new permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.resource IN ('uploads', 'comments')
  AND NOT (p.resource = 'settings' AND p.action IN ('backup', 'restore'))
ON CONFLICT DO NOTHING;

-- Manager gets moderate new permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager'
  AND (
    (p.resource = 'uploads' AND p.action IN ('create', 'read')) OR
    (p.resource = 'comments' AND p.action IN ('create', 'read', 'update'))
  )
ON CONFLICT DO NOTHING;

-- User gets basic new permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'user'
  AND (
    (p.resource = 'uploads' AND p.action IN ('create', 'read', 'delete') AND p.scope = 'own') OR
    (p.resource = 'comments' AND p.action IN ('create', 'read', 'update', 'delete') AND p.scope = 'own')
  )
ON CONFLICT DO NOTHING;

-- =====================================================
-- UTILITY FUNCTION TO GET ROLE PERMISSIONS
-- =====================================================

CREATE OR REPLACE FUNCTION get_role_permissions(
  p_role_id UUID
) RETURNS TABLE (
  permission_id UUID,
  permission_name TEXT,
  resource VARCHAR(100),
  action VARCHAR(50),
  scope VARCHAR(20),
  display_name VARCHAR(255),
  permission_group VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as permission_id,
    CONCAT(p.resource, '.', p.action, CASE WHEN p.scope != 'all' THEN CONCAT('.', p.scope) ELSE '' END) as permission_name,
    p.resource,
    p.action,
    p.scope,
    p.display_name,
    pg.name as permission_group
  FROM role_permissions rp
  JOIN permissions p ON rp.permission_id = p.id
  LEFT JOIN permission_groups pg ON p.group_id = pg.id
  WHERE rp.role_id = p_role_id
    AND COALESCE(p.is_active, true) = true
    AND (rp.expires_at IS NULL OR rp.expires_at > CURRENT_TIMESTAMP)
  ORDER BY pg.sort_order, p.resource, p.action;
END;
$$ LANGUAGE plpgsql;