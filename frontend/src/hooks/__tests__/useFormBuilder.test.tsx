/**
 * Unit tests for useFormBuilder hook
 */

import { renderHook, act } from '@testing-library/react';
import { useFormBuilder } from '../useFormBuilder';
import { FieldType, FormField } from '../../types/formBuilder';
import { v4 as uuidv4 } from 'uuid';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

describe('useFormBuilder Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (uuidv4 as jest.Mock).mockImplementation(() => `mock-uuid-${Math.random()}`);
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useFormBuilder());

    expect(result.current.form).toEqual({
      title: '',
      description: '',
      fields: [],
      settings: {
        submitButtonText: 'Submit',
        successMessage: 'Thank you for your submission!',
        allowMultipleSubmissions: true,
        requireAuthentication: false,
        notificationEmail: '',
        redirectUrl: '',
        captchaEnabled: false,
        saveProgress: false,
        clearOnSubmit: false,
      },
    });
    expect(result.current.selectedField).toBeNull();
  });

  it('should add field', () => {
    const { result } = renderHook(() => useFormBuilder());

    act(() => {
      result.current.addField(FieldType.Text);
    });

    expect(result.current.form.fields).toHaveLength(1);
    expect(result.current.form.fields[0]).toMatchObject({
      type: FieldType.Text,
      label: 'Text Field',
      key: expect.stringContaining('text_field_'),
      required: false,
      position: 0,
    });
  });

  it('should add field at specific position', () => {
    const { result } = renderHook(() => useFormBuilder());

    // Add initial fields
    act(() => {
      result.current.addField(FieldType.Text);
      result.current.addField(FieldType.Email);
      result.current.addField(FieldType.Number);
    });

    // Add field at position 1
    act(() => {
      result.current.addFieldAtPosition(
        {
          id: 'custom-id',
          type: FieldType.Select,
          label: 'Select Field',
          key: 'select_field',
          required: false,
          position: 0,
          options: [],
        },
        1
      );
    });

    expect(result.current.form.fields).toHaveLength(4);
    expect(result.current.form.fields[1].type).toBe(FieldType.Select);
    expect(result.current.form.fields[1].label).toBe('Select Field');
  });

  it('should update field', () => {
    const { result } = renderHook(() => useFormBuilder());

    // Add a field
    act(() => {
      result.current.addField(FieldType.Text);
    });

    const fieldId = result.current.form.fields[0].id;

    // Update the field
    act(() => {
      result.current.updateField(fieldId, {
        label: 'Updated Label',
        required: true,
        placeholder: 'Enter text here',
      });
    });

    expect(result.current.form.fields[0]).toMatchObject({
      label: 'Updated Label',
      required: true,
      placeholder: 'Enter text here',
    });
  });

  it('should delete field', () => {
    const { result } = renderHook(() => useFormBuilder());

    // Add multiple fields
    act(() => {
      result.current.addField(FieldType.Text);
      result.current.addField(FieldType.Email);
      result.current.addField(FieldType.Number);
    });

    const fieldToDelete = result.current.form.fields[1].id;

    // Delete the middle field
    act(() => {
      result.current.deleteField(fieldToDelete);
    });

    expect(result.current.form.fields).toHaveLength(2);
    expect(result.current.form.fields.find(f => f.id === fieldToDelete)).toBeUndefined();
    // Check positions are updated
    expect(result.current.form.fields[0].position).toBe(0);
    expect(result.current.form.fields[1].position).toBe(1);
  });

  it('should duplicate field', () => {
    const { result } = renderHook(() => useFormBuilder());

    // Add a field with custom properties
    act(() => {
      result.current.addField(FieldType.Text);
      const fieldId = result.current.form.fields[0].id;
      result.current.updateField(fieldId, {
        label: 'Original Field',
        required: true,
        validation: {
          minLength: 5,
          maxLength: 50,
        },
      });
    });

    const originalFieldId = result.current.form.fields[0].id;

    // Duplicate the field
    act(() => {
      result.current.duplicateField(originalFieldId);
    });

    expect(result.current.form.fields).toHaveLength(2);
    expect(result.current.form.fields[1]).toMatchObject({
      label: 'Original Field (Copy)',
      required: true,
      validation: {
        minLength: 5,
        maxLength: 50,
      },
    });
    expect(result.current.form.fields[1].id).not.toBe(originalFieldId);
    expect(result.current.form.fields[1].key).not.toBe(result.current.form.fields[0].key);
  });

  it('should reorder fields', () => {
    const { result } = renderHook(() => useFormBuilder());

    // Add multiple fields
    act(() => {
      result.current.addField(FieldType.Text);
      result.current.addField(FieldType.Email);
      result.current.addField(FieldType.Number);
    });

    const fields = result.current.form.fields;
    const firstFieldId = fields[0].id;
    const secondFieldId = fields[1].id;
    const thirdFieldId = fields[2].id;

    // Move first field to last position
    act(() => {
      result.current.reorderFields(0, 2);
    });

    expect(result.current.form.fields[0].id).toBe(secondFieldId);
    expect(result.current.form.fields[1].id).toBe(thirdFieldId);
    expect(result.current.form.fields[2].id).toBe(firstFieldId);
    // Check positions are updated
    expect(result.current.form.fields[0].position).toBe(0);
    expect(result.current.form.fields[1].position).toBe(1);
    expect(result.current.form.fields[2].position).toBe(2);
  });

  it('should update form metadata', () => {
    const { result } = renderHook(() => useFormBuilder());

    act(() => {
      result.current.updateForm({
        title: 'Contact Form',
        description: 'Please fill out this form to contact us',
      });
    });

    expect(result.current.form.title).toBe('Contact Form');
    expect(result.current.form.description).toBe('Please fill out this form to contact us');
  });

  it('should update form settings', () => {
    const { result } = renderHook(() => useFormBuilder());

    act(() => {
      result.current.updateSettings({
        submitButtonText: 'Send Message',
        successMessage: 'Your message has been sent!',
        requireAuthentication: true,
        captchaEnabled: true,
      });
    });

    expect(result.current.form.settings).toMatchObject({
      submitButtonText: 'Send Message',
      successMessage: 'Your message has been sent!',
      requireAuthentication: true,
      captchaEnabled: true,
    });
  });

  it('should set entire form', () => {
    const { result } = renderHook(() => useFormBuilder());

    const newForm = {
      title: 'New Form',
      description: 'New Description',
      fields: [
        {
          id: 'field-1',
          type: FieldType.Email,
          label: 'Email Address',
          key: 'email',
          required: true,
          position: 0,
        },
      ],
      settings: {
        submitButtonText: 'Submit Now',
        successMessage: 'Success!',
        allowMultipleSubmissions: false,
        requireAuthentication: true,
        notificationEmail: 'admin@example.com',
        redirectUrl: '/thank-you',
        captchaEnabled: true,
        saveProgress: true,
        clearOnSubmit: true,
      },
    };

    act(() => {
      result.current.setForm(newForm);
    });

    expect(result.current.form).toEqual(newForm);
  });

  it('should select and deselect field', () => {
    const { result } = renderHook(() => useFormBuilder());

    // Add a field
    act(() => {
      result.current.addField(FieldType.Text);
    });

    const fieldId = result.current.form.fields[0].id;

    // Select the field
    act(() => {
      result.current.setSelectedField(fieldId);
    });

    expect(result.current.selectedField).toBe(fieldId);

    // Deselect the field
    act(() => {
      result.current.setSelectedField(null);
    });

    expect(result.current.selectedField).toBeNull();
  });

  it('should generate unique field keys', () => {
    const { result } = renderHook(() => useFormBuilder());

    // Add multiple fields of the same type
    act(() => {
      result.current.addField(FieldType.Text);
      result.current.addField(FieldType.Text);
      result.current.addField(FieldType.Text);
    });

    const keys = result.current.form.fields.map(f => f.key);
    const uniqueKeys = new Set(keys);

    expect(uniqueKeys.size).toBe(3);
    expect(keys[0]).toMatch(/^text_field_/);
    expect(keys[1]).toMatch(/^text_field_/);
    expect(keys[2]).toMatch(/^text_field_/);
  });

  it('should handle conditional logic in fields', () => {
    const { result } = renderHook(() => useFormBuilder());

    // Add fields
    act(() => {
      result.current.addField(FieldType.Radio);
      result.current.addField(FieldType.Text);
    });

    const radioFieldId = result.current.form.fields[0].id;
    const textFieldId = result.current.form.fields[1].id;

    // Update radio field with options
    act(() => {
      result.current.updateField(radioFieldId, {
        key: 'show_field',
        options: [
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ],
      });
    });

    // Add conditional logic to text field
    act(() => {
      result.current.updateField(textFieldId, {
        conditionalLogic: {
          show: true,
          when: 'show_field',
          is: 'yes',
        },
      });
    });

    expect(result.current.form.fields[1].conditionalLogic).toEqual({
      show: true,
      when: 'show_field',
      is: 'yes',
    });
  });

  it('should handle field validation rules', () => {
    const { result } = renderHook(() => useFormBuilder());

    // Add different field types
    act(() => {
      result.current.addField(FieldType.Text);
      result.current.addField(FieldType.Number);
      result.current.addField(FieldType.Email);
    });

    const textFieldId = result.current.form.fields[0].id;
    const numberFieldId = result.current.form.fields[1].id;
    const emailFieldId = result.current.form.fields[2].id;

    // Add validation rules
    act(() => {
      result.current.updateField(textFieldId, {
        validation: {
          minLength: 3,
          maxLength: 50,
          pattern: '^[A-Za-z ]+$',
        },
      });

      result.current.updateField(numberFieldId, {
        validation: {
          min: 0,
          max: 100,
        },
      });

      result.current.updateField(emailFieldId, {
        validation: {
          pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$',
        },
      });
    });

    expect(result.current.form.fields[0].validation).toMatchObject({
      minLength: 3,
      maxLength: 50,
      pattern: '^[A-Za-z ]+$',
    });

    expect(result.current.form.fields[1].validation).toMatchObject({
      min: 0,
      max: 100,
    });

    expect(result.current.form.fields[2].validation).toMatchObject({
      pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$',
    });
  });
});