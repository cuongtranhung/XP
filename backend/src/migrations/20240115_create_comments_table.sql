-- Migration: Create Comments Table for Form Submissions
-- Date: 2024-01-15
-- Description: Simple comment system without real-time features

-- Drop table if exists (for development)
DROP TABLE IF EXISTS comments CASCADE;

-- Create comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL,
    parent_id UUID DEFAULT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    
    -- Foreign key constraints
    CONSTRAINT fk_submission 
        FOREIGN KEY (submission_id) 
        REFERENCES submissions(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_parent_comment 
        FOREIGN KEY (parent_id) 
        REFERENCES comments(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    -- Ensure content is not empty
    CONSTRAINT chk_content_not_empty 
        CHECK (LENGTH(TRIM(content)) > 0)
);

-- Create indexes for better performance
CREATE INDEX idx_comments_submission_id ON comments(submission_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_parent_id ON comments(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_deleted_at ON comments(deleted_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_comments_updated_at 
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create view for comment counts per submission
CREATE OR REPLACE VIEW submission_comment_counts AS
SELECT 
    submission_id,
    COUNT(*) FILTER (WHERE parent_id IS NULL) as root_comments,
    COUNT(*) as total_comments
FROM comments
WHERE deleted_at IS NULL
GROUP BY submission_id;

-- Create function to get comment depth (max 3 levels)
CREATE OR REPLACE FUNCTION get_comment_depth(comment_id UUID)
RETURNS INTEGER AS $$
DECLARE
    depth INTEGER := 0;
    current_parent_id UUID;
BEGIN
    SELECT parent_id INTO current_parent_id FROM comments WHERE id = comment_id;
    
    WHILE current_parent_id IS NOT NULL AND depth < 3 LOOP
        depth := depth + 1;
        SELECT parent_id INTO current_parent_id FROM comments WHERE id = current_parent_id;
    END LOOP;
    
    RETURN depth;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if comment can have replies (max depth 2, so it can go to depth 3)
CREATE OR REPLACE FUNCTION can_have_replies(comment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_comment_depth(comment_id) < 2;
END;
$$ LANGUAGE plpgsql;

-- Add check constraint for max nesting depth
ALTER TABLE comments ADD CONSTRAINT chk_max_depth
    CHECK (parent_id IS NULL OR get_comment_depth(id) <= 3);

-- Grant permissions (adjust based on your user roles)
-- GRANT SELECT, INSERT, UPDATE ON comments TO app_user;
-- GRANT SELECT ON submission_comment_counts TO app_user;

-- Insert sample data for testing (optional, remove in production)
-- INSERT INTO comments (submission_id, user_id, content) 
-- VALUES 
--     ('submission-uuid-1', 'user-uuid-1', 'This is a test comment'),
--     ('submission-uuid-1', 'user-uuid-2', 'This is another comment');

-- Rollback script (save separately)
-- DROP VIEW IF EXISTS submission_comment_counts;
-- DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP FUNCTION IF EXISTS get_comment_depth(UUID);
-- DROP FUNCTION IF EXISTS can_have_replies(UUID);
-- DROP TABLE IF EXISTS comments CASCADE;