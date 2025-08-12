-- Migration: Create user activity logs table
-- Description: Table to store all user activities for audit and analytics
-- Author: System
-- Date: 2025-08-04

-- Create user_activity_logs table
CREATE TABLE user_activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(128),
    action_type VARCHAR(50) NOT NULL,
    action_category VARCHAR(30) NOT NULL,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    request_data JSONB,
    response_status INTEGER,
    ip_address INET,
    user_agent TEXT,
    referrer VARCHAR(500),
    browser_info JSONB,
    location_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_time_ms INTEGER,
    metadata JSONB
);

-- Create indexes for performance optimization
CREATE INDEX idx_user_activity_logs_user_id_created_at ON user_activity_logs(user_id, created_at DESC);
CREATE INDEX idx_user_activity_logs_action_type ON user_activity_logs(action_type);
CREATE INDEX idx_user_activity_logs_action_category ON user_activity_logs(action_category);
CREATE INDEX idx_user_activity_logs_session_id ON user_activity_logs(session_id);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX idx_user_activity_logs_ip_address ON user_activity_logs(ip_address);
CREATE INDEX idx_user_activity_logs_endpoint ON user_activity_logs(endpoint);

-- Create partial indexes for common queries
CREATE INDEX idx_user_activity_logs_failed_logins ON user_activity_logs(user_id, created_at DESC) 
WHERE action_type = 'FAILED_LOGIN';

CREATE INDEX idx_user_activity_logs_security_events ON user_activity_logs(created_at DESC) 
WHERE action_category = 'SECURITY';

-- Add comments for documentation
COMMENT ON TABLE user_activity_logs IS 'Stores all user activities for audit trail and analytics';
COMMENT ON COLUMN user_activity_logs.user_id IS 'Reference to users table';
COMMENT ON COLUMN user_activity_logs.session_id IS 'Session identifier for grouping activities';
COMMENT ON COLUMN user_activity_logs.action_type IS 'Type of action: LOGIN, LOGOUT, VIEW_PAGE, API_CALL, etc.';
COMMENT ON COLUMN user_activity_logs.action_category IS 'Category: AUTH, PROFILE, SETTINGS, NAVIGATION, SECURITY, SYSTEM';
COMMENT ON COLUMN user_activity_logs.endpoint IS 'API endpoint or page URL accessed';
COMMENT ON COLUMN user_activity_logs.method IS 'HTTP method: GET, POST, PUT, DELETE';
COMMENT ON COLUMN user_activity_logs.resource_type IS 'Type of resource accessed: user, profile, settings';
COMMENT ON COLUMN user_activity_logs.resource_id IS 'ID of the specific resource';
COMMENT ON COLUMN user_activity_logs.request_data IS 'Sanitized request payload (sensitive data removed)';
COMMENT ON COLUMN user_activity_logs.response_status IS 'HTTP response status code';
COMMENT ON COLUMN user_activity_logs.ip_address IS 'IP address of the request';
COMMENT ON COLUMN user_activity_logs.user_agent IS 'Browser user agent string';
COMMENT ON COLUMN user_activity_logs.referrer IS 'HTTP referer header';
COMMENT ON COLUMN user_activity_logs.browser_info IS 'Parsed browser information: {browser, version, os, device}';
COMMENT ON COLUMN user_activity_logs.location_info IS 'Geographic location info: {country, city, timezone}';
COMMENT ON COLUMN user_activity_logs.processing_time_ms IS 'Request processing time in milliseconds';
COMMENT ON COLUMN user_activity_logs.metadata IS 'Additional flexible metadata in JSON format';

-- Create check constraints for data integrity
ALTER TABLE user_activity_logs ADD CONSTRAINT chk_action_type 
CHECK (action_type IN (
    'LOGIN', 'LOGOUT', 'TOKEN_REFRESH', 'FAILED_LOGIN',
    'VIEW_PROFILE', 'UPDATE_PROFILE', 'CHANGE_PASSWORD', 'UPLOAD_AVATAR',
    'VIEW_SETTINGS', 'UPDATE_SETTINGS',
    'VIEW_DASHBOARD', 'VIEW_PAGE',
    'API_CALL',
    'SUSPICIOUS_ACTIVITY', 'ERROR_OCCURRED'
));

ALTER TABLE user_activity_logs ADD CONSTRAINT chk_action_category 
CHECK (action_category IN ('AUTH', 'PROFILE', 'SETTINGS', 'NAVIGATION', 'SECURITY', 'SYSTEM'));

ALTER TABLE user_activity_logs ADD CONSTRAINT chk_method 
CHECK (method IS NULL OR method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'));

ALTER TABLE user_activity_logs ADD CONSTRAINT chk_response_status 
CHECK (response_status IS NULL OR (response_status >= 100 AND response_status <= 599));

ALTER TABLE user_activity_logs ADD CONSTRAINT chk_processing_time 
CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0);