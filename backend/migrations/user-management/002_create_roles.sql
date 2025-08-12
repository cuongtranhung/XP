-- Migration: 002_create_roles.sql
-- Purpose: Create roles table for RBAC
-- Created: December 2024
-- Modified: To work with INTEGER user IDs

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    role_type VARCHAR(20) DEFAULT 'custom', -- system, custom
    priority INTEGER DEFAULT 0, -- Higher number = higher priority
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata (changed to work with INTEGER user IDs)
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_priority ON roles(priority);
CREATE INDEX IF NOT EXISTS idx_roles_is_active ON roles(is_active);

-- Insert default system roles
INSERT INTO roles (name, display_name, description, role_type, priority, is_system) VALUES
    ('super_admin', 'Super Administrator', 'Full system access with all permissions', 'system', 1000, true),
    ('admin', 'Administrator', 'Administrative access with most permissions', 'system', 900, true),
    ('manager', 'Manager', 'Department manager with team permissions', 'system', 500, true),
    ('user', 'User', 'Basic user with limited permissions', 'system', 100, true)
ON CONFLICT (name) DO NOTHING;