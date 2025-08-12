-- Migration: 011_row_level_security.sql
-- Purpose: Enable Row Level Security policies (Simplified)
-- Created: December 2024

-- Create auth schema if not exists
CREATE SCHEMA IF NOT EXISTS auth;

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- Removed approval_workflows as we're using simple boolean approval

-- Create function to get current user id (from JWT) - returns INTEGER
CREATE OR REPLACE FUNCTION auth.uid() RETURNS INTEGER AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true)::INTEGER;
EXCEPTION
    WHEN others THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check user permission
CREATE OR REPLACE FUNCTION auth.has_permission(
    p_resource VARCHAR,
    p_action VARCHAR,
    p_scope VARCHAR DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_permissions_view
        WHERE user_id = auth.uid()
        AND resource = p_resource
        AND action = p_action
        AND (p_scope IS NULL OR scope = p_scope OR scope = 'all')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy for users table
CREATE POLICY users_select_policy ON users
    FOR SELECT
    USING (
        -- Can always read own data
        id = auth.uid()
        OR
        -- Can read if has permission
        auth.has_permission('users', 'read', 'all')
        OR
        -- Can read department members if has department permission
        (auth.has_permission('users', 'read', 'department') 
         AND department = (SELECT department FROM users WHERE id = auth.uid()))
    );

CREATE POLICY users_update_policy ON users
    FOR UPDATE
    USING (
        -- Can update own profile
        id = auth.uid()
        OR
        -- Can update if has permission
        auth.has_permission('users', 'update', 'all')
        OR
        -- Can update department members if has department permission
        (auth.has_permission('users', 'update', 'department') 
         AND department = (SELECT department FROM users WHERE id = auth.uid()))
    );

CREATE POLICY users_insert_policy ON users
    FOR INSERT
    WITH CHECK (
        auth.has_permission('users', 'create', 'all')
    );

CREATE POLICY users_delete_policy ON users
    FOR DELETE
    USING (
        auth.has_permission('users', 'delete', 'all')
    );

-- Policy for audit_logs table
CREATE POLICY audit_logs_select_policy ON audit_logs
    FOR SELECT
    USING (
        -- Can read own audit logs
        user_id = auth.uid()
        OR
        -- Can read all if has permission
        auth.has_permission('audit_logs', 'read', 'all')
        OR
        -- Can read department logs if has permission
        (auth.has_permission('audit_logs', 'read', 'department')
         AND user_id IN (
             SELECT id FROM users 
             WHERE department = (SELECT department FROM users WHERE id = auth.uid())
         ))
    );

CREATE POLICY audit_logs_insert_policy ON audit_logs
    FOR INSERT
    WITH CHECK (true); -- System can always insert audit logs

-- Grant necessary permissions to application role
-- Note: Create 'authenticated' role if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
END $$;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;