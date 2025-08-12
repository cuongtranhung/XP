-- Add date_of_birth field to users table
ALTER TABLE users ADD COLUMN date_of_birth DATE;

-- Create index on date_of_birth for faster queries (optional but good for performance)
CREATE INDEX IF NOT EXISTS idx_users_date_of_birth ON users(date_of_birth);

-- Add comment to document the column purpose
COMMENT ON COLUMN users.date_of_birth IS 'User date of birth in YYYY-MM-DD format';