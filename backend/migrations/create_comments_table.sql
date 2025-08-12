-- Create comments table for form submissions
-- Supports nested comments with parent_id reference

CREATE TABLE IF NOT EXISTS form_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL,
    parent_id UUID REFERENCES form_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes for performance
    CONSTRAINT fk_submission
        FOREIGN KEY(submission_id) 
        REFERENCES form_submissions(id) 
        ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX idx_comments_submission_id ON form_comments(submission_id);
CREATE INDEX idx_comments_parent_id ON form_comments(parent_id);
CREATE INDEX idx_comments_user_id ON form_comments(user_id);
CREATE INDEX idx_comments_created_at ON form_comments(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER trigger_update_comments_timestamp
    BEFORE UPDATE ON form_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_comments_updated_at();

-- Grant permissions
GRANT ALL ON form_comments TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON form_comments TO postgres;