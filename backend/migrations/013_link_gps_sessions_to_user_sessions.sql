-- Migration: Link GPS Tracking Sessions to User Authentication Sessions
-- Version: 013
-- Description: Modify GPS tracking to properly associate with user authentication sessions

BEGIN;

-- Add user_session_id column to location_tracking_sessions
ALTER TABLE location_tracking_sessions 
ADD COLUMN user_session_id VARCHAR(128);

-- Add foreign key constraint to link with user_sessions
ALTER TABLE location_tracking_sessions 
ADD CONSTRAINT fk_location_tracking_user_session 
FOREIGN KEY (user_session_id) REFERENCES user_sessions(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_location_tracking_sessions_user_session_id 
ON location_tracking_sessions(user_session_id);

-- Add user_session_id column to user_locations for direct session tracking
ALTER TABLE user_locations 
ADD COLUMN user_session_id VARCHAR(128);

-- Add foreign key constraint to link locations with user_sessions
ALTER TABLE user_locations 
ADD CONSTRAINT fk_user_locations_user_session 
FOREIGN KEY (user_session_id) REFERENCES user_sessions(id) ON DELETE CASCADE;

-- Create composite index for efficient queries by session
CREATE INDEX idx_user_locations_session_time 
ON user_locations(user_session_id, recorded_at DESC);

-- Update existing data to maintain consistency (set to NULL for now)
-- In production, you might want to map to the most recent active session
UPDATE location_tracking_sessions 
SET user_session_id = NULL 
WHERE user_session_id IS NULL;

UPDATE user_locations 
SET user_session_id = NULL 
WHERE user_session_id IS NULL;

-- Create view for session-based location analysis
CREATE OR REPLACE VIEW user_location_sessions AS
SELECT 
    ul.id as location_id,
    ul.user_id,
    ul.user_session_id,
    us.id as session_id,
    us.ip_address as session_ip,
    us.user_agent as session_user_agent,
    us.browser_info as session_browser_info,
    us.created_at as session_started,
    us.last_activity as session_last_activity,
    ul.latitude,
    ul.longitude,
    ul.accuracy,
    ul.device_id,
    ul.recorded_at,
    ul.tracking_session_id,
    ul.metadata as location_metadata
FROM user_locations ul
LEFT JOIN user_sessions us ON ul.user_session_id = us.id
WHERE us.is_active = true OR us.is_active IS NULL;

-- Create function to get active sessions with location data
CREATE OR REPLACE FUNCTION get_user_active_location_sessions(p_user_id INTEGER)
RETURNS TABLE(
    session_id VARCHAR(128),
    location_count BIGINT,
    latest_location_time TIMESTAMP WITH TIME ZONE,
    device_info JSONB,
    session_ip INET,
    session_browser TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.id as session_id,
        COUNT(ul.id) as location_count,
        MAX(ul.recorded_at) as latest_location_time,
        lts.device_info,
        us.ip_address as session_ip,
        us.user_agent as session_browser
    FROM user_sessions us
    LEFT JOIN user_locations ul ON us.id = ul.user_session_id
    LEFT JOIN location_tracking_sessions lts ON us.id = lts.user_session_id
    WHERE us.user_id = p_user_id 
        AND us.is_active = true
        AND us.expires_at > CURRENT_TIMESTAMP
    GROUP BY us.id, lts.device_info, us.ip_address, us.user_agent
    ORDER BY latest_location_time DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

COMMIT;