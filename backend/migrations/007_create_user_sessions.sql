-- Migration: Create user sessions table
-- Description: Table to track user sessions for activity correlation
-- Author: System
-- Date: 2025-08-04

-- Create user_sessions table
CREATE TABLE user_sessions (
    id VARCHAR(128) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    browser_info JSONB,
    location_info JSONB,
    is_active BOOLEAN DEFAULT true,
    logout_reason VARCHAR(50), -- 'USER_LOGOUT', 'TIMEOUT', 'FORCED', 'TOKEN_EXPIRED'
    metadata JSONB
);

-- Create indexes for performance
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_user_id_active ON user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity DESC);
CREATE INDEX idx_user_sessions_created_at ON user_sessions(created_at DESC);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_user_sessions_ip_address ON user_sessions(ip_address);

-- Add comments for documentation
COMMENT ON TABLE user_sessions IS 'Tracks user sessions for activity correlation and security monitoring';
COMMENT ON COLUMN user_sessions.id IS 'Unique session identifier (UUID or JWT token ID)';
COMMENT ON COLUMN user_sessions.user_id IS 'Reference to users table';
COMMENT ON COLUMN user_sessions.created_at IS 'When the session was created';
COMMENT ON COLUMN user_sessions.last_activity IS 'Last time this session was used';
COMMENT ON COLUMN user_sessions.expires_at IS 'When this session expires (NULL for non-expiring)';
COMMENT ON COLUMN user_sessions.ip_address IS 'IP address when session was created';
COMMENT ON COLUMN user_sessions.user_agent IS 'Browser user agent when session was created';
COMMENT ON COLUMN user_sessions.browser_info IS 'Parsed browser info: {browser, version, os, device}';
COMMENT ON COLUMN user_sessions.location_info IS 'Geographic location: {country, city, timezone}';
COMMENT ON COLUMN user_sessions.is_active IS 'Whether this session is currently active';
COMMENT ON COLUMN user_sessions.logout_reason IS 'Why the session ended';
COMMENT ON COLUMN user_sessions.metadata IS 'Additional session metadata';

-- Create check constraints
ALTER TABLE user_sessions ADD CONSTRAINT chk_logout_reason 
CHECK (logout_reason IS NULL OR logout_reason IN (
    'USER_LOGOUT', 'TIMEOUT', 'FORCED', 'TOKEN_EXPIRED', 'SECURITY_LOGOUT'
));

-- Create function to automatically update last_activity
CREATE OR REPLACE FUNCTION update_session_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_sessions 
    SET last_activity = NOW() 
    WHERE id = NEW.session_id AND NEW.session_id IS NOT NULL;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update session activity when activity is logged
CREATE TRIGGER trigger_update_session_activity
    AFTER INSERT ON user_activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_session_last_activity();