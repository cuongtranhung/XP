-- Migration: 007_create_user_roles.sql
-- Purpose: Create junction table for user-role assignments
-- Created: December 2024

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- Changed to INTEGER
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id),  -- Changed to INTEGER
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- For temporary role assignments
    PRIMARY KEY (user_id, role_id)
);

-- Create indexes
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_expires ON user_roles(expires_at);

-- Assign default role to existing users
DO $$
DECLARE
    user_role_id UUID;
BEGIN
    SELECT id INTO user_role_id FROM roles WHERE name = 'user';
    
    -- Give all existing users the basic 'user' role
    INSERT INTO user_roles (user_id, role_id)
    SELECT id, user_role_id FROM users
    WHERE deleted_at IS NULL
    ON CONFLICT DO NOTHING;
END $$;