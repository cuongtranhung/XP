-- Performance optimization indexes for common queries
-- Created: 2025-08-08
-- Purpose: Improve query performance and prevent slowdowns

-- Indexes for forms table
CREATE INDEX IF NOT EXISTS idx_forms_user_id ON forms(user_id);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);
CREATE INDEX IF NOT EXISTS idx_forms_created_at ON forms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forms_slug ON forms(slug);
CREATE INDEX IF NOT EXISTS idx_forms_user_status ON forms(user_id, status);

-- Indexes for form_submissions table
CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitter_id ON form_submissions(submitter_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON form_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_form_created ON form_submissions(form_id, created_at DESC);

-- Indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);

-- Indexes for user_sessions table
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON user_sessions(user_id, expires_at);

-- Indexes for user_activity_logs table (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_activity_logs') THEN
        CREATE INDEX IF NOT EXISTS idx_activity_user_id ON user_activity_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_activity_action ON user_activity_logs(action_type);
        CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_activity_user_created ON user_activity_logs(user_id, created_at DESC);
    END IF;
END $$;

-- Analyze tables to update statistics for query planner
ANALYZE forms;
ANALYZE form_submissions;
ANALYZE users;
ANALYZE user_sessions;

-- Show created indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND tablename IN ('forms', 'form_submissions', 'users', 'user_sessions', 'user_activity_logs')
ORDER BY tablename, indexname;