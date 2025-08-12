-- Dynamic Form Builder Module - Database Schema
-- This migration creates the core tables for the Dynamic Form Builder module

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: Forms
-- Main form definitions with metadata
CREATE TABLE forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    version INTEGER DEFAULT 1,
    category VARCHAR(100),
    tags TEXT[], -- PostgreSQL array for tags
    visibility VARCHAR(50) DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'team')),
    
    -- XP Integration - Link to existing users
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    team_id UUID, -- For future team functionality
    
    -- Form settings (stored as JSONB for flexibility)
    settings JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Table: Form Fields
-- Individual form fields with configurations
CREATE TABLE form_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    field_key VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    placeholder VARCHAR(255),
    position INTEGER NOT NULL DEFAULT 0,
    required BOOLEAN DEFAULT FALSE,
    hidden BOOLEAN DEFAULT FALSE,
    
    -- Field validation rules (JSON)
    validation JSONB DEFAULT '{}',
    
    -- Field options (for select, radio, checkbox, etc.)
    options JSONB DEFAULT '[]',
    
    -- Conditional logic rules
    conditional_logic JSONB DEFAULT '{}',
    
    -- Step assignment (for multi-step forms)
    step_id UUID,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique field keys per form
    UNIQUE(form_id, field_key)
);

-- Table: Form Steps
-- For multi-step forms
CREATE TABLE form_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    
    -- Step settings
    settings JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique step positions per form
    UNIQUE(form_id, position)
);

-- Table: Form Submissions
-- Submitted form data
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    submission_number SERIAL, -- Auto-incrementing number per form
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'processing', 'failed')),
    
    -- Submitted data (JSONB for flexibility)
    data JSONB NOT NULL DEFAULT '{}',
    
    -- Submission metadata
    metadata JSONB DEFAULT '{}',
    
    -- Multi-step progress tracking
    current_step INTEGER DEFAULT 1,
    completed_steps INTEGER[] DEFAULT '{}',
    
    -- User information (optional - can be anonymous)
    submitter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    submitter_email VARCHAR(255),
    submitter_ip INET,
    
    -- Scoring and analysis
    score INTEGER,
    completion_time INTEGER, -- in seconds
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE,
    
    -- Soft delete
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Table: Form Analytics
-- Analytics and metrics per form
CREATE TABLE form_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    
    -- Date for daily aggregation
    date DATE NOT NULL,
    
    -- Metrics
    views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    submissions INTEGER DEFAULT 0,
    completed_submissions INTEGER DEFAULT 0,
    abandonment_rate DECIMAL(5,2) DEFAULT 0,
    avg_completion_time INTEGER DEFAULT 0,
    
    -- Device breakdown (JSONB)
    device_breakdown JSONB DEFAULT '{}',
    
    -- Traffic sources
    traffic_sources JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique analytics per form per day
    UNIQUE(form_id, date)
);

-- Table: Form Webhooks
-- Webhook configurations for forms
CREATE TABLE form_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    method VARCHAR(10) DEFAULT 'POST' CHECK (method IN ('POST', 'PUT', 'PATCH')),
    
    -- Events to trigger webhook
    events TEXT[] DEFAULT '{}', -- e.g., ['form.submitted', 'form.completed']
    
    -- Authentication
    auth_type VARCHAR(50) DEFAULT 'none' CHECK (auth_type IN ('none', 'bearer', 'basic', 'api_key')),
    auth_config JSONB DEFAULT '{}',
    
    -- Headers
    headers JSONB DEFAULT '{}',
    
    -- Payload template
    payload_template JSONB DEFAULT '{}',
    
    -- Retry configuration
    retry_config JSONB DEFAULT '{"enabled": true, "max_attempts": 3, "backoff_multiplier": 2}',
    
    -- Conditional execution
    conditions JSONB DEFAULT '{}',
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Form Templates
-- Reusable form templates
CREATE TABLE form_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    
    -- Template data (complete form structure)
    template_data JSONB NOT NULL,
    
    -- Template settings
    is_public BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    
    -- Usage stats
    usage_count INTEGER DEFAULT 0,
    
    -- Creator
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_forms_owner_id ON forms(owner_id);
CREATE INDEX idx_forms_status ON forms(status);
CREATE INDEX idx_forms_created_at ON forms(created_at);
CREATE INDEX idx_forms_slug ON forms(slug);

CREATE INDEX idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX idx_form_fields_position ON form_fields(form_id, position);
CREATE INDEX idx_form_fields_type ON form_fields(field_type);

CREATE INDEX idx_form_steps_form_id ON form_steps(form_id);
CREATE INDEX idx_form_steps_position ON form_steps(form_id, position);

CREATE INDEX idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_submitter_id ON form_submissions(submitter_id);
CREATE INDEX idx_form_submissions_created_at ON form_submissions(created_at);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);

CREATE INDEX idx_form_analytics_form_id ON form_analytics(form_id);
CREATE INDEX idx_form_analytics_date ON form_analytics(form_id, date);

CREATE INDEX idx_form_webhooks_form_id ON form_webhooks(form_id);
CREATE INDEX idx_form_webhooks_active ON form_webhooks(active);

CREATE INDEX idx_form_templates_category ON form_templates(category);
CREATE INDEX idx_form_templates_public ON form_templates(is_public);
CREATE INDEX idx_form_templates_featured ON form_templates(is_featured);

-- Functions for automatic slug generation
CREATE OR REPLACE FUNCTION generate_form_slug(form_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Create base slug from name
    base_slug := LOWER(REGEXP_REPLACE(
        REGEXP_REPLACE(form_name, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
    ));
    
    final_slug := base_slug;
    
    -- Check for uniqueness and append number if needed
    WHILE EXISTS (SELECT 1 FROM forms WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_fields_updated_at BEFORE UPDATE ON form_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_steps_updated_at BEFORE UPDATE ON form_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_submissions_updated_at BEFORE UPDATE ON form_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_analytics_updated_at BEFORE UPDATE ON form_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_webhooks_updated_at BEFORE UPDATE ON form_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_templates_updated_at BEFORE UPDATE ON form_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraint for form_fields step_id after form_steps table creation
ALTER TABLE form_fields 
ADD CONSTRAINT fk_form_fields_step_id 
FOREIGN KEY (step_id) REFERENCES form_steps(id) ON DELETE SET NULL;

-- Comments for documentation
COMMENT ON TABLE forms IS 'Main form definitions and metadata for Dynamic Form Builder module';
COMMENT ON TABLE form_fields IS 'Individual form fields with validation and conditional logic';
COMMENT ON TABLE form_steps IS 'Multi-step form configuration';
COMMENT ON TABLE form_submissions IS 'Form submission data and metadata';
COMMENT ON TABLE form_analytics IS 'Daily aggregated analytics for forms';
COMMENT ON TABLE form_webhooks IS 'Webhook configurations for form events';
COMMENT ON TABLE form_templates IS 'Reusable form templates';