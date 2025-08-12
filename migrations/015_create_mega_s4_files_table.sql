-- Migration: Create MEGA S4 Files Table
-- Description: Store information about files uploaded to MEGA S4 Object Storage
-- Date: 2024

-- Create mega_s4_files table
CREATE TABLE IF NOT EXISTS mega_s4_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- S3 Information
    s3_key VARCHAR(500) NOT NULL UNIQUE,  -- The key (path) in MEGA S4
    s3_etag VARCHAR(255),                  -- ETag from S3 (for integrity checking)
    s3_url TEXT,                           -- Presigned URL (temporary)
    bucket_name VARCHAR(255) NOT NULL,     -- Bucket name for multi-bucket support
    
    -- File Information
    original_name VARCHAR(255) NOT NULL,   -- Original filename
    stored_name VARCHAR(255),              -- Stored filename (if different)
    mime_type VARCHAR(100),                -- MIME type
    file_size BIGINT,                      -- Size in bytes
    file_extension VARCHAR(20),            -- File extension
    
    -- Image Metadata (if applicable)
    width INTEGER,                         -- Image width in pixels
    height INTEGER,                        -- Image height in pixels
    thumbnail_key VARCHAR(500),            -- S3 key for thumbnail
    
    -- Security & Validation
    checksum VARCHAR(255),                 -- MD5 or SHA256 checksum
    virus_scanned BOOLEAN DEFAULT false,   -- Has been scanned for viruses
    virus_scan_result JSONB,              -- Scan results
    is_safe BOOLEAN DEFAULT true,         -- File safety status
    
    -- Ownership & Association
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    entity_type VARCHAR(50),              -- 'comment', 'form', 'profile', etc.
    entity_id UUID,                        -- ID of the associated entity
    
    -- Access Control
    is_public BOOLEAN DEFAULT false,      -- Public access flag
    access_level VARCHAR(20) DEFAULT 'private', -- 'public', 'private', 'restricted'
    expires_at TIMESTAMP,                  -- Expiration date for temporary files
    
    -- Metadata
    metadata JSONB DEFAULT '{}',          -- Additional metadata
    tags TEXT[],                           -- Array of tags for categorization
    description TEXT,                      -- Optional file description
    
    -- Upload Information
    upload_type VARCHAR(50),              -- 'direct', 'presigned', 'multipart'
    upload_duration INTEGER,               -- Upload time in milliseconds
    source_ip INET,                       -- IP address of uploader
    user_agent TEXT,                      -- Browser/client user agent
    
    -- Statistics
    download_count INTEGER DEFAULT 0,     -- Number of downloads
    last_accessed_at TIMESTAMP,           -- Last access timestamp
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP                  -- Soft delete
);

-- Create indexes for performance
CREATE INDEX idx_mega_s4_files_s3_key ON mega_s4_files(s3_key);
CREATE INDEX idx_mega_s4_files_uploaded_by ON mega_s4_files(uploaded_by);
CREATE INDEX idx_mega_s4_files_entity ON mega_s4_files(entity_type, entity_id);
CREATE INDEX idx_mega_s4_files_created_at ON mega_s4_files(created_at DESC);
CREATE INDEX idx_mega_s4_files_deleted_at ON mega_s4_files(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_mega_s4_files_mime_type ON mega_s4_files(mime_type);
CREATE INDEX idx_mega_s4_files_is_public ON mega_s4_files(is_public) WHERE is_public = true;
CREATE INDEX idx_mega_s4_files_tags ON mega_s4_files USING GIN(tags) WHERE tags IS NOT NULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_mega_s4_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mega_s4_files_updated_at
    BEFORE UPDATE ON mega_s4_files
    FOR EACH ROW
    EXECUTE FUNCTION update_mega_s4_files_updated_at();

-- Create file access logs table for audit trail
CREATE TABLE IF NOT EXISTS mega_s4_file_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES mega_s4_files(id) ON DELETE CASCADE,
    accessed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'view', 'download', 'delete', 'update'
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mega_s4_access_logs_file_id ON mega_s4_file_access_logs(file_id);
CREATE INDEX idx_mega_s4_access_logs_user ON mega_s4_file_access_logs(accessed_by);
CREATE INDEX idx_mega_s4_access_logs_created_at ON mega_s4_file_access_logs(created_at DESC);

-- Create file chunks table for multipart uploads
CREATE TABLE IF NOT EXISTS mega_s4_file_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id VARCHAR(255) NOT NULL,      -- S3 multipart upload ID
    file_id UUID REFERENCES mega_s4_files(id) ON DELETE CASCADE,
    chunk_number INTEGER NOT NULL,
    chunk_size BIGINT,
    etag VARCHAR(255),
    uploaded BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(upload_id, chunk_number)
);

CREATE INDEX idx_mega_s4_chunks_upload_id ON mega_s4_file_chunks(upload_id);
CREATE INDEX idx_mega_s4_chunks_file_id ON mega_s4_file_chunks(file_id);

-- Add comments
COMMENT ON TABLE mega_s4_files IS 'Store information about files uploaded to MEGA S4 Object Storage';
COMMENT ON COLUMN mega_s4_files.s3_key IS 'Unique key (path) of the file in MEGA S4 bucket';
COMMENT ON COLUMN mega_s4_files.entity_type IS 'Type of entity this file is associated with (comment, form, etc.)';
COMMENT ON COLUMN mega_s4_files.entity_id IS 'ID of the associated entity';
COMMENT ON COLUMN mega_s4_files.access_level IS 'Access control level: public, private, or restricted';
COMMENT ON COLUMN mega_s4_files.upload_type IS 'Method used for upload: direct, presigned URL, or multipart';

-- Sample query to get all files for a specific entity
/*
SELECT 
    f.*,
    u.email as uploaded_by_email
FROM mega_s4_files f
LEFT JOIN users u ON f.uploaded_by = u.id
WHERE f.entity_type = 'comment' 
    AND f.entity_id = 'some-uuid'
    AND f.deleted_at IS NULL
ORDER BY f.created_at DESC;
*/