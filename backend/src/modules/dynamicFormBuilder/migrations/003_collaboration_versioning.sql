-- Migration: 003_collaboration_versioning
-- Description: Add collaboration and versioning support
-- Author: Dynamic Form Builder Module
-- Date: 2024-01-03

SET search_path TO formbuilder, public;

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
CREATE INDEX IF NOT EXISTS idx_collab_form_id ON collaboration_sessions(form_id);
CREATE INDEX IF NOT EXISTS idx_collab_user_id ON collaboration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_collab_last_activity ON collaboration_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_versions_form_id ON form_versions(form_id, version DESC);

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

-- Create cleanup function for old collaboration sessions
CREATE OR REPLACE FUNCTION cleanup_old_collaboration_sessions() RETURNS void AS $$
BEGIN
    DELETE FROM collaboration_sessions 
    WHERE last_activity < CURRENT_TIMESTAMP - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Create view for active collaborators
CREATE OR REPLACE VIEW active_collaborators AS
SELECT 
    cs.form_id,
    cs.user_id,
    cs.socket_id,
    cs.connected_at,
    cs.last_activity,
    cs.cursor_position,
    cs.selected_field,
    f.title as form_title
FROM collaboration_sessions cs
JOIN forms f ON cs.form_id = f.id
WHERE cs.last_activity > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
ORDER BY cs.last_activity DESC;