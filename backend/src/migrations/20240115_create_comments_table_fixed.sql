-- Create Comments Table for Form Submissions
-- This migration creates the comments table for the comment system

-- Drop table if exists (for re-running migration)
DROP TABLE IF EXISTS comments CASCADE;

-- Create comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL,
    parent_id UUID DEFAULT NULL,
    user_id INTEGER NOT NULL,  -- Changed from UUID to INTEGER to match users table
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    
    -- Ensure content is not empty and has reasonable length
    CONSTRAINT check_content_not_empty CHECK (LENGTH(TRIM(content)) > 0),
    CONSTRAINT check_content_max_length CHECK (LENGTH(content) <= 5000),
    
    -- Self-referential foreign key for nested comments
    CONSTRAINT fk_parent_comment 
        FOREIGN KEY (parent_id) 
        REFERENCES comments(id) 
        ON DELETE CASCADE,
    
    -- Foreign key to form_submissions table
    CONSTRAINT fk_submission 
        FOREIGN KEY (submission_id) 
        REFERENCES form_submissions(id) 
        ON DELETE CASCADE,
    
    -- Foreign key to users table
    CONSTRAINT fk_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_comments_submission_id ON comments(submission_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_parent_id ON comments(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_deleted_at ON comments(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create function to check comment depth (max 3 levels)
CREATE OR REPLACE FUNCTION check_comment_depth() 
RETURNS TRIGGER AS $$
DECLARE
    current_depth INTEGER := 0;
    current_parent_id UUID;
BEGIN
    -- Only check if parent_id is not null
    IF NEW.parent_id IS NOT NULL THEN
        current_parent_id := NEW.parent_id;
        
        -- Count the depth by traversing up the parent chain
        WHILE current_parent_id IS NOT NULL AND current_depth < 3 LOOP
            current_depth := current_depth + 1;
            SELECT parent_id INTO current_parent_id FROM comments WHERE id = current_parent_id;
        END LOOP;
        
        -- If depth is 2 or more, prevent insertion (0-based: 0, 1, 2 = 3 levels)
        IF current_depth >= 2 THEN
            RAISE EXCEPTION 'Maximum comment nesting depth exceeded (max 3 levels)';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce depth limit
CREATE TRIGGER enforce_comment_depth
    BEFORE INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION check_comment_depth();

-- Create function to get comment tree with user info
CREATE OR REPLACE FUNCTION get_comment_tree(p_submission_id UUID)
RETURNS TABLE (
    id UUID,
    submission_id UUID,
    parent_id UUID,
    user_id INTEGER,
    content TEXT,
    is_edited BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    depth INTEGER,
    path TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE comment_tree AS (
        -- Base case: root comments
        SELECT 
            c.id,
            c.submission_id,
            c.parent_id,
            c.user_id,
            c.content,
            c.is_edited,
            c.created_at,
            c.updated_at,
            c.deleted_at,
            0 as depth,
            c.id::text as path
        FROM comments c
        WHERE c.submission_id = p_submission_id 
          AND c.parent_id IS NULL
          AND c.deleted_at IS NULL
        
        UNION ALL
        
        -- Recursive case: child comments
        SELECT 
            c.id,
            c.submission_id,
            c.parent_id,
            c.user_id,
            c.content,
            c.is_edited,
            c.created_at,
            c.updated_at,
            c.deleted_at,
            ct.depth + 1,
            ct.path || '.' || c.id::text
        FROM comments c
        JOIN comment_tree ct ON c.parent_id = ct.id
        WHERE c.deleted_at IS NULL
          AND ct.depth < 2  -- Limit depth to 3 levels (0, 1, 2)
    )
    SELECT * FROM comment_tree
    ORDER BY path;
END;
$$ LANGUAGE plpgsql;

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        NEW.is_edited = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update timestamp
CREATE TRIGGER update_comment_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_comment_timestamp();

-- Add comments for documentation
COMMENT ON TABLE comments IS 'Stores comments for form submissions with nested reply support';
COMMENT ON COLUMN comments.submission_id IS 'Reference to the form submission this comment belongs to';
COMMENT ON COLUMN comments.parent_id IS 'Reference to parent comment for nested replies (NULL for root comments)';
COMMENT ON COLUMN comments.user_id IS 'User who created the comment';
COMMENT ON COLUMN comments.content IS 'The comment text content';
COMMENT ON COLUMN comments.is_edited IS 'Flag indicating if comment has been edited';
COMMENT ON COLUMN comments.deleted_at IS 'Soft delete timestamp (NULL if not deleted)';

-- Grant necessary permissions (adjust based on your user roles)
-- GRANT SELECT, INSERT, UPDATE ON comments TO your_app_user;
-- GRANT USAGE ON SEQUENCE comments_id_seq TO your_app_user;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Comments table created successfully!';
    RAISE NOTICE 'Features enabled:';
    RAISE NOTICE '  - Nested comments (max 3 levels)';
    RAISE NOTICE '  - Soft delete support';
    RAISE NOTICE '  - Auto-update timestamps';
    RAISE NOTICE '  - Content validation';
    RAISE NOTICE '  - Optimized indexes';
END $$;