-- Migration: 003_create_permissions.sql
-- Purpose: Create permissions table for fine-grained access control
-- Created: December 2024

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    scope VARCHAR(20) DEFAULT 'own', -- own, department, all
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique combination
    UNIQUE(resource, action, scope)
);

-- Create indexes
CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_action ON permissions(action);
CREATE INDEX idx_permissions_scope ON permissions(scope);

-- Insert default permissions
INSERT INTO permissions (resource, action, scope, description) VALUES
    -- User permissions
    ('users', 'create', 'all', 'Create new users'),
    ('users', 'read', 'own', 'Read own user profile'),
    ('users', 'read', 'department', 'Read users in same department'),
    ('users', 'read', 'all', 'Read all users'),
    ('users', 'update', 'own', 'Update own profile'),
    ('users', 'update', 'department', 'Update users in same department'),
    ('users', 'update', 'all', 'Update any user'),
    ('users', 'delete', 'all', 'Delete users'),
    ('users', 'block', 'all', 'Block/unblock users'),
    ('users', 'approve', 'all', 'Approve user registrations'),
    
    -- Role permissions
    ('roles', 'create', 'all', 'Create new roles'),
    ('roles', 'read', 'all', 'View roles'),
    ('roles', 'update', 'all', 'Update roles'),
    ('roles', 'delete', 'all', 'Delete roles'),
    ('roles', 'assign', 'all', 'Assign roles to users'),
    
    -- Group permissions
    ('groups', 'create', 'all', 'Create new groups'),
    ('groups', 'read', 'own', 'View own groups'),
    ('groups', 'read', 'all', 'View all groups'),
    ('groups', 'update', 'own', 'Update own groups'),
    ('groups', 'update', 'all', 'Update any group'),
    ('groups', 'delete', 'all', 'Delete groups'),
    ('groups', 'manage_members', 'own', 'Manage members of own groups'),
    ('groups', 'manage_members', 'all', 'Manage members of any group'),
    
    -- Audit permissions
    ('audit_logs', 'read', 'own', 'View own audit logs'),
    ('audit_logs', 'read', 'department', 'View department audit logs'),
    ('audit_logs', 'read', 'all', 'View all audit logs'),
    ('audit_logs', 'export', 'all', 'Export audit logs'),
    
    -- Forms permissions (existing system)
    ('forms', 'create', 'all', 'Create forms'),
    ('forms', 'read', 'own', 'View own forms'),
    ('forms', 'read', 'all', 'View all forms'),
    ('forms', 'update', 'own', 'Update own forms'),
    ('forms', 'update', 'all', 'Update any form'),
    ('forms', 'delete', 'own', 'Delete own forms'),
    ('forms', 'delete', 'all', 'Delete any form')
ON CONFLICT (resource, action, scope) DO NOTHING;