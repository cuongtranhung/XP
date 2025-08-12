# 🗄️ Dynamic Form Builder - Enhanced Database Design

## 📋 Table of Contents
- [Overview](#overview)
- [Enhanced Schema Design](#enhanced-schema-design)
- [Performance Optimizations](#performance-optimizations)
- [Security Enhancements](#security-enhancements)
- [Scalability Features](#scalability-features)
- [Data Integrity](#data-integrity)
- [Advanced Features](#advanced-features)
- [Migration Strategy](#migration-strategy)

---

## Overview

This document presents an enhanced database design for the Dynamic Form Builder system, incorporating world-class standards for performance, security, scalability, and maintainability.

### Key Improvements
- **UUID Primary Keys**: Better for distributed systems and security
- **Partitioning**: Optimized for high-volume submissions
- **JSONB Indexing**: Fast queries on JSON data
- **Materialized Views**: Pre-computed analytics
- **Row-Level Security**: Fine-grained access control
- **Event Sourcing**: Complete audit trail
- **Time-Series Data**: Optimized for analytics

---

## Enhanced Schema Design

### Core Tables with UUIDs and Optimizations

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enum types for better performance and validation
CREATE TYPE form_status AS ENUM ('draft', 'published', 'archived', 'deleted');
CREATE TYPE submission_status AS ENUM ('draft', 'submitted', 'processing', 'completed', 'rejected', 'archived');
CREATE TYPE field_type AS ENUM (
    'text', 'email', 'number', 'textarea', 'select', 'radio', 'checkbox',
    'date', 'time', 'datetime', 'file', 'phone', 'url', 'rating', 'switch',
    'color', 'range', 'hidden', 'section', 'heading', 'paragraph', 'signature',
    'location', 'matrix', 'repeater'
);
CREATE TYPE webhook_method AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');
CREATE TYPE webhook_status AS ENUM ('active', 'inactive', 'failed', 'suspended');

-- Organizations table for multi-tenancy
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    settings JSONB DEFAULT '{}',
    subscription_tier VARCHAR(50) DEFAULT 'free',
    storage_used BIGINT DEFAULT 0,
    storage_limit BIGINT DEFAULT 5368709120, -- 5GB default
    api_calls_used INTEGER DEFAULT 0,
    api_calls_limit INTEGER DEFAULT 10000,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_subscription ON organizations(subscription_tier);

-- Enhanced form definitions with better indexing
CREATE TABLE form_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    slug VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status form_status DEFAULT 'draft',
    version INTEGER DEFAULT 1,
    settings JSONB DEFAULT '{}',
    theme JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    category VARCHAR(100),
    visibility VARCHAR(50) DEFAULT 'private', -- private, team, public
    password_hash TEXT, -- For password-protected forms
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    submission_limit INTEGER,
    submission_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    UNIQUE(organization_id, slug),
    CONSTRAINT valid_dates CHECK (
        (start_date IS NULL OR end_date IS NULL) OR 
        (start_date < end_date)
    )
);

-- Comprehensive indexes for form_definitions
CREATE INDEX idx_forms_org_status ON form_definitions(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_forms_slug ON form_definitions(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_forms_status_published ON form_definitions(status, published_at) WHERE status = 'published';
CREATE INDEX idx_forms_tags ON form_definitions USING GIN(tags);
CREATE INDEX idx_forms_category ON form_definitions(category) WHERE category IS NOT NULL;
CREATE INDEX idx_forms_dates ON form_definitions(start_date, end_date) WHERE status = 'published';
CREATE INDEX idx_forms_search ON form_definitions USING GIN(
    to_tsvector('english', name || ' ' || COALESCE(description, ''))
);
CREATE INDEX idx_forms_settings ON form_definitions USING GIN(settings);

-- Enhanced form fields with better structure
CREATE TABLE form_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
    parent_field_id UUID REFERENCES form_fields(id) ON DELETE CASCADE, -- For nested fields
    field_key VARCHAR(255) NOT NULL,
    field_type field_type NOT NULL,
    label VARCHAR(255) NOT NULL,
    placeholder VARCHAR(255),
    help_text TEXT,
    default_value JSONB,
    position INTEGER NOT NULL,
    page_number INTEGER DEFAULT 1, -- For multi-page forms
    column_span INTEGER DEFAULT 12, -- Grid system (1-12)
    required BOOLEAN DEFAULT FALSE,
    disabled BOOLEAN DEFAULT FALSE,
    hidden BOOLEAN DEFAULT FALSE,
    readonly BOOLEAN DEFAULT FALSE,
    validation_rules JSONB DEFAULT '{}',
    options JSONB DEFAULT '[]',
    conditional_logic JSONB DEFAULT '{}',
    calculation_logic JSONB DEFAULT '{}', -- For computed fields
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(form_id, field_key)
);

-- Optimized indexes for form fields
CREATE INDEX idx_fields_form_position ON form_fields(form_id, page_number, position);
CREATE INDEX idx_fields_type ON form_fields(field_type);
CREATE INDEX idx_fields_parent ON form_fields(parent_field_id) WHERE parent_field_id IS NOT NULL;
CREATE INDEX idx_fields_validation ON form_fields USING GIN(validation_rules);
CREATE INDEX idx_fields_conditional ON form_fields USING GIN(conditional_logic) WHERE conditional_logic != '{}';

-- Partitioned form submissions table for scalability
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL,
    form_version INTEGER NOT NULL,
    user_id UUID REFERENCES users(id),
    session_id UUID,
    submission_data JSONB NOT NULL,
    calculated_fields JSONB DEFAULT '{}',
    attachments JSONB DEFAULT '[]',
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    geo_location JSONB,
    referrer TEXT,
    utm_params JSONB,
    status submission_status DEFAULT 'submitted',
    score NUMERIC(5,2), -- For scored forms/quizzes
    metadata JSONB DEFAULT '{}',
    processing_notes TEXT,
    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ
) PARTITION BY RANGE (submitted_at);

-- Create monthly partitions
CREATE TABLE form_submissions_2024_01 PARTITION OF form_submissions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE form_submissions_2024_02 PARTITION OF form_submissions
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- Continue for other months...

-- Indexes on partitioned table
CREATE INDEX idx_submissions_form_id ON form_submissions(form_id, submitted_at DESC);
CREATE INDEX idx_submissions_user_id ON form_submissions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_submissions_status ON form_submissions(status, submitted_at DESC);
CREATE INDEX idx_submissions_session ON form_submissions(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_submissions_data ON form_submissions USING GIN(submission_data);

-- Enhanced templates with versioning
CREATE TABLE form_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100),
    description TEXT,
    thumbnail_url TEXT,
    template_data JSONB NOT NULL,
    use_count INTEGER DEFAULT 0,
    rating NUMERIC(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_category ON form_templates(category);
CREATE INDEX idx_templates_public ON form_templates(is_public, is_featured);
CREATE INDEX idx_templates_tags ON form_templates USING GIN(tags);
CREATE INDEX idx_templates_rating ON form_templates(rating DESC) WHERE is_public = true;

-- Webhooks with retry logic
CREATE TABLE form_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    method webhook_method DEFAULT 'POST',
    headers JSONB DEFAULT '{}',
    auth_type VARCHAR(50), -- basic, bearer, api_key, oauth2
    auth_config JSONB DEFAULT '{}', -- Encrypted
    events TEXT[] DEFAULT '{"submission.created"}',
    conditions JSONB DEFAULT '{}',
    payload_template JSONB,
    timeout_seconds INTEGER DEFAULT 30,
    retry_config JSONB DEFAULT '{"max_attempts": 3, "backoff_multiplier": 2}',
    status webhook_status DEFAULT 'active',
    last_triggered_at TIMESTAMPTZ,
    last_status_code INTEGER,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhooks_form_status ON form_webhooks(form_id, status);
CREATE INDEX idx_webhooks_events ON form_webhooks USING GIN(events);

-- Webhook execution logs
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES form_webhooks(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES form_submissions(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    request_payload JSONB,
    request_headers JSONB,
    response_status INTEGER,
    response_body TEXT,
    response_headers JSONB,
    duration_ms INTEGER,
    attempt_number INTEGER DEFAULT 1,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_logs_webhook ON webhook_logs(webhook_id, created_at DESC);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(response_status, created_at DESC);

-- Form collaborators for team features
CREATE TABLE form_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- viewer, editor, admin
    permissions JSONB DEFAULT '{}',
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMPTZ,
    UNIQUE(form_id, user_id)
);

CREATE INDEX idx_collaborators_form ON form_collaborators(form_id);
CREATE INDEX idx_collaborators_user ON form_collaborators(user_id);

-- Form analytics events (time-series)
CREATE TABLE form_analytics_events (
    time TIMESTAMPTZ NOT NULL,
    form_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- view, start, submit, abandon, complete
    user_id UUID,
    session_id UUID,
    page_number INTEGER,
    field_id UUID,
    duration_ms INTEGER,
    device_type VARCHAR(50),
    browser VARCHAR(100),
    os VARCHAR(100),
    country_code CHAR(2),
    region VARCHAR(100),
    metadata JSONB DEFAULT '{}'
);

-- Create hypertable for time-series data (requires TimescaleDB)
-- SELECT create_hypertable('form_analytics_events', 'time');
-- CREATE INDEX idx_analytics_form_time ON form_analytics_events(form_id, time DESC);

-- Materialized view for form statistics
CREATE MATERIALIZED VIEW form_statistics AS
SELECT 
    fd.id,
    fd.organization_id,
    fd.name,
    fd.status,
    fd.created_at,
    fd.published_at,
    COUNT(DISTINCT fs.id) as total_submissions,
    COUNT(DISTINCT CASE WHEN fs.status = 'completed' THEN fs.id END) as completed_submissions,
    COUNT(DISTINCT fs.user_id) as unique_submitters,
    COUNT(DISTINCT fs.session_id) as unique_sessions,
    AVG(EXTRACT(EPOCH FROM (fs.completed_at - fs.submitted_at))) as avg_completion_time_seconds,
    COUNT(DISTINCT CASE WHEN fs.submitted_at >= NOW() - INTERVAL '24 hours' THEN fs.id END) as submissions_24h,
    COUNT(DISTINCT CASE WHEN fs.submitted_at >= NOW() - INTERVAL '7 days' THEN fs.id END) as submissions_7d,
    COUNT(DISTINCT CASE WHEN fs.submitted_at >= NOW() - INTERVAL '30 days' THEN fs.id END) as submissions_30d,
    COALESCE(
        (COUNT(DISTINCT CASE WHEN fs.status = 'completed' THEN fs.id END)::NUMERIC / 
         NULLIF(COUNT(DISTINCT fs.id), 0) * 100),
        0
    ) as completion_rate,
    MAX(fs.submitted_at) as last_submission_at,
    NOW() as calculated_at
FROM form_definitions fd
LEFT JOIN form_submissions fs ON fd.id = fs.form_id
WHERE fd.deleted_at IS NULL
GROUP BY fd.id, fd.organization_id, fd.name, fd.status, fd.created_at, fd.published_at;

CREATE UNIQUE INDEX idx_form_statistics_id ON form_statistics(id);
CREATE INDEX idx_form_statistics_org ON form_statistics(organization_id);

-- Audit log table for compliance
CREATE TABLE form_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- form, submission, template, webhook
    resource_id UUID NOT NULL,
    resource_name VARCHAR(255),
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_org_time ON form_audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_user ON form_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_resource ON form_audit_logs(resource_type, resource_id);

-- File attachments table
CREATE TABLE form_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    field_id UUID NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL,
    storage_provider VARCHAR(50) DEFAULT 's3', -- s3, azure, gcs, local
    cdn_url TEXT,
    thumbnail_url TEXT,
    virus_scan_status VARCHAR(50) DEFAULT 'pending', -- pending, clean, infected, error
    virus_scan_result JSONB,
    metadata JSONB DEFAULT '{}',
    uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_attachments_submission ON form_attachments(submission_id);
CREATE INDEX idx_attachments_scan_status ON form_attachments(virus_scan_status) WHERE virus_scan_status != 'clean';

-- Email notification queue
CREATE TABLE form_email_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES form_definitions(id),
    submission_id UUID REFERENCES form_submissions(id),
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    subject VARCHAR(255) NOT NULL,
    template_id VARCHAR(100) NOT NULL,
    template_data JSONB NOT NULL,
    priority INTEGER DEFAULT 5, -- 1-10, 1 being highest
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, sent, failed
    provider VARCHAR(50), -- sendgrid, ses, mailgun
    provider_message_id VARCHAR(255),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    send_after TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_queue_status ON form_email_queue(status, priority, send_after) WHERE status IN ('pending', 'failed');
CREATE INDEX idx_email_queue_form ON form_email_queue(form_id);
```

---

## Performance Optimizations

### 1. Partitioning Strategy

```sql
-- Automated partition management
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + interval '1 month';
    partition_name := 'form_submissions_' || to_char(start_date, 'YYYY_MM');
    
    -- Check if partition exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF form_submissions FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly execution
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('create-partition', '0 0 1 * *', 'SELECT create_monthly_partition()');
```

### 2. Query Optimization Functions

```sql
-- Optimized submission search
CREATE OR REPLACE FUNCTION search_submissions(
    p_form_id UUID,
    p_search_term TEXT DEFAULT NULL,
    p_status submission_status DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
) RETURNS TABLE (
    submission JSONB,
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_submissions AS (
        SELECT s.*
        FROM form_submissions s
        WHERE s.form_id = p_form_id
            AND (p_status IS NULL OR s.status = p_status)
            AND (p_start_date IS NULL OR s.submitted_at >= p_start_date)
            AND (p_end_date IS NULL OR s.submitted_at <= p_end_date)
            AND (p_search_term IS NULL OR 
                 s.submission_data @> jsonb_build_object('search', p_search_term) OR
                 s.submission_data::text ILIKE '%' || p_search_term || '%')
        ORDER BY s.submitted_at DESC
        LIMIT p_limit OFFSET p_offset
    ),
    total AS (
        SELECT COUNT(*) as cnt
        FROM form_submissions s
        WHERE s.form_id = p_form_id
            AND (p_status IS NULL OR s.status = p_status)
            AND (p_start_date IS NULL OR s.submitted_at >= p_start_date)
            AND (p_end_date IS NULL OR s.submitted_at <= p_end_date)
            AND (p_search_term IS NULL OR 
                 s.submission_data @> jsonb_build_object('search', p_search_term) OR
                 s.submission_data::text ILIKE '%' || p_search_term || '%')
    )
    SELECT 
        jsonb_build_object(
            'id', fs.id,
            'form_id', fs.form_id,
            'status', fs.status,
            'data', fs.submission_data,
            'submitted_at', fs.submitted_at,
            'user_id', fs.user_id
        ),
        t.cnt
    FROM filtered_submissions fs
    CROSS JOIN total t;
END;
$$ LANGUAGE plpgsql;
```

### 3. Caching Strategy

```sql
-- Redis integration for caching
CREATE TABLE cache_keys (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cache_expires ON cache_keys(expires_at);

-- Auto-cleanup expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM cache_keys WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;
```

---

## Security Enhancements

### 1. Row-Level Security (RLS)

```sql
-- Enable RLS on sensitive tables
ALTER TABLE form_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_webhooks ENABLE ROW LEVEL SECURITY;

-- Policies for form definitions
CREATE POLICY form_definitions_org_isolation ON form_definitions
    FOR ALL
    USING (organization_id = current_setting('app.current_org_id')::UUID);

CREATE POLICY form_definitions_public_read ON form_definitions
    FOR SELECT
    USING (visibility = 'public' AND status = 'published');

-- Policies for submissions
CREATE POLICY form_submissions_own_data ON form_submissions
    FOR ALL
    USING (
        user_id = current_setting('app.current_user_id')::UUID OR
        EXISTS (
            SELECT 1 FROM form_definitions fd
            WHERE fd.id = form_submissions.form_id
            AND fd.organization_id = current_setting('app.current_org_id')::UUID
        )
    );
```

### 2. Encryption Functions

```sql
-- Encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_encrypt(data, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_data::bytea, current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Data Anonymization

```sql
-- Anonymize old submissions
CREATE OR REPLACE FUNCTION anonymize_old_submissions()
RETURNS void AS $$
BEGIN
    UPDATE form_submissions
    SET 
        ip_address = '0.0.0.0'::inet,
        user_agent = 'ANONYMIZED',
        submission_data = jsonb_set(
            submission_data,
            '{email}',
            '"anonymized@example.com"'
        )
    WHERE submitted_at < CURRENT_TIMESTAMP - INTERVAL '2 years'
        AND status = 'completed';
END;
$$ LANGUAGE plpgsql;
```

---

## Scalability Features

### 1. Sharding Support

```sql
-- Hash-based sharding function
CREATE OR REPLACE FUNCTION get_shard_for_org(org_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN abs(hashtext(org_id::text)) % 4; -- 4 shards
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Foreign data wrapper setup for sharding
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Example shard connection
CREATE SERVER shard_1 FOREIGN DATA WRAPPER postgres_fdw
    OPTIONS (host 'shard1.example.com', port '5432', dbname 'formbuilder');
```

### 2. Read Replicas

```sql
-- Function to route read queries to replicas
CREATE OR REPLACE FUNCTION route_to_replica()
RETURNS void AS $$
BEGIN
    -- This would be handled at the application level
    -- Setting a flag for the connection pooler
    PERFORM set_config('app.use_replica', 'true', false);
END;
$$ LANGUAGE plpgsql;
```

---

## Data Integrity

### 1. Validation Triggers

```sql
-- Validate form field structure
CREATE OR REPLACE FUNCTION validate_form_field()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure field_key is valid
    IF NOT NEW.field_key ~ '^[a-z][a-z0-9_]*$' THEN
        RAISE EXCEPTION 'Invalid field_key format: %', NEW.field_key;
    END IF;
    
    -- Validate options for select/radio/checkbox
    IF NEW.field_type IN ('select', 'radio', 'checkbox') THEN
        IF NEW.options IS NULL OR jsonb_array_length(NEW.options) = 0 THEN
            RAISE EXCEPTION 'Options required for field type: %', NEW.field_type;
        END IF;
    END IF;
    
    -- Validate conditional logic structure
    IF NEW.conditional_logic IS NOT NULL AND NEW.conditional_logic != '{}' THEN
        IF NOT (NEW.conditional_logic ? 'action' AND NEW.conditional_logic ? 'conditions') THEN
            RAISE EXCEPTION 'Invalid conditional logic structure';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_form_field_trigger
    BEFORE INSERT OR UPDATE ON form_fields
    FOR EACH ROW
    EXECUTE FUNCTION validate_form_field();
```

### 2. Cascading Updates

```sql
-- Update submission count on new submission
CREATE OR REPLACE FUNCTION update_submission_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE form_definitions
        SET submission_count = submission_count + 1
        WHERE id = NEW.form_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE form_definitions
        SET submission_count = submission_count - 1
        WHERE id = OLD.form_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_submission_count_trigger
    AFTER INSERT OR DELETE ON form_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_submission_count();
```

---

## Advanced Features

### 1. Full-Text Search

```sql
-- Enhanced search with weights
CREATE OR REPLACE FUNCTION search_forms(
    p_org_id UUID,
    p_query TEXT,
    p_limit INT DEFAULT 20
) RETURNS TABLE (
    form_id UUID,
    name VARCHAR(255),
    description TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fd.id,
        fd.name,
        fd.description,
        ts_rank(
            setweight(to_tsvector('english', fd.name), 'A') ||
            setweight(to_tsvector('english', COALESCE(fd.description, '')), 'B') ||
            setweight(to_tsvector('english', COALESCE(array_to_string(fd.tags, ' '), '')), 'C'),
            plainto_tsquery('english', p_query)
        ) as rank
    FROM form_definitions fd
    WHERE fd.organization_id = p_org_id
        AND fd.deleted_at IS NULL
        AND (
            to_tsvector('english', fd.name || ' ' || COALESCE(fd.description, '') || ' ' || COALESCE(array_to_string(fd.tags, ' '), ''))
            @@ plainto_tsquery('english', p_query)
        )
    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

### 2. Analytics Aggregation

```sql
-- Real-time analytics view
CREATE OR REPLACE VIEW form_analytics_realtime AS
WITH time_buckets AS (
    SELECT 
        form_id,
        date_trunc('hour', submitted_at) as hour,
        COUNT(*) as submissions,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(EXTRACT(EPOCH FROM (completed_at - submitted_at))) as avg_completion_seconds
    FROM form_submissions
    WHERE submitted_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    GROUP BY form_id, date_trunc('hour', submitted_at)
),
conversion_funnel AS (
    SELECT 
        form_id,
        COUNT(*) FILTER (WHERE status = 'submitted') as started,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected
    FROM form_submissions
    WHERE submitted_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    GROUP BY form_id
)
SELECT 
    tb.form_id,
    fd.name as form_name,
    tb.hour,
    tb.submissions,
    tb.unique_users,
    tb.avg_completion_seconds,
    cf.started,
    cf.completed,
    cf.rejected,
    CASE 
        WHEN cf.started > 0 THEN (cf.completed::NUMERIC / cf.started * 100)
        ELSE 0 
    END as completion_rate
FROM time_buckets tb
JOIN form_definitions fd ON fd.id = tb.form_id
LEFT JOIN conversion_funnel cf ON cf.form_id = tb.form_id
ORDER BY tb.form_id, tb.hour DESC;
```

### 3. Export Functions

```sql
-- Export submissions to CSV
CREATE OR REPLACE FUNCTION export_submissions_csv(
    p_form_id UUID,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
) RETURNS TABLE (csv_line TEXT) AS $$
DECLARE
    v_headers TEXT;
    v_field_keys TEXT[];
BEGIN
    -- Get field keys for headers
    SELECT array_agg(field_key ORDER BY position)
    INTO v_field_keys
    FROM form_fields
    WHERE form_id = p_form_id;
    
    -- Create CSV headers
    v_headers := 'submission_id,submitted_at,status,' || array_to_string(v_field_keys, ',');
    
    -- Return headers
    csv_line := v_headers;
    RETURN NEXT;
    
    -- Return data rows
    RETURN QUERY
    SELECT 
        s.id::TEXT || ',' ||
        s.submitted_at::TEXT || ',' ||
        s.status::TEXT || ',' ||
        array_to_string(
            ARRAY(
                SELECT COALESCE(s.submission_data->>field_key, '')
                FROM unnest(v_field_keys) AS field_key
            ),
            ','
        )
    FROM form_submissions s
    WHERE s.form_id = p_form_id
        AND (p_start_date IS NULL OR s.submitted_at >= p_start_date)
        AND (p_end_date IS NULL OR s.submitted_at <= p_end_date)
    ORDER BY s.submitted_at DESC;
END;
$$ LANGUAGE plpgsql;
```

---

## Migration Strategy

### 1. Migration from Existing Schema

```sql
-- Migration script to convert existing data
BEGIN;

-- Create new tables with enhanced schema
-- ... (create all new tables as defined above)

-- Migrate organizations (create default if not multi-tenant)
INSERT INTO organizations (id, slug, name)
VALUES (uuid_generate_v4(), 'default', 'Default Organization');

-- Migrate form definitions
INSERT INTO form_definitions (
    id, organization_id, slug, name, description, status, version,
    settings, created_by, updated_by, created_at, updated_at,
    published_at, archived_at
)
SELECT 
    uuid_generate_v4(),
    (SELECT id FROM organizations WHERE slug = 'default'),
    slug,
    name,
    description,
    status::form_status,
    version,
    settings,
    created_by::UUID,
    updated_by::UUID,
    created_at,
    updated_at,
    published_at,
    archived_at
FROM form_definitions_old;

-- Create mapping table for ID conversion
CREATE TEMP TABLE id_mapping (
    old_id INTEGER,
    new_id UUID,
    table_name VARCHAR(50)
);

-- Store mappings
INSERT INTO id_mapping (old_id, new_id, table_name)
SELECT 
    old.id,
    new.id,
    'form_definitions'
FROM form_definitions_old old
JOIN form_definitions new ON old.slug = new.slug;

-- Migrate form fields
INSERT INTO form_fields (
    id, form_id, field_key, field_type, label, placeholder,
    help_text, default_value, position, required, disabled,
    hidden, validation_rules, options, conditional_logic,
    metadata, created_at, updated_at
)
SELECT 
    uuid_generate_v4(),
    m.new_id,
    f.field_key,
    f.field_type::field_type,
    f.label,
    f.placeholder,
    f.help_text,
    f.default_value::JSONB,
    f.position,
    f.required,
    f.disabled,
    f.hidden,
    f.validation_rules,
    f.options,
    f.conditional_logic,
    f.metadata,
    f.created_at,
    f.updated_at
FROM form_fields_old f
JOIN id_mapping m ON f.form_id = m.old_id AND m.table_name = 'form_definitions';

-- Continue for other tables...

COMMIT;
```

### 2. Rollback Plan

```sql
-- Rollback script
BEGIN;

-- Restore original tables from backup
-- ... (restore commands)

-- Drop new tables
DROP TABLE IF EXISTS form_attachments CASCADE;
DROP TABLE IF EXISTS form_email_queue CASCADE;
DROP TABLE IF EXISTS webhook_logs CASCADE;
DROP TABLE IF EXISTS form_webhooks CASCADE;
DROP TABLE IF EXISTS form_analytics_events CASCADE;
DROP TABLE IF EXISTS form_collaborators CASCADE;
DROP TABLE IF EXISTS form_submissions CASCADE;
DROP TABLE IF EXISTS form_fields CASCADE;
DROP TABLE IF EXISTS form_definitions CASCADE;
DROP TABLE IF EXISTS form_templates CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Drop new types
DROP TYPE IF EXISTS webhook_status CASCADE;
DROP TYPE IF EXISTS webhook_method CASCADE;
DROP TYPE IF EXISTS field_type CASCADE;
DROP TYPE IF EXISTS submission_status CASCADE;
DROP TYPE IF EXISTS form_status CASCADE;

COMMIT;
```

---

## Maintenance Procedures

### 1. Regular Maintenance Tasks

```sql
-- Vacuum and analyze tables
CREATE OR REPLACE FUNCTION maintenance_routine()
RETURNS void AS $$
BEGIN
    -- Vacuum analyze main tables
    VACUUM ANALYZE form_definitions;
    VACUUM ANALYZE form_submissions;
    VACUUM ANALYZE form_fields;
    
    -- Refresh materialized views
    REFRESH MATERIALIZED VIEW CONCURRENTLY form_statistics;
    
    -- Clean up old logs
    DELETE FROM webhook_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    DELETE FROM form_audit_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 year';
    
    -- Archive old submissions
    INSERT INTO form_submissions_archive
    SELECT * FROM form_submissions
    WHERE submitted_at < CURRENT_TIMESTAMP - INTERVAL '2 years'
        AND status = 'completed';
    
    DELETE FROM form_submissions
    WHERE submitted_at < CURRENT_TIMESTAMP - INTERVAL '2 years'
        AND status = 'completed';
END;
$$ LANGUAGE plpgsql;

-- Schedule maintenance
SELECT cron.schedule('maintenance', '0 2 * * 0', 'SELECT maintenance_routine()');
```

### 2. Performance Monitoring

```sql
-- Monitor slow queries
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time
FROM pg_stat_statements
WHERE mean_time > 100 -- queries averaging over 100ms
ORDER BY mean_time DESC
LIMIT 50;

-- Monitor table sizes
CREATE OR REPLACE VIEW table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Best Practices Summary

1. **Use UUIDs** for all primary keys for better distribution and security
2. **Implement partitioning** for high-volume tables like submissions
3. **Create appropriate indexes** including partial and GIN indexes for JSONB
4. **Use materialized views** for expensive aggregations
5. **Implement RLS** for multi-tenant security
6. **Regular maintenance** with automated vacuum and statistics updates
7. **Monitor performance** with pg_stat_statements and custom views
8. **Plan for scaling** with sharding support and read replicas
9. **Audit everything** for compliance and debugging
10. **Encrypt sensitive data** at rest and in transit