-- Dynamic Forms Tables
-- Modified for XP backend integration with INTEGER user IDs

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: Forms
-- Main forms table for storing form definitions
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
    
    -- XP Integration - Link to existing users (INTEGER ID)
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
    help_text TEXT,
    default_value TEXT,
    is_required BOOLEAN DEFAULT false,
    validation_rules JSONB DEFAULT '{}',
    options JSONB, -- For select, radio, checkbox fields
    display_order INTEGER NOT NULL,
    step_id UUID, -- For multi-step forms
    conditional_logic JSONB, -- For conditional field display
    
    -- Field styling and layout
    css_classes VARCHAR(500),
    inline_styles JSONB,
    
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
    step_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    conditional_logic JSONB, -- Conditions for step visibility
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique step numbers per form
    UNIQUE(form_id, step_number)
);

-- Table: Form Submissions
-- Store form submission data
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    submission_data JSONB NOT NULL,
    
    -- Submitter information
    submitter_ip INET,
    submitter_user_agent TEXT,
    submitter_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- If authenticated user
    submitter_email VARCHAR(255),
    submitter_name VARCHAR(255),
    
    -- Status and processing
    status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('submitted', 'processing', 'completed', 'failed')),
    
    -- File attachments (references to file storage)
    attachments JSONB DEFAULT '[]',
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Form Analytics
-- Store form analytics and statistics
CREATE TABLE form_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    
    -- Analytics data
    views_count INTEGER DEFAULT 0,
    submissions_count INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2),
    avg_completion_time INTEGER, -- in seconds
    
    -- Time period for analytics
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    period_type VARCHAR(20) DEFAULT 'daily' CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    
    -- Detailed metrics
    field_analytics JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Form Webhooks
-- Store webhook configurations for forms
CREATE TABLE form_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    method VARCHAR(10) DEFAULT 'POST' CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH')),
    headers JSONB DEFAULT '{}',
    
    -- Webhook settings
    is_active BOOLEAN DEFAULT true,
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    
    -- Events that trigger webhook
    trigger_events TEXT[] DEFAULT ARRAY['form_submitted'],
    
    -- Authentication
    auth_type VARCHAR(50), -- 'none', 'basic', 'bearer', 'api_key'
    auth_config JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: Form Templates
-- Pre-built form templates
CREATE TABLE form_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    tags TEXT[],
    
    -- Template data
    template_data JSONB NOT NULL, -- Contains form fields, settings, etc.
    preview_image VARCHAR(500),
    
    -- Usage statistics
    usage_count INTEGER DEFAULT 0,
    
    -- Template metadata
    is_public BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_forms_owner_id ON forms(owner_id);
CREATE INDEX idx_forms_status ON forms(status);
CREATE INDEX idx_forms_slug ON forms(slug);
CREATE INDEX idx_forms_created_at ON forms(created_at);

CREATE INDEX idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX idx_form_fields_display_order ON form_fields(display_order);

CREATE INDEX idx_form_steps_form_id ON form_steps(form_id);
CREATE INDEX idx_form_steps_step_number ON form_steps(step_number);

CREATE INDEX idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_created_at ON form_submissions(created_at);
CREATE INDEX idx_form_submissions_submitter_id ON form_submissions(submitter_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);

CREATE INDEX idx_form_analytics_form_id ON form_analytics(form_id);
CREATE INDEX idx_form_analytics_period ON form_analytics(period_start, period_end);

CREATE INDEX idx_form_webhooks_form_id ON form_webhooks(form_id);
CREATE INDEX idx_form_webhooks_active ON form_webhooks(is_active);

CREATE INDEX idx_form_templates_category ON form_templates(category);
CREATE INDEX idx_form_templates_public ON form_templates(is_public);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

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