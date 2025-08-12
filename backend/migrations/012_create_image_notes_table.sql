-- Migration: Create image_notes table for Gallery Notes system
-- Created: 2025-01-12
-- Description: Allow users to add notes/comments to specific image attachments

-- Create image_notes table
CREATE TABLE IF NOT EXISTS image_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attachment_id UUID NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL CHECK (length(trim(content)) > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Foreign key constraints
    CONSTRAINT fk_image_notes_attachment 
        FOREIGN KEY (attachment_id) 
        REFERENCES comment_attachments(id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_image_notes_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
        
    -- Content length constraint
    CONSTRAINT chk_content_length 
        CHECK (length(content) <= 1000)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_image_notes_attachment_id 
    ON image_notes(attachment_id);
    
CREATE INDEX IF NOT EXISTS idx_image_notes_user_id 
    ON image_notes(user_id);
    
CREATE INDEX IF NOT EXISTS idx_image_notes_created_at 
    ON image_notes(created_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_image_notes_active 
    ON image_notes(attachment_id, is_deleted, created_at DESC) 
    WHERE is_deleted = FALSE;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_image_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_image_notes_updated_at ON image_notes;
CREATE TRIGGER trigger_image_notes_updated_at
    BEFORE UPDATE ON image_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_image_notes_updated_at();

-- Add some sample data for testing (optional)
-- INSERT INTO image_notes (attachment_id, user_id, content) 
-- VALUES 
-- ('existing-attachment-uuid', 'existing-user-uuid', 'Great photo! Love the composition.'),
-- ('existing-attachment-uuid', 'another-user-uuid', 'The lighting is perfect here.');

COMMENT ON TABLE image_notes IS 'Notes/comments that users can add to specific image attachments in the Gallery';
COMMENT ON COLUMN image_notes.attachment_id IS 'Reference to comment_attachments table';
COMMENT ON COLUMN image_notes.user_id IS 'User who created the note';
COMMENT ON COLUMN image_notes.content IS 'Note content (max 1000 characters)';
COMMENT ON COLUMN image_notes.is_deleted IS 'Soft delete flag';