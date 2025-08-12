-- Migration: 005_security_audit
-- Description: Add security and audit features
-- Author: Dynamic Form Builder Module
-- Date: 2024-01-05

SET search_path TO formbuilder, public;

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Security settings table
CREATE TABLE IF NOT EXISTS form_security_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    require_authentication BOOLEAN DEFAULT false,
    allowed_domains TEXT[],
    ip_whitelist INET[],
    ip_blacklist INET[],
    rate_limit_per_minute INTEGER DEFAULT 60,
    captcha_enabled BOOLEAN DEFAULT false,
    captcha_threshold DECIMAL DEFAULT 0.5,
    honeypot_enabled BOOLEAN DEFAULT true,
    csrf_protection BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(form_id)
);

-- Submission attempt tracking
CREATE TABLE IF NOT EXISTS submission_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempt_type VARCHAR(20) NOT NULL, -- 'submit', 'view', 'start'
    success BOOLEAN DEFAULT false,
    error_code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_security_settings_form_id ON form_security_settings(form_id);

CREATE INDEX IF NOT EXISTS idx_submission_attempts_form_id ON submission_attempts(form_id);
CREATE INDEX IF NOT EXISTS idx_submission_attempts_ip ON submission_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_submission_attempts_created_at ON submission_attempts(created_at DESC);

-- Add update trigger to security settings
CREATE TRIGGER update_security_settings_updated_at BEFORE UPDATE ON form_security_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create audit log function
CREATE OR REPLACE FUNCTION create_audit_log(
    p_user_id UUID,
    p_action VARCHAR(50),
    p_entity_type VARCHAR(50),
    p_entity_id UUID,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, 
        old_data, new_data, ip_address, user_agent
    ) VALUES (
        p_user_id, p_action, p_entity_type, p_entity_id,
        p_old_data, p_new_data, p_ip_address, p_user_agent
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- Create audit trigger for forms
CREATE OR REPLACE FUNCTION audit_form_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM create_audit_log(
            NEW.user_id,
            'create',
            'form',
            NEW.id,
            NULL,
            row_to_json(NEW)::jsonb
        );
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM create_audit_log(
            NEW.user_id,
            'update',
            'form',
            NEW.id,
            row_to_json(OLD)::jsonb,
            row_to_json(NEW)::jsonb
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM create_audit_log(
            OLD.user_id,
            'delete',
            'form',
            OLD.id,
            row_to_json(OLD)::jsonb,
            NULL
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_forms_trigger
AFTER INSERT OR UPDATE OR DELETE ON forms
FOR EACH ROW EXECUTE FUNCTION audit_form_changes();

-- Create function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_form_id UUID,
    p_ip_address INET,
    p_window_minutes INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
    v_attempt_count INTEGER;
    v_rate_limit INTEGER;
BEGIN
    -- Get rate limit for form
    SELECT rate_limit_per_minute INTO v_rate_limit
    FROM form_security_settings
    WHERE form_id = p_form_id;
    
    -- Use default if not set
    IF v_rate_limit IS NULL THEN
        v_rate_limit := 60;
    END IF;
    
    -- Count recent attempts
    SELECT COUNT(*) INTO v_attempt_count
    FROM submission_attempts
    WHERE form_id = p_form_id
    AND ip_address = p_ip_address
    AND created_at > CURRENT_TIMESTAMP - (p_window_minutes || ' minutes')::INTERVAL;
    
    RETURN v_attempt_count < v_rate_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function to check IP restrictions
CREATE OR REPLACE FUNCTION check_ip_restrictions(
    p_form_id UUID,
    p_ip_address INET
) RETURNS BOOLEAN AS $$
DECLARE
    v_whitelist INET[];
    v_blacklist INET[];
BEGIN
    -- Get IP restrictions
    SELECT ip_whitelist, ip_blacklist 
    INTO v_whitelist, v_blacklist
    FROM form_security_settings
    WHERE form_id = p_form_id;
    
    -- Check blacklist first
    IF v_blacklist IS NOT NULL AND array_length(v_blacklist, 1) > 0 THEN
        IF p_ip_address = ANY(v_blacklist) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Check whitelist
    IF v_whitelist IS NOT NULL AND array_length(v_whitelist, 1) > 0 THEN
        RETURN p_ip_address = ANY(v_whitelist);
    END IF;
    
    -- No restrictions
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create view for security analytics
CREATE OR REPLACE VIEW security_analytics AS
SELECT 
    f.id as form_id,
    f.title as form_title,
    COUNT(DISTINCT sa.ip_address) as unique_ips,
    COUNT(sa.id) as total_attempts,
    COUNT(CASE WHEN sa.success THEN 1 END) as successful_attempts,
    COUNT(CASE WHEN NOT sa.success THEN 1 END) as failed_attempts,
    COUNT(DISTINCT CASE WHEN sa.error_code = 'rate_limit' THEN sa.ip_address END) as rate_limited_ips,
    COUNT(DISTINCT CASE WHEN sa.error_code = 'ip_blocked' THEN sa.ip_address END) as blocked_ips,
    MAX(sa.created_at) as last_attempt_at
FROM forms f
LEFT JOIN submission_attempts sa ON f.id = sa.form_id
WHERE sa.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY f.id, f.title;