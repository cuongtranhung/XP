/**
 * Form Test Helpers
 * Helper functions for form creation and manipulation in tests
 */

import { getTestDatabase } from '../setup/testApp';
import { v4 as uuidv4 } from 'uuid';

export interface TestForm {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  ownerId: string;
  slug?: string;
  version: number;
  fields?: TestFormField[];
  settings?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestFormField {
  id: string;
  formId: string;
  fieldKey: string;
  fieldType: string;
  label: string;
  placeholder?: string;
  defaultValue?: any;
  required: boolean;
  validation?: any;
  options?: any[];
  order: number;
}

export interface TestSubmission {
  id: string;
  formId: string;
  submitterId: string;
  data: any;
  submittedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create a test form in the database
 */
export const createTestForm = async (
  ownerId: string,
  formData: Partial<TestForm> = {}
): Promise<TestForm> => {
  const db = getTestDatabase();
  const formId = uuidv4();
  
  const defaultForm = {
    id: formId,
    name: 'Test Form',
    description: 'A test form for automated testing',
    status: 'draft' as const,
    ownerId,
    slug: `test-form-${Date.now()}`,
    version: 1,
    settings: {},
    ...formData
  };

  const query = `
    INSERT INTO forms (
      id, name, description, status, owner_id, slug, version, settings, 
      created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    RETURNING *
  `;

  const result = await db.query(query, [
    defaultForm.id,
    defaultForm.name,
    defaultForm.description,
    defaultForm.status,
    defaultForm.ownerId,
    defaultForm.slug,
    defaultForm.version,
    JSON.stringify(defaultForm.settings)
  ]);

  const form = result.rows[0];

  // Create form fields if provided
  if (formData.fields) {
    const createdFields = [];
    for (let i = 0; i < formData.fields.length; i++) {
      const field = await createTestFormField(form.id, formData.fields[i], i);
      createdFields.push(field);
    }
    form.fields = createdFields;
  }

  return form;
};

/**
 * Create a test form field
 */
export const createTestFormField = async (
  formId: string,
  fieldData: Partial<TestFormField> = {},
  order: number = 0
): Promise<TestFormField> => {
  const db = getTestDatabase();
  const fieldId = uuidv4();
  
  const defaultField = {
    id: fieldId,
    formId,
    fieldKey: `field_${Date.now()}`,
    fieldType: 'text',
    label: 'Test Field',
    placeholder: '',
    defaultValue: null,
    required: false,
    validation: {},
    options: null,
    order,
    ...fieldData
  };

  const query = `
    INSERT INTO form_fields (
      id, form_id, field_key, field_type, label, placeholder, default_value,
      required, validation, options, field_order, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    RETURNING *
  `;

  const result = await db.query(query, [
    defaultField.id,
    defaultField.formId,
    defaultField.fieldKey,
    defaultField.fieldType,
    defaultField.label,
    defaultField.placeholder,
    defaultField.defaultValue,
    defaultField.required,
    JSON.stringify(defaultField.validation),
    defaultField.options ? JSON.stringify(defaultField.options) : null,
    defaultField.order
  ]);

  return result.rows[0];
};

/**
 * Create a test form submission
 */
export const createTestSubmission = async (
  formId: string,
  submitterId: string,
  submissionData: any = {}
): Promise<TestSubmission> => {
  const db = getTestDatabase();
  const submissionId = uuidv4();
  
  const defaultSubmission = {
    id: submissionId,
    formId,
    submitterId,
    data: { test_field: 'test_value', ...submissionData },
    ipAddress: '127.0.0.1',
    userAgent: 'Test Agent'
  };

  const query = `
    INSERT INTO form_submissions (
      id, form_id, submitter_id, data, ip_address, user_agent, submitted_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING *, submitted_at
  `;

  const result = await db.query(query, [
    defaultSubmission.id,
    defaultSubmission.formId,
    defaultSubmission.submitterId,
    JSON.stringify(defaultSubmission.data),
    defaultSubmission.ipAddress,
    defaultSubmission.userAgent
  ]);

  return result.rows[0];
};

/**
 * Create a complete test form with fields and submissions
 */
export const createCompleteTestForm = async (
  ownerId: string,
  options: {
    fieldCount?: number;
    submissionCount?: number;
    status?: 'draft' | 'published' | 'archived';
    submitterIds?: string[];
  } = {}
): Promise<{
  form: TestForm;
  fields: TestFormField[];
  submissions: TestSubmission[];
}> => {
  const { fieldCount = 3, submissionCount = 5, status = 'published', submitterIds = [] } = options;
  
  // Create form
  const form = await createTestForm(ownerId, {
    name: 'Complete Test Form',
    status,
    description: 'A complete form with fields and submissions'
  });

  // Create fields
  const fields: TestFormField[] = [];
  const fieldTypes = ['text', 'email', 'textarea', 'select', 'checkbox'];
  
  for (let i = 0; i < fieldCount; i++) {
    const field = await createTestFormField(form.id, {
      fieldKey: `field_${i + 1}`,
      fieldType: fieldTypes[i % fieldTypes.length],
      label: `Test Field ${i + 1}`,
      required: i === 0, // First field required
      options: fieldTypes[i % fieldTypes.length] === 'select' ? [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' }
      ] : null
    }, i);
    fields.push(field);
  }

  // Create submissions
  const submissions: TestSubmission[] = [];
  for (let i = 0; i < submissionCount; i++) {
    const submitterId = submitterIds[i % submitterIds.length] || ownerId;
    const submissionData: any = {};
    
    // Fill data for each field
    fields.forEach((field, index) => {
      switch (field.fieldType) {
        case 'text':
          submissionData[field.fieldKey] = `Text value ${i + 1}`;
          break;
        case 'email':
          submissionData[field.fieldKey] = `user${i + 1}@example.com`;
          break;
        case 'textarea':
          submissionData[field.fieldKey] = `Long text content for submission ${i + 1}`;
          break;
        case 'select':
          submissionData[field.fieldKey] = `option${(i % 2) + 1}`;
          break;
        case 'checkbox':
          submissionData[field.fieldKey] = i % 2 === 0;
          break;
      }
    });

    const submission = await createTestSubmission(form.id, submitterId, submissionData);
    submissions.push(submission);
  }

  return { form, fields, submissions };
};

/**
 * Update form status
 */
export const updateFormStatus = async (
  formId: string, 
  status: 'draft' | 'published' | 'archived'
): Promise<TestForm> => {
  const db = getTestDatabase();
  const query = `
    UPDATE forms 
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;
  
  const result = await db.query(query, [status, formId]);
  return result.rows[0];
};

/**
 * Get form with fields and submission count
 */
export const getFormWithDetails = async (formId: string): Promise<TestForm & {
  fields: TestFormField[];
  submissionCount: number;
}> => {
  const db = getTestDatabase();
  
  // Get form
  const formQuery = 'SELECT * FROM forms WHERE id = $1';
  const formResult = await db.query(formQuery, [formId]);
  const form = formResult.rows[0];

  if (!form) {
    throw new Error(`Form not found: ${formId}`);
  }

  // Get fields
  const fieldsQuery = 'SELECT * FROM form_fields WHERE form_id = $1 ORDER BY field_order';
  const fieldsResult = await db.query(fieldsQuery, [formId]);
  const fields = fieldsResult.rows;

  // Get submission count
  const countQuery = 'SELECT COUNT(*) as count FROM form_submissions WHERE form_id = $1';
  const countResult = await db.query(countQuery, [formId]);
  const submissionCount = parseInt(countResult.rows[0].count);

  return { ...form, fields, submissionCount };
};

/**
 * Create forms for multi-user testing
 */
export const createMultiUserTestForms = async (userIds: string[]): Promise<TestForm[]> => {
  const forms: TestForm[] = [];
  
  for (let i = 0; i < userIds.length; i++) {
    const form = await createTestForm(userIds[i], {
      name: `User ${i + 1} Form`,
      status: 'published',
      description: `Form created by user ${i + 1}`
    });
    forms.push(form);
  }
  
  return forms;
};

/**
 * Create forms with different statuses for testing visibility
 */
export const createFormsWithDifferentStatuses = async (ownerId: string): Promise<{
  draftForm: TestForm;
  publishedForm: TestForm;
  archivedForm: TestForm;
}> => {
  const draftForm = await createTestForm(ownerId, {
    name: 'Draft Form',
    status: 'draft'
  });

  const publishedForm = await createTestForm(ownerId, {
    name: 'Published Form',
    status: 'published'
  });

  const archivedForm = await createTestForm(ownerId, {
    name: 'Archived Form',
    status: 'archived'
  });

  return { draftForm, publishedForm, archivedForm };
};

/**
 * Clear all test forms
 */
export const clearTestForms = async (): Promise<void> => {
  const db = getTestDatabase();
  await db.query('DELETE FROM form_submissions WHERE form_id IN (SELECT id FROM forms WHERE name LIKE \'%Test%\')');
  await db.query('DELETE FROM form_fields WHERE form_id IN (SELECT id FROM forms WHERE name LIKE \'%Test%\')');
  await db.query('DELETE FROM forms WHERE name LIKE \'%Test%\'');
};

/**
 * Get submission statistics for a form
 */
export const getFormSubmissionStats = async (formId: string): Promise<{
  totalSubmissions: number;
  uniqueSubmitters: number;
  averageSubmissionsPerDay: number;
}> => {
  const db = getTestDatabase();
  
  const query = `
    SELECT 
      COUNT(*) as total_submissions,
      COUNT(DISTINCT submitter_id) as unique_submitters,
      CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE COUNT(*) / GREATEST(1, DATE_PART('day', NOW() - MIN(submitted_at)))
      END as avg_per_day
    FROM form_submissions 
    WHERE form_id = $1
  `;
  
  const result = await db.query(query, [formId]);
  const stats = result.rows[0];
  
  return {
    totalSubmissions: parseInt(stats.total_submissions),
    uniqueSubmitters: parseInt(stats.unique_submitters),
    averageSubmissionsPerDay: parseFloat(stats.avg_per_day) || 0
  };
};

/**
 * Helper to create malicious form content for security testing
 */
export const createMaliciousFormContent = () => {
  return {
    xssName: '<script>alert("xss")</script>Malicious Form',
    xssDescription: 'Form with <img src="x" onerror="alert(\'xss\')" /> content',
    javascriptProtocol: 'Click <a href="javascript:alert(\'xss\')">here</a>',
    iframeEmbed: 'Content with <iframe src="http://evil.com"></iframe>',
    fields: [
      {
        fieldKey: 'malicious_field',
        fieldType: 'text',
        label: 'Label with <script>steal()</script> code',
        placeholder: 'Placeholder with onclick="malicious()" handler',
        defaultValue: '<object data="evil.swf"></object>'
      }
    ]
  };
};