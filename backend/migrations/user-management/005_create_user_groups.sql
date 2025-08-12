-- Migration: 005_create_user_groups.sql
-- Purpose: Create user groups table for organizational structure
-- Created: December 2024

CREATE TABLE IF NOT EXISTS user_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_group_id UUID REFERENCES user_groups(id),
    group_type VARCHAR(20) DEFAULT 'custom', -- department, team, custom
    max_members INTEGER,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    
    -- Metadata (changed to work with INTEGER user IDs)
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_groups_name ON user_groups(name);
CREATE INDEX idx_groups_parent ON user_groups(parent_group_id);
CREATE INDEX idx_groups_type ON user_groups(group_type);
CREATE INDEX idx_groups_is_active ON user_groups(is_active);

-- Insert default groups
INSERT INTO user_groups (name, display_name, description, group_type) VALUES
    ('all_users', 'All Users', 'Default group containing all users', 'system'),
    ('administrators', 'Administrators', 'System administrators group', 'system'),
    ('managers', 'Managers', 'Department managers group', 'system')
ON CONFLICT (name) DO NOTHING;