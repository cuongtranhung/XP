-- Comment System Database Schema
-- PostgreSQL Migration for Real-time Collaborative Comments

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    content_html TEXT, -- Cached HTML version
    is_resolved BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    thread_id UUID, -- Root comment ID for threading
    depth INTEGER DEFAULT 0 CHECK (depth >= 0 AND depth <= 3),
    path TEXT[], -- Materialized path for efficient queries
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    
    -- Foreign key constraints
    CONSTRAINT fk_submission 
        FOREIGN KEY (submission_id) 
        REFERENCES submissions(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_comments_submission_id ON comments(submission_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_parent_id ON comments(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_thread_id ON comments(thread_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_path ON comments USING GIN(path);
CREATE INDEX idx_comments_is_resolved ON comments(is_resolved) WHERE deleted_at IS NULL;

-- Comment reactions table
CREATE TABLE IF NOT EXISTS comment_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL,
    user_id UUID NOT NULL,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_comment 
        FOREIGN KEY (comment_id) 
        REFERENCES comments(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate reactions
    CONSTRAINT unique_user_comment_emoji 
        UNIQUE (comment_id, user_id, emoji)
);

CREATE INDEX idx_reactions_comment_id ON comment_reactions(comment_id);
CREATE INDEX idx_reactions_user_id ON comment_reactions(user_id);

-- Comment mentions table
CREATE TABLE IF NOT EXISTS comment_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL,
    mentioned_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT fk_comment 
        FOREIGN KEY (comment_id) 
        REFERENCES comments(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_mentioned_user 
        FOREIGN KEY (mentioned_user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint
    CONSTRAINT unique_comment_mention 
        UNIQUE (comment_id, mentioned_user_id)
);

CREATE INDEX idx_mentions_comment_id ON comment_mentions(comment_id);
CREATE INDEX idx_mentions_user_id ON comment_mentions(mentioned_user_id);
CREATE INDEX idx_mentions_unread ON comment_mentions(mentioned_user_id) WHERE read_at IS NULL;

-- Comment attachments table
CREATE TABLE IF NOT EXISTS comment_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_url TEXT NOT NULL,
    thumbnail_url TEXT,
    metadata JSONB,
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_comment 
        FOREIGN KEY (comment_id) 
        REFERENCES comments(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_uploaded_by 
        FOREIGN KEY (uploaded_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

CREATE INDEX idx_attachments_comment_id ON comment_attachments(comment_id);

-- Comment edit history table
CREATE TABLE IF NOT EXISTS comment_edit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL,
    previous_content TEXT NOT NULL,
    edited_by UUID NOT NULL,
    edited_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    edit_reason VARCHAR(255),
    
    -- Constraints
    CONSTRAINT fk_comment 
        FOREIGN KEY (comment_id) 
        REFERENCES comments(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_edited_by 
        FOREIGN KEY (edited_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

CREATE INDEX idx_edit_history_comment_id ON comment_edit_history(comment_id);
CREATE INDEX idx_edit_history_edited_at ON comment_edit_history(edited_at DESC);

-- User comment preferences table
CREATE TABLE IF NOT EXISTS user_comment_preferences (
    user_id UUID PRIMARY KEY,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    mention_notifications BOOLEAN DEFAULT TRUE,
    reply_notifications BOOLEAN DEFAULT TRUE,
    thread_notifications BOOLEAN DEFAULT TRUE,
    daily_digest BOOLEAN DEFAULT FALSE,
    notification_frequency VARCHAR(20) DEFAULT 'instant', -- instant, hourly, daily
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT fk_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Comment read status table (for unread indicators)
CREATE TABLE IF NOT EXISTS comment_read_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    submission_id UUID NOT NULL,
    last_read_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_comment_id UUID,
    
    -- Constraints
    CONSTRAINT fk_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_submission 
        FOREIGN KEY (submission_id) 
        REFERENCES submissions(id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_last_comment 
        FOREIGN KEY (last_comment_id) 
        REFERENCES comments(id) 
        ON DELETE SET NULL,
    
    -- Unique constraint
    CONSTRAINT unique_user_submission_read 
        UNIQUE (user_id, submission_id)
);

CREATE INDEX idx_read_status_user_submission ON comment_read_status(user_id, submission_id);

-- Functions for materialized path management
CREATE OR REPLACE FUNCTION update_comment_path() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path = ARRAY[NEW.id::text];
        NEW.thread_id = NEW.id;
        NEW.depth = 0;
    ELSE
        SELECT path || NEW.id::text, 
               COALESCE(thread_id, parent_id),
               depth + 1
        INTO NEW.path, NEW.thread_id, NEW.depth
        FROM comments 
        WHERE id = NEW.parent_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comment_path
    BEFORE INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_comment_path();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comments_updated_at 
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_comment_preferences_updated_at 
    BEFORE UPDATE ON user_comment_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE OR REPLACE VIEW comment_threads AS
SELECT 
    c.*,
    u.name as user_name,
    u.avatar_url as user_avatar,
    COUNT(DISTINCT r.id) as reaction_count,
    COUNT(DISTINCT replies.id) as reply_count,
    array_agg(DISTINCT r.emoji) FILTER (WHERE r.emoji IS NOT NULL) as reactions
FROM comments c
LEFT JOIN users u ON c.user_id = u.id
LEFT JOIN comment_reactions r ON c.id = r.comment_id
LEFT JOIN comments replies ON c.id = replies.parent_id AND replies.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, u.id;

-- View for unread comment counts
CREATE OR REPLACE VIEW unread_comment_counts AS
SELECT 
    s.id as submission_id,
    u.id as user_id,
    COUNT(c.id) as unread_count
FROM submissions s
CROSS JOIN users u
LEFT JOIN comment_read_status crs ON crs.submission_id = s.id AND crs.user_id = u.id
LEFT JOIN comments c ON c.submission_id = s.id 
    AND c.created_at > COALESCE(crs.last_read_at, '1970-01-01'::timestamptz)
    AND c.deleted_at IS NULL
GROUP BY s.id, u.id;