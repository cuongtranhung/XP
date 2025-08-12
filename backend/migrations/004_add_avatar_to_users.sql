-- Add avatar field to users table
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);

-- Create index on avatar_url for faster lookups (optional but good for performance)
CREATE INDEX IF NOT EXISTS idx_users_avatar_url ON users(avatar_url);

-- Add comment to document the column purpose
COMMENT ON COLUMN users.avatar_url IS 'URL or path to user profile avatar image';