# 📝 Dynamic Form Builder Implementation Guide for XP Project

## 📋 Overview
This document provides complete implementation instructions for adding a Dynamic Form Builder module to the XP authentication system. The module allows administrators to create, manage, and deploy custom forms with various field types, validation rules, and conditional logic.

---

## 🎯 Features

### Core Features
- ✅ **Drag & Drop Form Builder**: Visual form designer
- ✅ **Multiple Field Types**: Text, Number, Email, Select, Radio, Checkbox, Date, File, etc.
- ✅ **Validation Rules**: Required, Min/Max, Regex, Custom validators
- ✅ **Conditional Logic**: Show/hide fields based on conditions
- ✅ **Form Templates**: Save and reuse form templates
- ✅ **Form Versioning**: Track form changes over time
- ✅ **Submission Management**: View and export form submissions
- ✅ **API Integration**: REST API for form rendering and submission

---

## 🏗️ Implementation Steps

### Step 1: Database Schema
Create file: `backend/migrations/012_create_dynamic_forms_tables.sql`

```sql
-- Migration: 012_create_dynamic_forms_tables.sql
-- Purpose: Create tables for Dynamic Form Builder system

-- Table for form definitions
CREATE TABLE form_definitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- draft, published, archived
    version INTEGER DEFAULT 1,
    settings JSONB DEFAULT '{}',
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_form_definitions_slug ON form_definitions(slug);
CREATE INDEX idx_form_definitions_status ON form_definitions(status);
CREATE INDEX idx_form_definitions_created_by ON form_definitions(created_by);

-- Table for form fields
CREATE TABLE form_fields (
    id SERIAL PRIMARY KEY,
    form_id INTEGER NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
    field_key VARCHAR(255) NOT NULL,
    field_type VARCHAR(50) NOT NULL, -- text, number, email, select, radio, checkbox, date, file, etc.
    label VARCHAR(255) NOT NULL,
    placeholder VARCHAR(255),
    help_text TEXT,
    default_value TEXT,
    position INTEGER NOT NULL,
    required BOOLEAN DEFAULT FALSE,
    disabled BOOLEAN DEFAULT FALSE,
    hidden BOOLEAN DEFAULT FALSE,
    validation_rules JSONB DEFAULT '{}',
    options JSONB DEFAULT '[]', -- For select, radio, checkbox
    conditional_logic JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(form_id, field_key)
);

CREATE INDEX idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX idx_form_fields_field_type ON form_fields(field_type);
CREATE INDEX idx_form_fields_position ON form_fields(form_id, position);

-- Table for form submissions
CREATE TABLE form_submissions (
    id SERIAL PRIMARY KEY,
    form_id INTEGER NOT NULL REFERENCES form_definitions(id),
    user_id INTEGER REFERENCES users(id),
    submission_data JSONB NOT NULL,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50) DEFAULT 'submitted', -- submitted, processing, completed, rejected
    metadata JSONB DEFAULT '{}',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_user_id ON form_submissions(user_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);
CREATE INDEX idx_form_submissions_submitted_at ON form_submissions(submitted_at DESC);

-- Table for form templates
CREATE TABLE form_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    template_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_form_templates_category ON form_templates(category);
CREATE INDEX idx_form_templates_created_by ON form_templates(created_by);

-- Table for form field types registry
CREATE TABLE form_field_types (
    id SERIAL PRIMARY KEY,
    type_key VARCHAR(50) UNIQUE NOT NULL,
    type_name VARCHAR(100) NOT NULL,
    icon VARCHAR(50),
    category VARCHAR(50),
    default_props JSONB DEFAULT '{}',
    validation_schema JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default field types
INSERT INTO form_field_types (type_key, type_name, icon, category, default_props) VALUES
('text', 'Text Input', 'type', 'basic', '{"placeholder": "Enter text..."}'),
('email', 'Email', 'mail', 'basic', '{"placeholder": "email@example.com"}'),
('number', 'Number', 'hash', 'basic', '{"placeholder": "Enter number..."}'),
('textarea', 'Textarea', 'align-left', 'basic', '{"rows": 4}'),
('select', 'Dropdown', 'chevron-down', 'basic', '{"placeholder": "Select an option..."}'),
('radio', 'Radio Group', 'circle', 'basic', '{}'),
('checkbox', 'Checkbox', 'check-square', 'basic', '{}'),
('date', 'Date Picker', 'calendar', 'date', '{}'),
('time', 'Time Picker', 'clock', 'date', '{}'),
('datetime', 'Date & Time', 'calendar-clock', 'date', '{}'),
('file', 'File Upload', 'upload', 'advanced', '{"accept": "*", "maxSize": 5242880}'),
('phone', 'Phone Number', 'phone', 'basic', '{"placeholder": "+1 (555) 000-0000"}'),
('url', 'URL', 'link', 'basic', '{"placeholder": "https://example.com"}'),
('rating', 'Rating', 'star', 'advanced', '{"max": 5}'),
('switch', 'Toggle Switch', 'toggle-left', 'basic', '{}'),
('color', 'Color Picker', 'palette', 'advanced', '{}'),
('range', 'Range Slider', 'sliders', 'advanced', '{"min": 0, "max": 100}'),
('hidden', 'Hidden Field', 'eye-off', 'advanced', '{}'),
('section', 'Section Break', 'layout', 'layout', '{}'),
('heading', 'Heading', 'heading', 'layout', '{"level": 3}'),
('paragraph', 'Paragraph', 'text', 'layout', '{}');

-- Table for form versions (history)
CREATE TABLE form_versions (
    id SERIAL PRIMARY KEY,
    form_id INTEGER NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    form_data JSONB NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    change_log TEXT,
    UNIQUE(form_id, version)
);

CREATE INDEX idx_form_versions_form_id ON form_versions(form_id);

-- Function to validate form submission data
CREATE OR REPLACE FUNCTION validate_form_submission(
    p_form_id INTEGER,
    p_submission_data JSONB
) RETURNS JSONB AS $$
DECLARE
    v_errors JSONB := '[]'::jsonb;
    v_field RECORD;
    v_field_value TEXT;
    v_error JSONB;
BEGIN
    -- Validate each field
    FOR v_field IN 
        SELECT * FROM form_fields 
        WHERE form_id = p_form_id 
        ORDER BY position
    LOOP
        v_field_value := p_submission_data->>(v_field.field_key);
        
        -- Check required fields
        IF v_field.required AND (v_field_value IS NULL OR v_field_value = '') THEN
            v_error := jsonb_build_object(
                'field', v_field.field_key,
                'message', v_field.label || ' is required'
            );
            v_errors := v_errors || v_error;
        END IF;
        
        -- Additional validation based on field type and rules
        -- This is simplified - extend as needed
    END LOOP;
    
    RETURN v_errors;
END;
$$ LANGUAGE plpgsql;

-- Function to create form version
CREATE OR REPLACE FUNCTION create_form_version()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.version != NEW.version THEN
        INSERT INTO form_versions (form_id, version, form_data, created_by)
        VALUES (
            NEW.id,
            NEW.version,
            jsonb_build_object(
                'name', NEW.name,
                'description', NEW.description,
                'settings', NEW.settings,
                'fields', (
                    SELECT jsonb_agg(row_to_json(f.*))
                    FROM form_fields f
                    WHERE f.form_id = NEW.id
                    ORDER BY f.position
                )
            ),
            NEW.updated_by
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER form_version_trigger
AFTER UPDATE ON form_definitions
FOR EACH ROW
EXECUTE FUNCTION create_form_version();

-- View for form statistics
CREATE VIEW form_statistics AS
SELECT 
    fd.id,
    fd.name,
    fd.status,
    COUNT(DISTINCT fs.id) as total_submissions,
    COUNT(DISTINCT CASE WHEN fs.submitted_at >= NOW() - INTERVAL '7 days' THEN fs.id END) as submissions_last_7_days,
    COUNT(DISTINCT CASE WHEN fs.submitted_at >= NOW() - INTERVAL '30 days' THEN fs.id END) as submissions_last_30_days,
    MAX(fs.submitted_at) as last_submission_at
FROM form_definitions fd
LEFT JOIN form_submissions fs ON fd.id = fs.form_id
GROUP BY fd.id, fd.name, fd.status;
```

### Step 2: Backend Models & Types
Create file: `backend/src/types/formBuilder.ts`

```typescript
export interface FormDefinition {
  id: number;
  name: string;
  slug: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  settings: FormSettings;
  createdBy?: number;
  updatedBy?: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  archivedAt?: Date;
}

export interface FormField {
  id: number;
  formId: number;
  fieldKey: string;
  fieldType: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  defaultValue?: any;
  position: number;
  required: boolean;
  disabled: boolean;
  hidden: boolean;
  validationRules: ValidationRules;
  options?: FieldOption[];
  conditionalLogic?: ConditionalLogic;
  metadata?: any;
}

export interface FormSettings {
  submitButtonText?: string;
  successMessage?: string;
  redirectUrl?: string;
  emailNotifications?: EmailNotificationSettings;
  webhooks?: WebhookSettings[];
  captchaEnabled?: boolean;
  allowMultipleSubmissions?: boolean;
  submissionLimit?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  customValidator?: string;
  messages?: {
    [key: string]: string;
  };
}

export interface FieldOption {
  label: string;
  value: string;
  selected?: boolean;
}

export interface ConditionalLogic {
  action: 'show' | 'hide' | 'enable' | 'disable';
  conditions: Condition[];
  logicType: 'all' | 'any';
}

export interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  value: any;
}

export interface FormSubmission {
  id: number;
  formId: number;
  userId?: number;
  submissionData: any;
  ipAddress?: string;
  userAgent?: string;
  status: 'submitted' | 'processing' | 'completed' | 'rejected';
  metadata?: any;
  submittedAt: Date;
  processedAt?: Date;
}

export interface FormTemplate {
  id: number;
  name: string;
  category?: string;
  description?: string;
  templateData: any;
  isPublic: boolean;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailNotificationSettings {
  enabled: boolean;
  recipients: string[];
  subject: string;
  includeSubmissionData: boolean;
}

export interface WebhookSettings {
  url: string;
  method: 'GET' | 'POST' | 'PUT';
  headers?: { [key: string]: string };
  includeSubmissionData: boolean;
}
```

### Step 3: Backend Service
Create file: `backend/src/services/formBuilderService.ts`

```typescript
import { getClient } from '../utils/database';
import { FormDefinition, FormField, FormSubmission, FormTemplate } from '../types/formBuilder';
import MinimalActivityLogger from './minimalActivityLogger';

export class FormBuilderService {
  /**
   * Create a new form
   */
  static async createForm(
    formData: Partial<FormDefinition>,
    userId: number,
    req?: any
  ): Promise<FormDefinition> {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Generate slug if not provided
      const slug = formData.slug || this.generateSlug(formData.name || 'untitled-form');
      
      // Check if slug exists
      const slugCheck = await client.query(
        'SELECT id FROM form_definitions WHERE slug = $1',
        [slug]
      );
      
      if (slugCheck.rows.length > 0) {
        throw new Error('Form with this slug already exists');
      }
      
      // Create form
      const result = await client.query(
        `INSERT INTO form_definitions 
         (name, slug, description, status, settings, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          formData.name || 'Untitled Form',
          slug,
          formData.description || null,
          formData.status || 'draft',
          JSON.stringify(formData.settings || {}),
          userId,
          userId
        ]
      );
      
      const form = result.rows[0];
      
      // Log activity
      if (req) {
        MinimalActivityLogger.logCustom(userId, req.sessionID, req, {
          actionType: 'CREATE_FORM',
          actionCategory: 'FORM_BUILDER',
          metadata: { formId: form.id, formName: form.name }
        });
      }
      
      await client.query('COMMIT');
      return form;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get form by ID or slug
   */
  static async getForm(
    identifier: number | string,
    includeFields: boolean = true
  ): Promise<FormDefinition & { fields?: FormField[] }> {
    const client = await getClient();
    
    try {
      let query = 'SELECT * FROM form_definitions WHERE ';
      let params = [];
      
      if (typeof identifier === 'number') {
        query += 'id = $1';
        params = [identifier];
      } else {
        query += 'slug = $1';
        params = [identifier];
      }
      
      const formResult = await client.query(query, params);
      
      if (formResult.rows.length === 0) {
        throw new Error('Form not found');
      }
      
      const form = formResult.rows[0];
      
      if (includeFields) {
        const fieldsResult = await client.query(
          'SELECT * FROM form_fields WHERE form_id = $1 ORDER BY position',
          [form.id]
        );
        form.fields = fieldsResult.rows;
      }
      
      return form;
      
    } finally {
      client.release();
    }
  }
  
  /**
   * Update form
   */
  static async updateForm(
    formId: number,
    updates: Partial<FormDefinition>,
    userId: number,
    req?: any
  ): Promise<FormDefinition> {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get current form
      const currentForm = await this.getForm(formId, false);
      
      // Increment version if publishing
      let version = currentForm.version;
      if (updates.status === 'published' && currentForm.status !== 'published') {
        version++;
      }
      
      // Update form
      const updateFields = [];
      const values = [];
      let paramCount = 1;
      
      const allowedFields = ['name', 'description', 'status', 'settings'];
      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          updateFields.push(`${field} = $${paramCount}`);
          values.push(field === 'settings' ? JSON.stringify(updates[field]) : updates[field]);
          paramCount++;
        }
      });
      
      if (updateFields.length > 0) {
        updateFields.push(`updated_by = $${paramCount}`);
        values.push(userId);
        paramCount++;
        
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        
        if (version !== currentForm.version) {
          updateFields.push(`version = $${paramCount}`);
          values.push(version);
          paramCount++;
        }
        
        if (updates.status === 'published') {
          updateFields.push(`published_at = CURRENT_TIMESTAMP`);
        } else if (updates.status === 'archived') {
          updateFields.push(`archived_at = CURRENT_TIMESTAMP`);
        }
        
        values.push(formId);
        
        const query = `
          UPDATE form_definitions 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;
        
        const result = await client.query(query, values);
        
        // Log activity
        if (req) {
          MinimalActivityLogger.logCustom(userId, req.sessionID, req, {
            actionType: 'UPDATE_FORM',
            actionCategory: 'FORM_BUILDER',
            metadata: { formId, updates }
          });
        }
        
        await client.query('COMMIT');
        return result.rows[0];
      }
      
      await client.query('COMMIT');
      return currentForm;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Add or update form field
   */
  static async upsertFormField(
    formId: number,
    fieldData: Partial<FormField>,
    userId: number
  ): Promise<FormField> {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      if (fieldData.id) {
        // Update existing field
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        
        const allowedFields = [
          'label', 'placeholder', 'help_text', 'default_value',
          'position', 'required', 'disabled', 'hidden',
          'validation_rules', 'options', 'conditional_logic', 'metadata'
        ];
        
        allowedFields.forEach(field => {
          if (fieldData[this.camelToSnake(field)] !== undefined) {
            updateFields.push(`${this.camelToSnake(field)} = $${paramCount}`);
            const value = ['validation_rules', 'options', 'conditional_logic', 'metadata'].includes(field)
              ? JSON.stringify(fieldData[this.camelToSnake(field)])
              : fieldData[this.camelToSnake(field)];
            values.push(value);
            paramCount++;
          }
        });
        
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(fieldData.id);
        
        const query = `
          UPDATE form_fields 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;
        
        const result = await client.query(query, values);
        await client.query('COMMIT');
        return result.rows[0];
        
      } else {
        // Create new field
        const result = await client.query(
          `INSERT INTO form_fields 
           (form_id, field_key, field_type, label, placeholder, help_text,
            default_value, position, required, disabled, hidden,
            validation_rules, options, conditional_logic, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING *`,
          [
            formId,
            fieldData.fieldKey || this.generateFieldKey(fieldData.label || ''),
            fieldData.fieldType || 'text',
            fieldData.label || 'Untitled Field',
            fieldData.placeholder || null,
            fieldData.helpText || null,
            fieldData.defaultValue || null,
            fieldData.position || 0,
            fieldData.required || false,
            fieldData.disabled || false,
            fieldData.hidden || false,
            JSON.stringify(fieldData.validationRules || {}),
            JSON.stringify(fieldData.options || []),
            JSON.stringify(fieldData.conditionalLogic || {}),
            JSON.stringify(fieldData.metadata || {})
          ]
        );
        
        await client.query('COMMIT');
        return result.rows[0];
      }
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Delete form field
   */
  static async deleteFormField(fieldId: number): Promise<void> {
    const client = await getClient();
    
    try {
      await client.query('DELETE FROM form_fields WHERE id = $1', [fieldId]);
    } finally {
      client.release();
    }
  }
  
  /**
   * Reorder form fields
   */
  static async reorderFormFields(
    formId: number,
    fieldOrders: { fieldId: number; position: number }[]
  ): Promise<void> {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      for (const order of fieldOrders) {
        await client.query(
          'UPDATE form_fields SET position = $1 WHERE id = $2 AND form_id = $3',
          [order.position, order.fieldId, formId]
        );
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Submit form
   */
  static async submitForm(
    formId: number,
    submissionData: any,
    userId?: number,
    req?: any
  ): Promise<FormSubmission> {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get form and validate it's published
      const form = await this.getForm(formId, true);
      if (form.status !== 'published') {
        throw new Error('Form is not published');
      }
      
      // Validate submission data
      const validationResult = await client.query(
        'SELECT validate_form_submission($1, $2) as errors',
        [formId, JSON.stringify(submissionData)]
      );
      
      const errors = validationResult.rows[0].errors;
      if (errors && errors.length > 0) {
        throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
      }
      
      // Create submission
      const result = await client.query(
        `INSERT INTO form_submissions 
         (form_id, user_id, submission_data, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          formId,
          userId || null,
          JSON.stringify(submissionData),
          req?.ip || null,
          req?.get('user-agent') || null,
          JSON.stringify({
            referrer: req?.get('referrer'),
            sessionId: req?.sessionID
          })
        ]
      );
      
      const submission = result.rows[0];
      
      // Process webhooks and notifications (async)
      if (form.settings?.webhooks) {
        this.processWebhooks(form, submission);
      }
      
      if (form.settings?.emailNotifications?.enabled) {
        this.sendEmailNotifications(form, submission);
      }
      
      // Log activity
      if (req && userId) {
        MinimalActivityLogger.logCustom(userId, req.sessionID, req, {
          actionType: 'SUBMIT_FORM',
          actionCategory: 'FORM_BUILDER',
          metadata: { formId, submissionId: submission.id }
        });
      }
      
      await client.query('COMMIT');
      return submission;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get form submissions
   */
  static async getFormSubmissions(
    formId: number,
    options: {
      userId?: number;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ submissions: FormSubmission[]; total: number }> {
    const client = await getClient();
    
    try {
      let query = 'SELECT * FROM form_submissions WHERE form_id = $1';
      let countQuery = 'SELECT COUNT(*) FROM form_submissions WHERE form_id = $1';
      const params: any[] = [formId];
      let paramCount = 2;
      
      if (options.userId) {
        query += ` AND user_id = $${paramCount}`;
        countQuery += ` AND user_id = $${paramCount}`;
        params.push(options.userId);
        paramCount++;
      }
      
      if (options.status) {
        query += ` AND status = $${paramCount}`;
        countQuery += ` AND status = $${paramCount}`;
        params.push(options.status);
        paramCount++;
      }
      
      if (options.startDate) {
        query += ` AND submitted_at >= $${paramCount}`;
        countQuery += ` AND submitted_at >= $${paramCount}`;
        params.push(options.startDate);
        paramCount++;
      }
      
      if (options.endDate) {
        query += ` AND submitted_at <= $${paramCount}`;
        countQuery += ` AND submitted_at <= $${paramCount}`;
        params.push(options.endDate);
        paramCount++;
      }
      
      // Get total count
      const countResult = await client.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);
      
      // Add pagination
      query += ' ORDER BY submitted_at DESC';
      
      if (options.limit) {
        query += ` LIMIT $${paramCount}`;
        params.push(options.limit);
        paramCount++;
      }
      
      if (options.offset) {
        query += ` OFFSET $${paramCount}`;
        params.push(options.offset);
      }
      
      const result = await client.query(query, params);
      
      return {
        submissions: result.rows,
        total
      };
      
    } finally {
      client.release();
    }
  }
  
  /**
   * Get form templates
   */
  static async getFormTemplates(
    category?: string,
    isPublic?: boolean
  ): Promise<FormTemplate[]> {
    const client = await getClient();
    
    try {
      let query = 'SELECT * FROM form_templates WHERE 1=1';
      const params: any[] = [];
      let paramCount = 1;
      
      if (category) {
        query += ` AND category = $${paramCount}`;
        params.push(category);
        paramCount++;
      }
      
      if (isPublic !== undefined) {
        query += ` AND is_public = $${paramCount}`;
        params.push(isPublic);
        paramCount++;
      }
      
      query += ' ORDER BY name';
      
      const result = await client.query(query, params);
      return result.rows;
      
    } finally {
      client.release();
    }
  }
  
  /**
   * Create form from template
   */
  static async createFormFromTemplate(
    templateId: number,
    formName: string,
    userId: number,
    req?: any
  ): Promise<FormDefinition> {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get template
      const templateResult = await client.query(
        'SELECT * FROM form_templates WHERE id = $1',
        [templateId]
      );
      
      if (templateResult.rows.length === 0) {
        throw new Error('Template not found');
      }
      
      const template = templateResult.rows[0];
      const templateData = template.template_data;
      
      // Create form from template
      const form = await this.createForm(
        {
          name: formName,
          description: templateData.description,
          settings: templateData.settings
        },
        userId,
        req
      );
      
      // Create fields from template
      if (templateData.fields && Array.isArray(templateData.fields)) {
        for (const fieldData of templateData.fields) {
          await this.upsertFormField(form.id, fieldData, userId);
        }
      }
      
      await client.query('COMMIT');
      return await this.getForm(form.id);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Helper methods
   */
  private static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now();
  }
  
  private static generateFieldKey(label: string): string {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      + '_' + Math.random().toString(36).substr(2, 5);
  }
  
  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
  
  private static async processWebhooks(form: FormDefinition, submission: FormSubmission): Promise<void> {
    // Implement webhook processing
    // This should be done asynchronously
  }
  
  private static async sendEmailNotifications(form: FormDefinition, submission: FormSubmission): Promise<void> {
    // Implement email notifications
    // This should be done asynchronously
  }
}
```

### Step 4: Backend Controller
Create file: `backend/src/controllers/formBuilderController.ts`

```typescript
import { Request, Response } from 'express';
import { FormBuilderService } from '../services/formBuilderService';
import { validationResult } from 'express-validator';

export class FormBuilderController {
  /**
   * Create new form
   */
  static async createForm(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }
      
      const userId = (req as any).userId;
      const form = await FormBuilderService.createForm(req.body, userId, req);
      
      res.status(201).json({
        success: true,
        message: 'Form created successfully',
        data: form
      });
      
    } catch (error: any) {
      console.error('Create form error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create form'
      });
    }
  }
  
  /**
   * Get form by ID or slug
   */
  static async getForm(req: Request, res: Response) {
    try {
      const identifier = req.params.id;
      const includeFields = req.query.includeFields !== 'false';
      
      const form = await FormBuilderService.getForm(
        isNaN(Number(identifier)) ? identifier : Number(identifier),
        includeFields
      );
      
      res.json({
        success: true,
        data: form
      });
      
    } catch (error: any) {
      console.error('Get form error:', error);
      res.status(error.message === 'Form not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to get form'
      });
    }
  }
  
  /**
   * Update form
   */
  static async updateForm(req: Request, res: Response) {
    try {
      const formId = Number(req.params.id);
      const userId = (req as any).userId;
      
      const form = await FormBuilderService.updateForm(
        formId,
        req.body,
        userId,
        req
      );
      
      res.json({
        success: true,
        message: 'Form updated successfully',
        data: form
      });
      
    } catch (error: any) {
      console.error('Update form error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update form'
      });
    }
  }
  
  /**
   * List forms
   */
  static async listForms(req: Request, res: Response) {
    try {
      const { status, createdBy, page = 1, limit = 20 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      
      const client = await (await import('../utils/database')).getClient();
      
      try {
        let query = 'SELECT * FROM form_definitions WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) FROM form_definitions WHERE 1=1';
        const params: any[] = [];
        let paramCount = 1;
        
        if (status) {
          query += ` AND status = $${paramCount}`;
          countQuery += ` AND status = $${paramCount}`;
          params.push(status);
          paramCount++;
        }
        
        if (createdBy) {
          query += ` AND created_by = $${paramCount}`;
          countQuery += ` AND created_by = $${paramCount}`;
          params.push(Number(createdBy));
          paramCount++;
        }
        
        const countResult = await client.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);
        
        query += ' ORDER BY created_at DESC';
        query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(Number(limit), offset);
        
        const result = await client.query(query, params);
        
        res.json({
          success: true,
          data: {
            forms: result.rows,
            pagination: {
              page: Number(page),
              limit: Number(limit),
              total,
              totalPages: Math.ceil(total / Number(limit))
            }
          }
        });
        
      } finally {
        client.release();
      }
      
    } catch (error: any) {
      console.error('List forms error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to list forms'
      });
    }
  }
  
  /**
   * Add/Update form field
   */
  static async upsertFormField(req: Request, res: Response) {
    try {
      const formId = Number(req.params.formId);
      const userId = (req as any).userId;
      
      const field = await FormBuilderService.upsertFormField(
        formId,
        req.body,
        userId
      );
      
      res.json({
        success: true,
        message: 'Field saved successfully',
        data: field
      });
      
    } catch (error: any) {
      console.error('Upsert field error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to save field'
      });
    }
  }
  
  /**
   * Delete form field
   */
  static async deleteFormField(req: Request, res: Response) {
    try {
      const fieldId = Number(req.params.fieldId);
      
      await FormBuilderService.deleteFormField(fieldId);
      
      res.json({
        success: true,
        message: 'Field deleted successfully'
      });
      
    } catch (error: any) {
      console.error('Delete field error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete field'
      });
    }
  }
  
  /**
   * Reorder form fields
   */
  static async reorderFormFields(req: Request, res: Response) {
    try {
      const formId = Number(req.params.formId);
      const { fieldOrders } = req.body;
      
      await FormBuilderService.reorderFormFields(formId, fieldOrders);
      
      res.json({
        success: true,
        message: 'Fields reordered successfully'
      });
      
    } catch (error: any) {
      console.error('Reorder fields error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reorder fields'
      });
    }
  }
  
  /**
   * Submit form
   */
  static async submitForm(req: Request, res: Response) {
    try {
      const formId = Number(req.params.formId);
      const userId = (req as any).userId || null;
      
      const submission = await FormBuilderService.submitForm(
        formId,
        req.body,
        userId,
        req
      );
      
      res.status(201).json({
        success: true,
        message: 'Form submitted successfully',
        data: submission
      });
      
    } catch (error: any) {
      console.error('Submit form error:', error);
      
      if (error.message.includes('Validation failed')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to submit form'
      });
    }
  }
  
  /**
   * Get form submissions
   */
  static async getFormSubmissions(req: Request, res: Response) {
    try {
      const formId = Number(req.params.formId);
      const { userId, status, startDate, endDate, page = 1, limit = 20 } = req.query;
      
      const result = await FormBuilderService.getFormSubmissions(formId, {
        userId: userId ? Number(userId) : undefined,
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: Number(limit),
        offset: (Number(page) - 1) * Number(limit)
      });
      
      res.json({
        success: true,
        data: {
          submissions: result.submissions,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: result.total,
            totalPages: Math.ceil(result.total / Number(limit))
          }
        }
      });
      
    } catch (error: any) {
      console.error('Get submissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get submissions'
      });
    }
  }
  
  /**
   * Get form templates
   */
  static async getFormTemplates(req: Request, res: Response) {
    try {
      const { category, isPublic } = req.query;
      
      const templates = await FormBuilderService.getFormTemplates(
        category as string,
        isPublic === 'true'
      );
      
      res.json({
        success: true,
        data: templates
      });
      
    } catch (error: any) {
      console.error('Get templates error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get templates'
      });
    }
  }
  
  /**
   * Create form from template
   */
  static async createFormFromTemplate(req: Request, res: Response) {
    try {
      const { templateId, formName } = req.body;
      const userId = (req as any).userId;
      
      const form = await FormBuilderService.createFormFromTemplate(
        templateId,
        formName,
        userId,
        req
      );
      
      res.status(201).json({
        success: true,
        message: 'Form created from template successfully',
        data: form
      });
      
    } catch (error: any) {
      console.error('Create from template error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create form from template'
      });
    }
  }
}
```

### Step 5: Backend Routes
Create file: `backend/src/routes/formBuilderRoutes.ts`

```typescript
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { FormBuilderController } from '../controllers/formBuilderController';
import authMiddleware from '../middleware/auth';
import adminMiddleware from '../middleware/admin';

const router = Router();

// Form validation
const formValidation = [
  body('name')
    .notEmpty()
    .withMessage('Form name is required')
    .isLength({ max: 255 })
    .withMessage('Form name too long'),
  body('slug')
    .optional()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description too long'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived'])
    .withMessage('Invalid status')
];

// Field validation
const fieldValidation = [
  body('fieldType')
    .notEmpty()
    .withMessage('Field type is required'),
  body('label')
    .notEmpty()
    .withMessage('Field label is required')
    .isLength({ max: 255 })
    .withMessage('Label too long'),
  body('fieldKey')
    .optional()
    .matches(/^[a-z0-9_]+$/)
    .withMessage('Field key must contain only lowercase letters, numbers, and underscores'),
  body('position')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Position must be a positive integer'),
  body('required')
    .optional()
    .isBoolean()
    .withMessage('Required must be boolean')
];

// All routes require authentication
router.use(authMiddleware);

// Form management routes (admin only)
router.post(
  '/forms',
  adminMiddleware,
  formValidation,
  FormBuilderController.createForm
);

router.get(
  '/forms',
  FormBuilderController.listForms
);

router.get(
  '/forms/:id',
  FormBuilderController.getForm
);

router.put(
  '/forms/:id',
  adminMiddleware,
  formValidation,
  FormBuilderController.updateForm
);

// Field management routes (admin only)
router.post(
  '/forms/:formId/fields',
  adminMiddleware,
  [
    param('formId').isInt().withMessage('Invalid form ID'),
    ...fieldValidation
  ],
  FormBuilderController.upsertFormField
);

router.put(
  '/forms/:formId/fields/:fieldId',
  adminMiddleware,
  [
    param('formId').isInt().withMessage('Invalid form ID'),
    param('fieldId').isInt().withMessage('Invalid field ID'),
    ...fieldValidation
  ],
  FormBuilderController.upsertFormField
);

router.delete(
  '/forms/:formId/fields/:fieldId',
  adminMiddleware,
  [
    param('formId').isInt().withMessage('Invalid form ID'),
    param('fieldId').isInt().withMessage('Invalid field ID')
  ],
  FormBuilderController.deleteFormField
);

router.post(
  '/forms/:formId/fields/reorder',
  adminMiddleware,
  [
    param('formId').isInt().withMessage('Invalid form ID'),
    body('fieldOrders').isArray().withMessage('Field orders must be an array'),
    body('fieldOrders.*.fieldId').isInt().withMessage('Invalid field ID'),
    body('fieldOrders.*.position').isInt({ min: 0 }).withMessage('Invalid position')
  ],
  FormBuilderController.reorderFormFields
);

// Form submission routes (public for published forms)
router.post(
  '/forms/:formId/submit',
  [
    param('formId').isInt().withMessage('Invalid form ID')
  ],
  FormBuilderController.submitForm
);

// Get submissions (admin only)
router.get(
  '/forms/:formId/submissions',
  adminMiddleware,
  [
    param('formId').isInt().withMessage('Invalid form ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Invalid page'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Invalid limit')
  ],
  FormBuilderController.getFormSubmissions
);

// Template routes
router.get(
  '/templates',
  FormBuilderController.getFormTemplates
);

router.post(
  '/templates/create-form',
  adminMiddleware,
  [
    body('templateId').isInt().withMessage('Template ID is required'),
    body('formName').notEmpty().withMessage('Form name is required')
  ],
  FormBuilderController.createFormFromTemplate
);

export default router;
```

### Step 6: Frontend Form Builder Component
Create file: `frontend/src/components/formBuilder/FormBuilder.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Type, Mail, Hash, AlignLeft, ChevronDown, Circle, CheckSquare,
  Calendar, Clock, Upload, Phone, Link, Star, ToggleLeft, Palette,
  Sliders, EyeOff, Layout, Heading, FileText, Plus, Settings,
  Trash2, Copy, Move, Save, Eye, X
} from 'lucide-react';

interface FieldType {
  id: string;
  type: string;
  name: string;
  icon: any;
  category: string;
  defaultProps: any;
}

interface FormField {
  id: string;
  fieldKey: string;
  fieldType: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options?: { label: string; value: string }[];
  validationRules?: any;
  conditionalLogic?: any;
}

interface FormDefinition {
  id?: number;
  name: string;
  description?: string;
  fields: FormField[];
  settings: any;
}

const fieldTypes: FieldType[] = [
  { id: 'text', type: 'text', name: 'Text Input', icon: Type, category: 'basic', defaultProps: {} },
  { id: 'email', type: 'email', name: 'Email', icon: Mail, category: 'basic', defaultProps: {} },
  { id: 'number', type: 'number', name: 'Number', icon: Hash, category: 'basic', defaultProps: {} },
  { id: 'textarea', type: 'textarea', name: 'Textarea', icon: AlignLeft, category: 'basic', defaultProps: { rows: 4 } },
  { id: 'select', type: 'select', name: 'Dropdown', icon: ChevronDown, category: 'basic', defaultProps: {} },
  { id: 'radio', type: 'radio', name: 'Radio Group', icon: Circle, category: 'basic', defaultProps: {} },
  { id: 'checkbox', type: 'checkbox', name: 'Checkbox', icon: CheckSquare, category: 'basic', defaultProps: {} },
  { id: 'date', type: 'date', name: 'Date', icon: Calendar, category: 'date', defaultProps: {} },
  { id: 'time', type: 'time', name: 'Time', icon: Clock, category: 'date', defaultProps: {} },
  { id: 'file', type: 'file', name: 'File Upload', icon: Upload, category: 'advanced', defaultProps: {} },
  { id: 'phone', type: 'phone', name: 'Phone', icon: Phone, category: 'basic', defaultProps: {} },
  { id: 'url', type: 'url', name: 'URL', icon: Link, category: 'basic', defaultProps: {} },
  { id: 'rating', type: 'rating', name: 'Rating', icon: Star, category: 'advanced', defaultProps: { max: 5 } },
  { id: 'switch', type: 'switch', name: 'Toggle', icon: ToggleLeft, category: 'basic', defaultProps: {} },
  { id: 'heading', type: 'heading', name: 'Heading', icon: Heading, category: 'layout', defaultProps: { level: 3 } },
  { id: 'paragraph', type: 'paragraph', name: 'Paragraph', icon: FileText, category: 'layout', defaultProps: {} },
];

const FieldTypeItem: React.FC<{ fieldType: FieldType }> = ({ fieldType }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'field',
    item: { fieldType },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const Icon = fieldType.icon;

  return (
    <div
      ref={drag}
      className={`p-3 bg-white border rounded-lg cursor-move transition-all ${
        isDragging ? 'opacity-50' : 'hover:border-blue-500'
      }`}
    >
      <div className="flex items-center space-x-2">
        <Icon className="h-4 w-4 text-gray-500" />
        <span className="text-sm">{fieldType.name}</span>
      </div>
    </div>
  );
};

const FormFieldItem: React.FC<{
  field: FormField;
  index: number;
  moveField: (dragIndex: number, hoverIndex: number) => void;
  onEdit: (field: FormField) => void;
  onDelete: (fieldId: string) => void;
}> = ({ field, index, moveField, onEdit, onDelete }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'form-field',
    item: { index },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const [, drop] = useDrop(() => ({
    accept: 'form-field',
    hover(item: { index: number }) {
      if (!drag) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      moveField(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  }));

  const fieldType = fieldTypes.find(ft => ft.type === field.fieldType);
  const Icon = fieldType?.icon || Type;

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`p-4 bg-white border rounded-lg mb-3 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <Icon className="h-4 w-4 text-gray-500" />
            <span className="font-medium">{field.label}</span>
            {field.required && <span className="text-red-500">*</span>}
          </div>
          {field.helpText && (
            <p className="text-sm text-gray-600">{field.helpText}</p>
          )}
          <div className="mt-2">
            {renderFieldPreview(field)}
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={() => onEdit(field)}
            className="p-1 text-gray-500 hover:text-blue-600"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(field.id)}
            className="p-1 text-gray-500 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const renderFieldPreview = (field: FormField) => {
  switch (field.fieldType) {
    case 'text':
    case 'email':
    case 'number':
    case 'phone':
    case 'url':
      return (
        <input
          type={field.fieldType}
          placeholder={field.placeholder}
          className="w-full px-3 py-2 border rounded-lg bg-gray-50"
          disabled
        />
      );
    case 'textarea':
      return (
        <textarea
          placeholder={field.placeholder}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg bg-gray-50"
          disabled
        />
      );
    case 'select':
      return (
        <select className="w-full px-3 py-2 border rounded-lg bg-gray-50" disabled>
          <option>{field.placeholder || 'Select an option'}</option>
          {field.options?.map((opt, i) => (
            <option key={i}>{opt.label}</option>
          ))}
        </select>
      );
    case 'radio':
      return (
        <div className="space-y-2">
          {(field.options || [{ label: 'Option 1' }, { label: 'Option 2' }]).map((opt, i) => (
            <label key={i} className="flex items-center">
              <input type="radio" className="mr-2" disabled />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      );
    case 'checkbox':
      return (
        <label className="flex items-center">
          <input type="checkbox" className="mr-2" disabled />
          <span className="text-sm">{field.label}</span>
        </label>
      );
    case 'heading':
      return <h3 className="text-lg font-semibold">{field.label}</h3>;
    case 'paragraph':
      return <p className="text-sm text-gray-600">{field.label}</p>;
    default:
      return <div className="text-sm text-gray-500">Field preview</div>;
  }
};

const FormBuilder: React.FC = () => {
  const [form, setForm] = useState<FormDefinition>({
    name: 'Untitled Form',
    description: '',
    fields: [],
    settings: {}
  });
  
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const [activeCategory, setActiveCategory] = useState('basic');

  const [, drop] = useDrop(() => ({
    accept: 'field',
    drop: (item: { fieldType: FieldType }) => {
      const newField: FormField = {
        id: `field_${Date.now()}`,
        fieldKey: `field_${Date.now()}`,
        fieldType: item.fieldType.type,
        label: item.fieldType.name,
        required: false,
        ...item.fieldType.defaultProps
      };
      setForm(prev => ({
        ...prev,
        fields: [...prev.fields, newField]
      }));
    },
  }));

  const moveField = (dragIndex: number, hoverIndex: number) => {
    const dragField = form.fields[dragIndex];
    const newFields = [...form.fields];
    newFields.splice(dragIndex, 1);
    newFields.splice(hoverIndex, 0, dragField);
    setForm(prev => ({ ...prev, fields: newFields }));
  };

  const editField = (field: FormField) => {
    setSelectedField(field);
    setShowFieldEditor(true);
  };

  const deleteField = (fieldId: string) => {
    setForm(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== fieldId)
    }));
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setForm(prev => ({
      ...prev,
      fields: prev.fields.map(f => 
        f.id === fieldId ? { ...f, ...updates } : f
      )
    }));
  };

  const categories = [...new Set(fieldTypes.map(ft => ft.category))];

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-gray-50">
        <div className="flex h-screen">
          {/* Sidebar */}
          <div className="w-64 bg-white border-r overflow-y-auto">
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Form Elements</h3>
              <div className="space-y-2 mb-4">
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`w-full text-left px-3 py-2 rounded-lg capitalize ${
                      activeCategory === category
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {fieldTypes
                  .filter(ft => ft.category === activeCategory)
                  .map(fieldType => (
                    <FieldTypeItem key={fieldType.id} fieldType={fieldType} />
                  ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Form Header */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="text-2xl font-bold w-full border-0 focus:outline-none focus:ring-0"
                  placeholder="Form Name"
                />
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-2 w-full border-0 focus:outline-none focus:ring-0 text-gray-600"
                  placeholder="Form description..."
                  rows={2}
                />
              </div>

              {/* Form Canvas */}
              <div
                ref={drop}
                className="bg-white rounded-lg shadow-sm p-6 min-h-[400px]"
              >
                {form.fields.length === 0 ? (
                  <div className="text-center py-12">
                    <Plus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Drag and drop form elements here</p>
                  </div>
                ) : (
                  <div>
                    {form.fields.map((field, index) => (
                      <FormFieldItem
                        key={field.id}
                        field={field}
                        index={index}
                        moveField={moveField}
                        onEdit={editField}
                        onDelete={deleteField}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end space-x-3">
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Eye className="h-4 w-4 inline mr-2" />
                  Preview
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Save className="h-4 w-4 inline mr-2" />
                  Save Form
                </button>
              </div>
            </div>
          </div>

          {/* Field Editor Sidebar */}
          {showFieldEditor && selectedField && (
            <div className="w-80 bg-white border-l overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Field Settings</h3>
                  <button
                    onClick={() => setShowFieldEditor(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Label</label>
                    <input
                      type="text"
                      value={selectedField.label}
                      onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Field Key</label>
                    <input
                      type="text"
                      value={selectedField.fieldKey}
                      onChange={(e) => updateField(selectedField.id, { fieldKey: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Placeholder</label>
                    <input
                      type="text"
                      value={selectedField.placeholder || ''}
                      onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Help Text</label>
                    <textarea
                      value={selectedField.helpText || ''}
                      onChange={(e) => updateField(selectedField.id, { helpText: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedField.required}
                        onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium">Required Field</span>
                    </label>
                  </div>

                  {/* Options for select, radio, checkbox */}
                  {['select', 'radio', 'checkbox'].includes(selectedField.fieldType) && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Options</label>
                      <div className="space-y-2">
                        {(selectedField.options || []).map((option, index) => (
                          <div key={index} className="flex space-x-2">
                            <input
                              type="text"
                              value={option.label}
                              onChange={(e) => {
                                const newOptions = [...(selectedField.options || [])];
                                newOptions[index] = { ...option, label: e.target.value };
                                updateField(selectedField.id, { options: newOptions });
                              }}
                              className="flex-1 px-3 py-2 border rounded-lg"
                              placeholder="Label"
                            />
                            <button
                              onClick={() => {
                                const newOptions = [...(selectedField.options || [])];
                                newOptions.splice(index, 1);
                                updateField(selectedField.id, { options: newOptions });
                              }}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newOptions = [...(selectedField.options || []), { label: '', value: '' }];
                            updateField(selectedField.id, { options: newOptions });
                          }}
                          className="w-full px-3 py-2 border border-dashed rounded-lg hover:bg-gray-50"
                        >
                          <Plus className="h-4 w-4 inline mr-1" />
                          Add Option
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DndProvider>
  );
};

export default FormBuilder;