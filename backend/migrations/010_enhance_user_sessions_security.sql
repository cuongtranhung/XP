-- Enhance user_sessions table for modern security standards
-- Migration: 010_enhance_user_sessions_security.sql

BEGIN;

-- Add new columns for enhanced session security
ALTER TABLE user_sessions 
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(50);

-- Update existing data: set deactivation info for inactive sessions
UPDATE user_sessions 
SET deactivated_at = CURRENT_TIMESTAMP,
    deactivation_reason = COALESCE(logout_reason, 'UNKNOWN')
WHERE is_active = false AND deactivated_at IS NULL;

-- Create index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_deactivated 
ON user_sessions(deactivated_at) 
WHERE is_active = false;

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_analytics 
ON user_sessions(user_id, created_at, is_active);

-- Create index for security monitoring
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip_security 
ON user_sessions(ip_address, created_at) 
WHERE is_active = true;

-- Add constraint to ensure deactivation reason is set when session is inactive
ALTER TABLE user_sessions 
ADD CONSTRAINT check_deactivation_reason 
CHECK (
  (is_active = true) OR 
  (is_active = false AND deactivation_reason IS NOT NULL)
);

-- Create a function to automatically set deactivation timestamp
CREATE OR REPLACE FUNCTION set_session_deactivation()
RETURNS TRIGGER AS $$
BEGIN
  -- If session is being deactivated, set deactivated_at if not already set
  IF OLD.is_active = true AND NEW.is_active = false THEN
    IF NEW.deactivated_at IS NULL THEN
      NEW.deactivated_at = CURRENT_TIMESTAMP;
    END IF;
    -- Ensure deactivation_reason is set
    IF NEW.deactivation_reason IS NULL THEN
      NEW.deactivation_reason = 'SYSTEM';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic deactivation timestamp
DROP TRIGGER IF EXISTS trigger_session_deactivation ON user_sessions;
CREATE TRIGGER trigger_session_deactivation
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_session_deactivation();

-- Create a function for session cleanup
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS INTEGER AS $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  -- First, deactivate expired sessions
  UPDATE user_sessions 
  SET is_active = false, 
      deactivated_at = CURRENT_TIMESTAMP,
      deactivation_reason = 'EXPIRED'
  WHERE is_active = true 
    AND expires_at < CURRENT_TIMESTAMP;
  
  -- Then, delete old inactive sessions (older than 7 days)
  DELETE FROM user_sessions 
  WHERE is_active = false 
    AND deactivated_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  -- Log the cleanup
  INSERT INTO user_activity_logs (
    user_id, 
    action_type, 
    action_category,
    metadata,
    created_at
  ) VALUES (
    NULL,
    'SYSTEM_MAINTENANCE',
    'SESSION_CLEANUP',
    json_build_object('cleaned_sessions', cleanup_count),
    CURRENT_TIMESTAMP
  );
  
  RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql;

-- Create a view for session analytics
CREATE OR REPLACE VIEW session_analytics AS
SELECT 
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_sessions,
  COUNT(CASE WHEN deactivation_reason = 'USER_LOGOUT' THEN 1 END) as user_logouts,
  COUNT(CASE WHEN deactivation_reason = 'EXPIRED' THEN 1 END) as expired_sessions,
  COUNT(CASE WHEN deactivation_reason = 'CONCURRENT_LIMIT_EXCEEDED' THEN 1 END) as limit_exceeded,
  COUNT(CASE WHEN deactivation_reason = 'ROTATED' THEN 1 END) as rotated_sessions,
  AVG(EXTRACT(EPOCH FROM (COALESCE(deactivated_at, CURRENT_TIMESTAMP) - created_at)) / 3600) as avg_session_hours,
  COUNT(DISTINCT ip_address) as unique_ips,
  COUNT(DISTINCT user_agent) as unique_browsers,
  COUNT(DISTINCT user_id) as unique_users,
  DATE_TRUNC('day', CURRENT_TIMESTAMP) as report_date
FROM user_sessions
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days';

-- Grant necessary permissions
GRANT SELECT ON session_analytics TO postgres;

COMMIT;

-- Display summary
SELECT 
  'Session security enhancement completed' as status,
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_sessions
FROM user_sessions;