-- Migration 014: Fix location_tracking_sessions table schema
-- Add missing updated_at column and fix any schema inconsistencies

-- Add updated_at column
ALTER TABLE location_tracking_sessions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_location_tracking_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_location_tracking_sessions_updated_at_trigger ON location_tracking_sessions;

CREATE TRIGGER update_location_tracking_sessions_updated_at_trigger
    BEFORE UPDATE ON location_tracking_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_location_tracking_sessions_updated_at();

-- Update existing records to have updated_at = started_at for consistency
UPDATE location_tracking_sessions 
SET updated_at = COALESCE(started_at, CURRENT_TIMESTAMP) 
WHERE updated_at IS NULL;