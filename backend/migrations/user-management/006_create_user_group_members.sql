-- Migration: 006_create_user_group_members.sql
-- Purpose: Create junction table for user-group relationships
-- Created: December 2024

CREATE TABLE IF NOT EXISTS user_group_members (
    group_id UUID REFERENCES user_groups(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- Changed to INTEGER
    role_in_group VARCHAR(50) DEFAULT 'member', -- owner, admin, member
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by INTEGER REFERENCES users(id),  -- Changed to INTEGER
    PRIMARY KEY (group_id, user_id)
);

-- Create indexes
CREATE INDEX idx_group_members_user ON user_group_members(user_id);
CREATE INDEX idx_group_members_group ON user_group_members(group_id);
CREATE INDEX idx_group_members_role ON user_group_members(role_in_group);