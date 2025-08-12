-- Migration: 002_webhooks_analytics
-- Description: Add webhooks and analytics tables
-- Author: Dynamic Form Builder Module
-- Date: 2024-01-02

SET search_path TO formbuilder, public;

-- Webhooks table
CREATE TABLE IF NOT EXISTS form_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{form.submitted}',
    headers JSONB DEFAULT '{}',
    retry_count INTEGER DEFAULT 3,
    timeout INTEGER DEFAULT 30000,
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
    average_time INTEGER,
    field_interactions JSONB DEFAULT '{}',
    device_breakdown JSONB DEFAULT '{}',
    UNIQUE(form_id, date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_webhooks_form_id ON form_webhooks(form_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_form_date ON form_analytics(form_id, date DESC);

-- Add update trigger to webhooks
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON form_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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