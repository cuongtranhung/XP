-- Create comment attachments table for MEGA S4 file attachments
-- This table stores file attachments that can be attached to comments

-- Create the comment_attachments table
CREATE TABLE IF NOT EXISTS comment_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to the comment
    comment_id UUID NOT NULL,
    
    -- File information from MEGA S4
    file_key VARCHAR(500) NOT NULL,           -- S3/MEGA S4 object key
    original_name VARCHAR(255) NOT NULL,      -- Original filename uploaded by user
    mime_type VARCHAR(100) NOT NULL,          -- File MIME type
    file_size BIGINT NOT NULL,               -- File size in bytes
    
    -- Upload information
    uploaded_by INTEGER NOT NULL,            -- User who uploaded the file
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- File access and security
    is_public BOOLEAN DEFAULT FALSE,         -- Whether file is publicly accessible
    download_count INTEGER DEFAULT 0,       -- Track download statistics
    
    -- File validation metadata
    checksum VARCHAR(128),                   -- File checksum for integrity
    validation_status VARCHAR(20) DEFAULT 'pending', -- pending, validated, rejected
    validation_errors TEXT,                 -- Validation error details if any
    virus_scan_status VARCHAR(20) DEFAULT 'pending', -- pending, clean, infected
    
    -- File categorization
    file_category VARCHAR(50),               -- image, document, archive, etc.
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE NULL, -- Soft delete
    
    -- Foreign key constraints
    CONSTRAINT fk_comment_attachments_comment 
        FOREIGN KEY (comment_id) 
        REFERENCES submission_comments(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_comment_attachments_user 
        FOREIGN KEY (uploaded_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT chk_file_size_positive 
        CHECK (file_size > 0),
    
    CONSTRAINT chk_validation_status 
        CHECK (validation_status IN ('pending', 'validated', 'rejected')),
    
    CONSTRAINT chk_virus_scan_status 
        CHECK (virus_scan_status IN ('pending', 'clean', 'infected'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comment_attachments_comment_id 
    ON comment_attachments(comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_attachments_uploaded_by 
    ON comment_attachments(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_comment_attachments_upload_date 
    ON comment_attachments(upload_date);

CREATE INDEX IF NOT EXISTS idx_comment_attachments_mime_type 
    ON comment_attachments(mime_type);

CREATE INDEX IF NOT EXISTS idx_comment_attachments_file_category 
    ON comment_attachments(file_category);

CREATE INDEX IF NOT EXISTS idx_comment_attachments_validation_status 
    ON comment_attachments(validation_status);

CREATE INDEX IF NOT EXISTS idx_comment_attachments_virus_scan_status 
    ON comment_attachments(virus_scan_status);

-- Composite index for finding valid attachments
CREATE INDEX IF NOT EXISTS idx_comment_attachments_valid_files 
    ON comment_attachments(comment_id, validation_status, virus_scan_status) 
    WHERE deleted_at IS NULL AND validation_status = 'validated' AND virus_scan_status = 'clean';

-- Index for soft deleted files cleanup
CREATE INDEX IF NOT EXISTS idx_comment_attachments_deleted 
    ON comment_attachments(deleted_at) 
    WHERE deleted_at IS NOT NULL;

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comment_attachments_updated_at
    BEFORE UPDATE ON comment_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_comment_attachments_updated_at();

-- Add comments to document table structure
COMMENT ON TABLE comment_attachments IS 'File attachments for submission comments using MEGA S4 storage';
COMMENT ON COLUMN comment_attachments.id IS 'Unique identifier for the attachment';
COMMENT ON COLUMN comment_attachments.comment_id IS 'ID of the comment this attachment belongs to';
COMMENT ON COLUMN comment_attachments.file_key IS 'MEGA S4/S3 object key for retrieving the file';
COMMENT ON COLUMN comment_attachments.original_name IS 'Original filename as uploaded by user';
COMMENT ON COLUMN comment_attachments.mime_type IS 'MIME type of the file (e.g., image/png, application/pdf)';
COMMENT ON COLUMN comment_attachments.file_size IS 'File size in bytes';
COMMENT ON COLUMN comment_attachments.uploaded_by IS 'ID of user who uploaded the file';
COMMENT ON COLUMN comment_attachments.is_public IS 'Whether file can be accessed publicly or requires authentication';
COMMENT ON COLUMN comment_attachments.download_count IS 'Number of times file has been downloaded';
COMMENT ON COLUMN comment_attachments.checksum IS 'File checksum for integrity verification';
COMMENT ON COLUMN comment_attachments.validation_status IS 'File validation status (pending, validated, rejected)';
COMMENT ON COLUMN comment_attachments.validation_errors IS 'Detailed validation error messages if validation failed';
COMMENT ON COLUMN comment_attachments.virus_scan_status IS 'Virus scan status (pending, clean, infected)';
COMMENT ON COLUMN comment_attachments.file_category IS 'General category of file (image, document, archive, etc.)';

-- Create a view for attachment statistics
CREATE OR REPLACE VIEW comment_attachment_stats AS
SELECT 
    sc.id as comment_id,
    sc.submission_id,
    COUNT(ca.id) as total_attachments,
    COUNT(ca.id) FILTER (WHERE ca.validation_status = 'validated' AND ca.virus_scan_status = 'clean') as valid_attachments,
    COUNT(ca.id) FILTER (WHERE ca.file_category = 'image') as image_attachments,
    COUNT(ca.id) FILTER (WHERE ca.file_category = 'document') as document_attachments,
    COALESCE(SUM(ca.file_size), 0) as total_size_bytes,
    COALESCE(SUM(ca.file_size) FILTER (WHERE ca.validation_status = 'validated'), 0) as valid_size_bytes,
    MAX(ca.upload_date) as last_attachment_date
FROM submission_comments sc
LEFT JOIN comment_attachments ca ON sc.id = ca.comment_id AND ca.deleted_at IS NULL
GROUP BY sc.id, sc.submission_id;

COMMENT ON VIEW comment_attachment_stats IS 'Aggregated attachment statistics for each comment';

-- Grant permissions (if role exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'formbuilder_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON comment_attachments TO formbuilder_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO formbuilder_app;
        GRANT SELECT ON comment_attachment_stats TO formbuilder_app;
    END IF;
END
$$;