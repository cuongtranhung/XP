-- Create submission comments table
-- This table stores comments that can be attached to any form submission row

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the submission_comments table
CREATE TABLE IF NOT EXISTS submission_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to the form submission
    submission_id UUID NOT NULL,
    
    -- User who created the comment
    user_id INTEGER NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    
    -- Comment content
    content TEXT NOT NULL CHECK (length(content) >= 1 AND length(content) <= 2000),
    
    -- Threading support (for replies)
    parent_id UUID NULL REFERENCES submission_comments(id) ON DELETE CASCADE,
    
    -- Comment status and visibility
    is_private BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Foreign key constraints
    CONSTRAINT fk_submission_comments_submission 
        FOREIGN KEY (submission_id) 
        REFERENCES form_submissions(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_submission_comments_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL,
    
    -- Prevent deeply nested replies (max 1 level) - simplified check
    CONSTRAINT chk_parent_exists 
        CHECK (parent_id IS NULL OR parent_id != id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_submission_comments_submission_id 
    ON submission_comments(submission_id);

CREATE INDEX IF NOT EXISTS idx_submission_comments_user_id 
    ON submission_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_submission_comments_parent_id 
    ON submission_comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_submission_comments_created_at 
    ON submission_comments(created_at);

CREATE INDEX IF NOT EXISTS idx_submission_comments_is_private 
    ON submission_comments(is_private);

CREATE INDEX IF NOT EXISTS idx_submission_comments_is_resolved 
    ON submission_comments(is_resolved);

-- Composite index for efficient queries
CREATE INDEX IF NOT EXISTS idx_submission_comments_submission_created 
    ON submission_comments(submission_id, created_at);

-- Index for finding unresolved comments
CREATE INDEX IF NOT EXISTS idx_submission_comments_unresolved 
    ON submission_comments(submission_id, is_resolved) 
    WHERE is_resolved = FALSE;

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_submission_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_submission_comments_updated_at
    BEFORE UPDATE ON submission_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_submission_comments_updated_at();

-- Add comment to track table purpose
COMMENT ON TABLE submission_comments IS 'Comments that can be attached to form submission data rows';
COMMENT ON COLUMN submission_comments.id IS 'Unique identifier for the comment';
COMMENT ON COLUMN submission_comments.submission_id IS 'ID of the form submission this comment belongs to';
COMMENT ON COLUMN submission_comments.user_id IS 'ID of the user who created the comment';
COMMENT ON COLUMN submission_comments.user_email IS 'Email of the comment author (cached for performance)';
COMMENT ON COLUMN submission_comments.user_name IS 'Name of the comment author (cached for performance)';
COMMENT ON COLUMN submission_comments.content IS 'The comment text content (1-2000 characters)';
COMMENT ON COLUMN submission_comments.parent_id IS 'ID of parent comment for threading/replies (max 1 level deep)';
COMMENT ON COLUMN submission_comments.is_private IS 'Whether comment is private (only visible to form owner and author)';
COMMENT ON COLUMN submission_comments.is_resolved IS 'Whether comment has been marked as resolved by form owner';
COMMENT ON COLUMN submission_comments.created_at IS 'When the comment was created';
COMMENT ON COLUMN submission_comments.updated_at IS 'When the comment was last updated';

-- Create a view for comment statistics
CREATE OR REPLACE VIEW submission_comment_stats AS
SELECT 
    fs.id as submission_id,
    fs.form_id,
    COUNT(sc.id) as total_comments,
    COUNT(sc.id) FILTER (WHERE sc.is_resolved = false) as unresolved_comments,
    COUNT(sc.id) FILTER (WHERE sc.is_private = true) as private_comments,
    COUNT(sc.id) FILTER (WHERE sc.parent_id IS NULL) as root_comments,
    COUNT(sc.id) FILTER (WHERE sc.parent_id IS NOT NULL) as reply_comments,
    MAX(sc.created_at) as last_comment_at,
    COUNT(DISTINCT sc.user_id) as unique_commenters
FROM form_submissions fs
LEFT JOIN submission_comments sc ON fs.id = sc.submission_id
GROUP BY fs.id, fs.form_id;

COMMENT ON VIEW submission_comment_stats IS 'Aggregated comment statistics for each form submission';

-- Grant appropriate permissions (skip if role doesn't exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'formbuilder_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON submission_comments TO formbuilder_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO formbuilder_app;
        GRANT SELECT ON submission_comment_stats TO formbuilder_app;
    END IF;
END
$$;