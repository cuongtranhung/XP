-- Add table for form submission file uploads
CREATE TABLE IF NOT EXISTS form_submission_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    field_key VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    path TEXT NOT NULL,
    thumbnail_path TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_form_submission_files_submission_id ON form_submission_files(submission_id);
CREATE INDEX idx_form_submission_files_field_key ON form_submission_files(field_key);
CREATE INDEX idx_form_submission_files_created_at ON form_submission_files(created_at);

-- Add trigger for updated_at
CREATE TRIGGER update_form_submission_files_updated_at
    BEFORE UPDATE ON form_submission_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();