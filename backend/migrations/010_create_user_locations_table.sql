-- Migration: 010_create_user_locations_table.sql
-- Purpose: Create tables for GPS location tracking system

-- Main table for storing GPS locations
CREATE TABLE user_locations (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(10, 2),
    altitude DECIMAL(10, 2),
    altitude_accuracy DECIMAL(10, 2),
    heading DECIMAL(5, 2),
    speed DECIMAL(10, 2),
    device_id VARCHAR(255),
    ip_address INET,
    network_type VARCHAR(50),
    battery_level INTEGER,
    tracking_session_id VARCHAR(128),
    is_background BOOLEAN DEFAULT FALSE,
    is_moving BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create indexes for performance
CREATE INDEX idx_user_locations_user_id_recorded_at 
    ON user_locations(user_id, recorded_at DESC);
CREATE INDEX idx_user_locations_user_id_created_at 
    ON user_locations(user_id, created_at DESC);
CREATE INDEX idx_user_locations_tracking_session 
    ON user_locations(tracking_session_id);
CREATE INDEX idx_user_locations_coordinates 
    ON user_locations(latitude, longitude);

-- Table for tracking sessions
CREATE TABLE location_tracking_sessions (
    id VARCHAR(128) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    total_points INTEGER DEFAULT 0,
    device_info JSONB,
    metadata JSONB
);

CREATE INDEX idx_tracking_sessions_user_id ON location_tracking_sessions(user_id);
CREATE INDEX idx_tracking_sessions_active ON location_tracking_sessions(is_active);

-- Table for user location preferences
CREATE TABLE user_location_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tracking_enabled BOOLEAN DEFAULT FALSE,
    tracking_interval INTEGER DEFAULT 60,
    background_tracking_enabled BOOLEAN DEFAULT FALSE,
    high_accuracy_mode BOOLEAN DEFAULT FALSE,
    max_tracking_duration INTEGER DEFAULT 28800,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Function to cleanup old location data
CREATE OR REPLACE FUNCTION cleanup_old_locations(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_locations 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    UPDATE location_tracking_sessions 
    SET is_active = FALSE 
    WHERE is_active = TRUE 
    AND started_at < NOW() - INTERVAL '1 day' * retention_days;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- View for latest user locations
CREATE VIEW latest_user_locations AS
SELECT DISTINCT ON (user_id) 
    ul.*,
    u.email,
    u.full_name
FROM user_locations ul
JOIN users u ON ul.user_id = u.id
ORDER BY user_id, recorded_at DESC;