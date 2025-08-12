-- =====================================================
-- Notification System Database Schema
-- Migration: 019_create_notification_tables.sql
-- Created: 2025-01-12
-- Purpose: Complete notification system with enterprise features
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. NOTIFICATIONS TABLE (Core notification data)
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'system', 'security', 'account', 'transaction', 
        'comment', 'form', 'submission', 'collaboration',
        'reminder', 'announcement', 'marketing', 'custom'
    )),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN (
        'low', 'medium', 'high', 'critical'
    )),
    
    -- Content fields
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    html_body TEXT,
    
    -- Delivery configuration
    channels JSONB NOT NULL DEFAULT '["in-app"]'::jsonb,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'queued', 'sending', 'sent', 'delivered', 'failed', 'cancelled'
    )),
    
    -- Metadata and context
    metadata JSONB DEFAULT '{}'::jsonb,
    source VARCHAR(100) NOT NULL DEFAULT 'system',
    correlation_id UUID,
    
    -- Grouping and batching
    group_id UUID,
    batch_id UUID,
    
    -- Scheduling
    scheduled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    
    -- Delivery tracking
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- User interaction tracking
    read_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    
    -- Error handling
    error_message TEXT,
    
    -- Audit timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    
    -- Foreign key constraints
    CONSTRAINT fk_notifications_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Indexes for notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_group_id ON notifications(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_batch_id ON notifications(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_correlation_id ON notifications(correlation_id) WHERE correlation_id IS NOT NULL;

-- GIN index for metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_notifications_metadata ON notifications USING GIN(metadata) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_channels ON notifications USING GIN(channels) WHERE deleted_at IS NULL;

-- =====================================================
-- 2. NOTIFICATION_PREFERENCES TABLE (User preferences)
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id UUID PRIMARY KEY,
    
    -- Channel preferences
    channels JSONB NOT NULL DEFAULT '{
        "email": true,
        "sms": false, 
        "push": true,
        "in-app": true
    }'::jsonb,
    
    -- Notification type preferences
    types JSONB NOT NULL DEFAULT '{
        "system": true,
        "security": true,
        "account": true,
        "transaction": true,
        "comment": true,
        "form": true,
        "submission": true,
        "collaboration": true,
        "reminder": true,
        "announcement": true,
        "marketing": false,
        "custom": true
    }'::jsonb,
    
    -- Frequency settings
    frequency JSONB NOT NULL DEFAULT '{
        "email": "immediate",
        "push": "immediate",
        "sms": "immediate"
    }'::jsonb,
    
    -- Quiet hours configuration
    quiet_hours JSONB DEFAULT '{
        "enabled": false,
        "start": "22:00",
        "end": "08:00",
        "timezone": "Asia/Ho_Chi_Minh"
    }'::jsonb,
    
    -- Localization
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh',
    
    -- Advanced settings
    digest_enabled BOOLEAN DEFAULT false,
    digest_frequency VARCHAR(20) DEFAULT 'daily' CHECK (digest_frequency IN (
        'hourly', 'daily', 'weekly'
    )),
    
    -- Audit timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_notification_preferences_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Indexes for notification_preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_language ON notification_preferences(language);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_timezone ON notification_preferences(timezone);

-- GIN indexes for JSONB preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_channels ON notification_preferences USING GIN(channels);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_types ON notification_preferences USING GIN(types);

-- =====================================================
-- 3. NOTIFICATION_EVENTS TABLE (Analytics and tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core identifiers
    notification_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Event tracking
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN (
        'queued', 'sent', 'delivered', 'opened', 'clicked', 'dismissed', 'failed'
    )),
    
    -- Channel and context
    channel VARCHAR(20) NOT NULL CHECK (channel IN (
        'email', 'sms', 'push', 'in-app', 'webhook'
    )),
    
    -- Event metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- User context
    user_agent TEXT,
    ip_address INET,
    device_type VARCHAR(50),
    
    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Timestamp
    event_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_notification_events_notification
        FOREIGN KEY (notification_id) 
        REFERENCES notifications(id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_notification_events_user
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Indexes for notification_events
CREATE INDEX IF NOT EXISTS idx_notification_events_notification_id ON notification_events(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_user_id ON notification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_type ON notification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_events_channel ON notification_events(channel);
CREATE INDEX IF NOT EXISTS idx_notification_events_timestamp ON notification_events(event_timestamp DESC);

-- Composite indexes for analytics
CREATE INDEX IF NOT EXISTS idx_notification_events_user_type_timestamp 
    ON notification_events(user_id, event_type, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notification_events_notification_channel 
    ON notification_events(notification_id, channel);

-- GIN index for metadata
CREATE INDEX IF NOT EXISTS idx_notification_events_metadata ON notification_events USING GIN(metadata);

-- =====================================================
-- 4. NOTIFICATION_TEMPLATES TABLE (Template management)
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Template identification
    template_key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Template categorization
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'system', 'security', 'account', 'transaction', 
        'comment', 'form', 'submission', 'collaboration',
        'reminder', 'announcement', 'marketing', 'custom'
    )),
    
    -- Supported channels
    channels JSONB NOT NULL DEFAULT '["in-app"]'::jsonb,
    
    -- Template content
    subject_template VARCHAR(255),
    title_template VARCHAR(255),
    body_template TEXT NOT NULL,
    html_template TEXT,
    
    -- Template variables
    variables JSONB DEFAULT '[]'::jsonb,
    default_values JSONB DEFAULT '{}'::jsonb,
    
    -- Localization support
    locale VARCHAR(10) DEFAULT 'en',
    localization JSONB DEFAULT '{}'::jsonb,
    
    -- Template metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Status and versioning
    active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,
    
    -- Audit fields
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_notification_templates_created_by
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

-- Indexes for notification_templates
CREATE INDEX IF NOT EXISTS idx_notification_templates_key ON notification_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(active);
CREATE INDEX IF NOT EXISTS idx_notification_templates_locale ON notification_templates(locale);

-- GIN indexes for JSONB fields
CREATE INDEX IF NOT EXISTS idx_notification_templates_channels ON notification_templates USING GIN(channels);
CREATE INDEX IF NOT EXISTS idx_notification_templates_variables ON notification_templates USING GIN(variables);

-- =====================================================
-- 5. NOTIFICATION_DELIVERY_LOG (Delivery tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core identifiers
    notification_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Delivery details
    channel VARCHAR(20) NOT NULL CHECK (channel IN (
        'email', 'sms', 'push', 'in-app', 'webhook'
    )),
    
    -- Provider information
    provider VARCHAR(50),
    provider_message_id VARCHAR(255),
    
    -- Status tracking
    status VARCHAR(20) NOT NULL CHECK (status IN (
        'pending', 'sending', 'sent', 'delivered', 'failed', 'bounced'
    )),
    
    -- Delivery metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Error handling
    error_code VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    attempted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMPTZ,
    
    -- Foreign key constraints
    CONSTRAINT fk_notification_delivery_notification
        FOREIGN KEY (notification_id) 
        REFERENCES notifications(id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_notification_delivery_user
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Indexes for notification_delivery_log
CREATE INDEX IF NOT EXISTS idx_notification_delivery_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_user_id ON notification_delivery_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_channel ON notification_delivery_log(channel);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_status ON notification_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_attempted_at ON notification_delivery_log(attempted_at DESC);

-- =====================================================
-- 6. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER trigger_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER trigger_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_updated_at();

-- Function to create default preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default preferences when user is created
CREATE TRIGGER trigger_create_default_notification_preferences
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();

-- =====================================================
-- 7. VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for unread notifications with user details
CREATE OR REPLACE VIEW unread_notifications_view AS
SELECT 
    n.id,
    n.user_id,
    u.name as user_name,
    u.email as user_email,
    n.type,
    n.priority,
    n.title,
    n.message,
    n.channels,
    n.metadata,
    n.created_at,
    COUNT(*) OVER (PARTITION BY n.user_id) as total_unread
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.read_at IS NULL 
    AND n.deleted_at IS NULL
    AND n.status IN ('sent', 'delivered')
ORDER BY n.created_at DESC;

-- View for notification analytics
CREATE OR REPLACE VIEW notification_analytics_view AS
SELECT 
    DATE_TRUNC('day', n.created_at) as date,
    n.type,
    n.priority,
    COUNT(*) as total_sent,
    COUNT(n.delivered_at) as total_delivered,
    COUNT(n.read_at) as total_read,
    COUNT(n.clicked_at) as total_clicked,
    ROUND(
        COUNT(n.delivered_at)::decimal / COUNT(*) * 100, 2
    ) as delivery_rate,
    ROUND(
        COUNT(n.read_at)::decimal / COUNT(n.delivered_at) * 100, 2
    ) as open_rate,
    ROUND(
        COUNT(n.clicked_at)::decimal / COUNT(n.read_at) * 100, 2
    ) as click_rate
FROM notifications n
WHERE n.deleted_at IS NULL
GROUP BY DATE_TRUNC('day', n.created_at), n.type, n.priority
ORDER BY date DESC, n.type;

-- View for user notification preferences with defaults
CREATE OR REPLACE VIEW user_notification_preferences_view AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    COALESCE(np.channels, '{
        "email": true,
        "sms": false,
        "push": true,
        "in-app": true
    }'::jsonb) as channels,
    COALESCE(np.types, '{
        "system": true,
        "security": true,
        "account": true,
        "transaction": true,
        "comment": true,
        "form": true,
        "submission": true,
        "collaboration": true,
        "reminder": true,
        "announcement": true,
        "marketing": false,
        "custom": true
    }'::jsonb) as types,
    COALESCE(np.frequency, '{
        "email": "immediate",
        "push": "immediate",
        "sms": "immediate"
    }'::jsonb) as frequency,
    COALESCE(np.quiet_hours, '{
        "enabled": false,
        "start": "22:00",
        "end": "08:00",
        "timezone": "Asia/Ho_Chi_Minh"
    }'::jsonb) as quiet_hours,
    COALESCE(np.language, 'en') as language,
    COALESCE(np.timezone, 'Asia/Ho_Chi_Minh') as timezone,
    COALESCE(np.created_at, u.created_at) as preferences_created_at
FROM users u
LEFT JOIN notification_preferences np ON u.id = np.user_id;

-- =====================================================
-- 8. DEFAULT DATA INSERTION
-- =====================================================

-- Insert default notification templates
INSERT INTO notification_templates (template_key, name, type, channels, title_template, body_template, variables) VALUES
('welcome', 'Welcome Notification', 'system', '["in-app", "email"]', 'Welcome to {{app_name}}!', 'Hi {{user_name}}, welcome to {{app_name}}. We are excited to have you on board!', '["user_name", "app_name"]'),
('password_reset', 'Password Reset', 'security', '["email"]', 'Password Reset Request', 'Hi {{user_name}}, you have requested to reset your password. Click the link to proceed: {{reset_link}}', '["user_name", "reset_link"]'),
('form_submitted', 'Form Submission', 'form', '["in-app", "email"]', 'New Form Submission', 'A new form "{{form_name}}" has been submitted by {{user_name}}.', '["form_name", "user_name"]'),
('comment_mention', 'Comment Mention', 'comment', '["in-app", "push"]', 'You were mentioned in a comment', '{{user_name}} mentioned you in a comment: "{{comment_text}}"', '["user_name", "comment_text"]'),
('system_maintenance', 'System Maintenance', 'announcement', '["in-app", "email"]', 'Scheduled Maintenance', 'System will be under maintenance from {{start_time}} to {{end_time}}.', '["start_time", "end_time"]')
ON CONFLICT (template_key) DO NOTHING;

-- =====================================================
-- 9. PERFORMANCE OPTIMIZATION
-- =====================================================

-- Analyze tables for better query planning
ANALYZE notifications;
ANALYZE notification_preferences;
ANALYZE notification_events;
ANALYZE notification_templates;
ANALYZE notification_delivery_log;

-- =====================================================
-- 10. COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE notifications IS 'Core notification data with enterprise features including scheduling, grouping, and delivery tracking';
COMMENT ON TABLE notification_preferences IS 'User-specific notification preferences with channel, type, and frequency controls';
COMMENT ON TABLE notification_events IS 'Analytics and event tracking for notification delivery and user interactions';
COMMENT ON TABLE notification_templates IS 'Template management system with localization and versioning support';
COMMENT ON TABLE notification_delivery_log IS 'Detailed delivery tracking per channel with provider information';

COMMENT ON COLUMN notifications.channels IS 'JSONB array of delivery channels: ["email", "sms", "push", "in-app"]';
COMMENT ON COLUMN notifications.metadata IS 'Flexible JSONB field for storing notification-specific data';
COMMENT ON COLUMN notification_preferences.quiet_hours IS 'JSONB configuration for do-not-disturb periods with timezone support';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 019_create_notification_tables.sql completed successfully';
    RAISE NOTICE 'Created tables: notifications, notification_preferences, notification_events, notification_templates, notification_delivery_log';
    RAISE NOTICE 'Created indexes: 25 indexes for optimal query performance';
    RAISE NOTICE 'Created views: 3 views for common notification queries';
    RAISE NOTICE 'Created triggers: 4 triggers for automatic timestamp updates and default preferences';
    RAISE NOTICE 'Inserted templates: 5 default notification templates';
END $$;