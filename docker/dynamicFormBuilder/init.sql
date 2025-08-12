-- Dynamic Form Builder Database Initialization Script

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For composite indexes

-- Create schema
CREATE SCHEMA IF NOT EXISTS formbuilder;

-- Set search path
SET search_path TO formbuilder, public;

-- Create custom types
CREATE TYPE form_status AS ENUM ('draft', 'active', 'inactive', 'archived');
CREATE TYPE field_type AS ENUM (
    'text', 
    'email', 
    'number', 
    'date', 
    'select', 
    'radio', 
    'checkbox', 
    'textarea', 
    'file_upload'
);

-- Forms table
CREATE TABLE IF NOT EXISTS forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    fields JSONB NOT NULL DEFAULT '[]',
    settings JSONB NOT NULL DEFAULT '{}',
    status form_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1,
    CONSTRAINT valid_fields CHECK (jsonb_typeof(fields) = 'array'),
    CONSTRAINT valid_settings CHECK (jsonb_typeof(settings) = 'object')
);

-- Form submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    submitted_by UUID,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    completion_time INTEGER, -- in seconds
    CONSTRAINT valid_data CHECK (jsonb_typeof(data) = 'object')
);

-- File uploads table
CREATE TABLE IF NOT EXISTS form_submission_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    field_key VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    path TEXT NOT NULL,
    thumbnail_path TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhooks table
CREATE TABLE IF NOT EXISTS form_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{"form.submitted"}',
    headers JSONB DEFAULT '{}',
    retry_count INTEGER DEFAULT 3,
    timeout INTEGER DEFAULT 30000, -- milliseconds
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhook logs table
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES form_webhooks(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES form_submissions(id) ON DELETE SET NULL,
    event VARCHAR(50) NOT NULL,
    status_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    attempt_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Form analytics table
CREATE TABLE IF NOT EXISTS form_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    starts INTEGER DEFAULT 0,
    completions INTEGER DEFAULT 0,
    abandons INTEGER DEFAULT 0,
    average_time INTEGER, -- seconds
    field_interactions JSONB DEFAULT '{}',
    device_breakdown JSONB DEFAULT '{}',
    UNIQUE(form_id, date)
);

-- Collaboration sessions table
CREATE TABLE IF NOT EXISTS collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    socket_id VARCHAR(255) UNIQUE,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    cursor_position JSONB,
    selected_field VARCHAR(255)
);

-- Form versions table (for version history)
CREATE TABLE IF NOT EXISTS form_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    fields JSONB NOT NULL,
    settings JSONB NOT NULL,
    changed_by UUID NOT NULL,
    change_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(form_id, version)
);

-- Create indexes
CREATE INDEX idx_forms_user_id ON forms(user_id);
CREATE INDEX idx_forms_status ON forms(status);
CREATE INDEX idx_forms_created_at ON forms(created_at DESC);
CREATE INDEX idx_forms_title_search ON forms USING gin(title gin_trgm_ops);

CREATE INDEX idx_submissions_form_id ON form_submissions(form_id);
CREATE INDEX idx_submissions_submitted_at ON form_submissions(submitted_at DESC);
CREATE INDEX idx_submissions_data ON form_submissions USING gin(data);

CREATE INDEX idx_files_submission_id ON form_submission_files(submission_id);
CREATE INDEX idx_files_field_key ON form_submission_files(field_key);

CREATE INDEX idx_webhooks_form_id ON form_webhooks(form_id);
CREATE INDEX idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

CREATE INDEX idx_analytics_form_date ON form_analytics(form_id, date DESC);
CREATE INDEX idx_collab_form_id ON collaboration_sessions(form_id);
CREATE INDEX idx_versions_form_id ON form_versions(form_id, version DESC);

-- Create update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON form_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON form_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create version trigger
CREATE OR REPLACE FUNCTION create_form_version()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.fields IS DISTINCT FROM NEW.fields OR OLD.settings IS DISTINCT FROM NEW.settings THEN
        INSERT INTO form_versions (form_id, version, fields, settings, changed_by)
        VALUES (NEW.id, NEW.version, OLD.fields, OLD.settings, NEW.user_id);
        
        NEW.version = NEW.version + 1;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER form_version_trigger BEFORE UPDATE ON forms
    FOR EACH ROW EXECUTE FUNCTION create_form_version();

-- Create analytics aggregation function
CREATE OR REPLACE FUNCTION update_form_analytics(
    p_form_id UUID,
    p_event_type VARCHAR(20),
    p_field_key VARCHAR(255) DEFAULT NULL,
    p_device_type VARCHAR(20) DEFAULT NULL,
    p_completion_time INTEGER DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_current_date DATE := CURRENT_DATE;
BEGIN
    INSERT INTO form_analytics (form_id, date, views, starts, completions, abandons)
    VALUES (p_form_id, v_current_date, 0, 0, 0, 0)
    ON CONFLICT (form_id, date) DO NOTHING;

    CASE p_event_type
        WHEN 'view' THEN
            UPDATE form_analytics 
            SET views = views + 1
            WHERE form_id = p_form_id AND date = v_current_date;
        WHEN 'start' THEN
            UPDATE form_analytics 
            SET starts = starts + 1
            WHERE form_id = p_form_id AND date = v_current_date;
        WHEN 'complete' THEN
            UPDATE form_analytics 
            SET completions = completions + 1,
                average_time = ((average_time * completions + p_completion_time) / (completions + 1))
            WHERE form_id = p_form_id AND date = v_current_date;
        WHEN 'abandon' THEN
            UPDATE form_analytics 
            SET abandons = abandons + 1
            WHERE form_id = p_form_id AND date = v_current_date;
    END CASE;

    -- Update field interactions if provided
    IF p_field_key IS NOT NULL THEN
        UPDATE form_analytics
        SET field_interactions = jsonb_set(
            COALESCE(field_interactions, '{}'::jsonb),
            ARRAY[p_field_key],
            (COALESCE(field_interactions->p_field_key, '0')::int + 1)::text::jsonb
        )
        WHERE form_id = p_form_id AND date = v_current_date;
    END IF;

    -- Update device breakdown if provided
    IF p_device_type IS NOT NULL THEN
        UPDATE form_analytics
        SET device_breakdown = jsonb_set(
            COALESCE(device_breakdown, '{}'::jsonb),
            ARRAY[p_device_type],
            (COALESCE(device_breakdown->p_device_type, '0')::int + 1)::text::jsonb
        )
        WHERE form_id = p_form_id AND date = v_current_date;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create cleanup function for old data
CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS void AS $$
BEGIN
    -- Delete old webhook logs (keep 30 days)
    DELETE FROM webhook_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Delete old collaboration sessions (keep 1 day)
    DELETE FROM collaboration_sessions WHERE last_activity < CURRENT_TIMESTAMP - INTERVAL '1 day';
    
    -- Archive old forms (soft delete after 1 year of inactivity)
    UPDATE forms 
    SET status = 'archived', deleted_at = CURRENT_TIMESTAMP
    WHERE status != 'archived' 
    AND updated_at < CURRENT_TIMESTAMP - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Create view for form statistics
CREATE OR REPLACE VIEW form_statistics AS
SELECT 
    f.id,
    f.title,
    f.status,
    f.created_at,
    COUNT(DISTINCT s.id) as total_submissions,
    COUNT(DISTINCT s.submitted_by) as unique_submitters,
    AVG(s.completion_time) as avg_completion_time,
    MAX(s.submitted_at) as last_submission_at,
    COALESCE(SUM(a.views), 0) as total_views,
    COALESCE(SUM(a.completions), 0) as total_completions,
    CASE 
        WHEN COALESCE(SUM(a.starts), 0) > 0 
        THEN ROUND((COALESCE(SUM(a.completions), 0)::DECIMAL / SUM(a.starts)) * 100, 2)
        ELSE 0 
    END as completion_rate
FROM forms f
LEFT JOIN form_submissions s ON f.id = s.form_id
LEFT JOIN form_analytics a ON f.id = a.form_id
WHERE f.deleted_at IS NULL
GROUP BY f.id, f.title, f.status, f.created_at;

-- Grant permissions
GRANT ALL ON SCHEMA formbuilder TO formbuilder;
GRANT ALL ON ALL TABLES IN SCHEMA formbuilder TO formbuilder;
GRANT ALL ON ALL SEQUENCES IN SCHEMA formbuilder TO formbuilder;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA formbuilder TO formbuilder;