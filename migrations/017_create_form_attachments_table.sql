-- Migration: Create form_attachments table for Form Builder file uploads
-- Description: Stores metadata for files uploaded via Form Builder fields using MEGA S4

CREATE TABLE IF NOT EXISTS form_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL,
  submission_id UUID NULL, -- NULL until form is submitted
  field_key VARCHAR(100) NOT NULL, -- The form field key that this attachment belongs to
  file_key VARCHAR(500) NOT NULL, -- MEGA S4 object key
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by INTEGER NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_public BOOLEAN DEFAULT FALSE,
  download_count INTEGER DEFAULT 0,
  checksum VARCHAR(128),
  validation_status VARCHAR(20) DEFAULT 'pending',
  validation_errors TEXT,
  virus_scan_status VARCHAR(20) DEFAULT 'pending',
  file_category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  
  -- Constraints
  CONSTRAINT chk_file_size_positive CHECK (file_size > 0),
  CONSTRAINT chk_validation_status CHECK (validation_status IN ('pending', 'validated', 'rejected')),
  CONSTRAINT chk_virus_scan_status CHECK (virus_scan_status IN ('pending', 'clean', 'infected')),
  
  -- Foreign Key Constraints
  CONSTRAINT fk_form_attachments_form FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  CONSTRAINT fk_form_attachments_submission FOREIGN KEY (submission_id) REFERENCES form_submissions(id) ON DELETE CASCADE,
  CONSTRAINT fk_form_attachments_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_form_attachments_form_id ON form_attachments(form_id);
CREATE INDEX idx_form_attachments_submission_id ON form_attachments(submission_id);
CREATE INDEX idx_form_attachments_field_key ON form_attachments(field_key);
CREATE INDEX idx_form_attachments_uploaded_by ON form_attachments(uploaded_by);
CREATE INDEX idx_form_attachments_upload_date ON form_attachments(upload_date);
CREATE INDEX idx_form_attachments_mime_type ON form_attachments(mime_type);
CREATE INDEX idx_form_attachments_file_category ON form_attachments(file_category);
CREATE INDEX idx_form_attachments_validation_status ON form_attachments(validation_status);
CREATE INDEX idx_form_attachments_virus_scan_status ON form_attachments(virus_scan_status);

-- Deleted items index for cleanup
CREATE INDEX idx_form_attachments_deleted ON form_attachments(deleted_at) WHERE deleted_at IS NOT NULL;

-- Composite index for validated files
CREATE INDEX idx_form_attachments_valid_files 
ON form_attachments(form_id, field_key, validation_status, virus_scan_status) 
WHERE deleted_at IS NULL 
AND validation_status = 'validated' 
AND virus_scan_status = 'clean';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_form_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_form_attachments_updated_at
  BEFORE UPDATE ON form_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_form_attachments_updated_at();

-- Add view for attachment statistics by form
CREATE OR REPLACE VIEW form_attachment_stats AS
SELECT 
  form_id,
  COUNT(*) as total_attachments,
  COUNT(CASE WHEN validation_status = 'validated' AND virus_scan_status = 'clean' THEN 1 END) as valid_attachments,
  COUNT(CASE WHEN file_category = 'image' THEN 1 END) as image_attachments,
  COUNT(CASE WHEN file_category = 'document' THEN 1 END) as document_attachments,
  COUNT(CASE WHEN file_category = 'video' THEN 1 END) as video_attachments,
  SUM(file_size) as total_size_bytes,
  SUM(CASE WHEN validation_status = 'validated' AND virus_scan_status = 'clean' THEN file_size ELSE 0 END) as valid_size_bytes,
  AVG(file_size) as avg_file_size_bytes,
  MAX(upload_date) as last_attachment_date,
  SUM(download_count) as total_downloads
FROM form_attachments 
WHERE deleted_at IS NULL
GROUP BY form_id;

-- Add view for submission attachments
CREATE OR REPLACE VIEW submission_attachment_stats AS
SELECT 
  submission_id,
  form_id,
  COUNT(*) as total_attachments,
  COUNT(CASE WHEN validation_status = 'validated' AND virus_scan_status = 'clean' THEN 1 END) as valid_attachments,
  SUM(file_size) as total_size_bytes,
  SUM(CASE WHEN validation_status = 'validated' AND virus_scan_status = 'clean' THEN file_size ELSE 0 END) as valid_size_bytes,
  string_agg(DISTINCT file_category, ', ' ORDER BY file_category) as file_categories,
  MAX(upload_date) as last_attachment_date
FROM form_attachments 
WHERE deleted_at IS NULL 
AND submission_id IS NOT NULL
GROUP BY submission_id, form_id;

COMMENT ON TABLE form_attachments IS 'Stores metadata for files uploaded via Form Builder fields using MEGA S4 object storage';
COMMENT ON COLUMN form_attachments.form_id IS 'ID of the form this attachment belongs to';
COMMENT ON COLUMN form_attachments.submission_id IS 'ID of the form submission (NULL until submitted)';
COMMENT ON COLUMN form_attachments.field_key IS 'The form field key that this attachment belongs to';
COMMENT ON COLUMN form_attachments.file_key IS 'MEGA S4 object storage key for the file';
COMMENT ON COLUMN form_attachments.validation_status IS 'File validation status: pending, validated, rejected';
COMMENT ON COLUMN form_attachments.virus_scan_status IS 'Virus scan status: pending, clean, infected';
COMMENT ON COLUMN form_attachments.file_category IS 'Automatically determined file category based on MIME type';