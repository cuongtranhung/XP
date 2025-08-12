/**
 * Unit tests for ValidationService
 */

import { ValidationService } from '../services/ValidationService';
import { FieldType, FormField } from '../types';
import { v4 as uuidv4 } from 'uuid';

describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  describe('validateSubmission', () => {
    it('should validate required fields', () => {
      const fields: FormField[] = [
        {
          id: uuidv4(),
          type: FieldType.Text,
          label: 'Name',
          key: 'name',
          required: true,
          position: 0,
        },
        {
          id: uuidv4(),
          type: FieldType.Email,
          label: 'Email',
          key: 'email',
          required: false,
          position: 1,
        },
      ];

      // Test missing required field
      let result = validationService.validateSubmission({}, fields);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        field: 'name',
        message: expect.stringContaining('required'),
      });

      // Test with required field provided
      result = validationService.validateSubmission({ name: 'John Doe' }, fields);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate email format', () => {
      const fields: FormField[] = [
        {
          id: uuidv4(),
          type: FieldType.Email,
          label: 'Email',
          key: 'email',
          required: true,
          position: 0,
        },
      ];

      // Test invalid email
      let result = validationService.validateSubmission(
        { email: 'invalid-email' },
        fields
      );
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatchObject({
        field: 'email',
        message: expect.stringContaining('email'),
      });

      // Test valid email
      result = validationService.validateSubmission(
        { email: 'valid@example.com' },
        fields
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate number fields', () => {
      const fields: FormField[] = [
        {
          id: uuidv4(),
          type: FieldType.Number,
          label: 'Age',
          key: 'age',
          required: true,
          position: 0,
          validation: {
            min: 18,
            max: 100,
          },
        },
      ];

      // Test below minimum
      let result = validationService.validateSubmission({ age: 10 }, fields);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('minimum');

      // Test above maximum
      result = validationService.validateSubmission({ age: 150 }, fields);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('maximum');

      // Test valid number
      result = validationService.validateSubmission({ age: 25 }, fields);
      expect(result.isValid).toBe(true);

      // Test non-numeric value
      result = validationService.validateSubmission({ age: 'not a number' }, fields);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('number');
    });

    it('should validate text length', () => {
      const fields: FormField[] = [
        {
          id: uuidv4(),
          type: FieldType.Text,
          label: 'Description',
          key: 'description',
          required: true,
          position: 0,
          validation: {
            minLength: 10,
            maxLength: 100,
          },
        },
      ];

      // Test too short
      let result = validationService.validateSubmission(
        { description: 'Short' },
        fields
      );
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('10 characters');

      // Test too long
      const longText = 'a'.repeat(101);
      result = validationService.validateSubmission(
        { description: longText },
        fields
      );
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('100 characters');

      // Test valid length
      result = validationService.validateSubmission(
        { description: 'This is a valid description' },
        fields
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate custom patterns', () => {
      const fields: FormField[] = [
        {
          id: uuidv4(),
          type: FieldType.Text,
          label: 'Phone',
          key: 'phone',
          required: true,
          position: 0,
          validation: {
            pattern: '^\\d{3}-\\d{3}-\\d{4}$',
          },
        },
      ];

      // Test invalid pattern
      let result = validationService.validateSubmission(
        { phone: '1234567890' },
        fields
      );
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('pattern');

      // Test valid pattern
      result = validationService.validateSubmission(
        { phone: '123-456-7890' },
        fields
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate date fields', () => {
      const fields: FormField[] = [
        {
          id: uuidv4(),
          type: FieldType.Date,
          label: 'Birth Date',
          key: 'birthDate',
          required: true,
          position: 0,
          validation: {
            minDate: '2000-01-01',
            maxDate: '2020-12-31',
          },
        },
      ];

      // Test date before minimum
      let result = validationService.validateSubmission(
        { birthDate: '1999-12-31' },
        fields
      );
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('after');

      // Test date after maximum
      result = validationService.validateSubmission(
        { birthDate: '2021-01-01' },
        fields
      );
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('before');

      // Test valid date
      result = validationService.validateSubmission(
        { birthDate: '2010-06-15' },
        fields
      );
      expect(result.isValid).toBe(true);

      // Test invalid date format
      result = validationService.validateSubmission(
        { birthDate: 'not a date' },
        fields
      );
      expect(result.isValid).toBe(false);
    });

    it('should validate select fields', () => {
      const fields: FormField[] = [
        {
          id: uuidv4(),
          type: FieldType.Select,
          label: 'Country',
          key: 'country',
          required: true,
          position: 0,
          options: [
            { label: 'USA', value: 'us' },
            { label: 'Canada', value: 'ca' },
            { label: 'Mexico', value: 'mx' },
          ],
        },
      ];

      // Test invalid option
      let result = validationService.validateSubmission(
        { country: 'invalid' },
        fields
      );
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('valid option');

      // Test valid option
      result = validationService.validateSubmission({ country: 'us' }, fields);
      expect(result.isValid).toBe(true);
    });

    it('should validate checkbox fields', () => {
      const fields: FormField[] = [
        {
          id: uuidv4(),
          type: FieldType.Checkbox,
          label: 'Terms',
          key: 'terms',
          required: true,
          position: 0,
        },
      ];

      // Test unchecked required checkbox
      let result = validationService.validateSubmission({ terms: false }, fields);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be checked');

      // Test checked checkbox
      result = validationService.validateSubmission({ terms: true }, fields);
      expect(result.isValid).toBe(true);
    });

    it('should validate file upload fields', () => {
      const fields: FormField[] = [
        {
          id: uuidv4(),
          type: FieldType.FileUpload,
          label: 'Resume',
          key: 'resume',
          required: true,
          position: 0,
          validation: {
            allowedTypes: ['pdf', 'doc', 'docx'],
            maxSize: 5 * 1024 * 1024, // 5MB
          },
        },
      ];

      // Test missing required file
      let result = validationService.validateSubmission({}, fields);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('required');

      // Test invalid file type
      result = validationService.validateSubmission(
        {
          resume: {
            filename: 'test.txt',
            mimetype: 'text/plain',
            size: 1000,
          },
        },
        fields
      );
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('file type');

      // Test file too large
      result = validationService.validateSubmission(
        {
          resume: {
            filename: 'test.pdf',
            mimetype: 'application/pdf',
            size: 10 * 1024 * 1024, // 10MB
          },
        },
        fields
      );
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('size');

      // Test valid file
      result = validationService.validateSubmission(
        {
          resume: {
            filename: 'test.pdf',
            mimetype: 'application/pdf',
            size: 1 * 1024 * 1024, // 1MB
          },
        },
        fields
      );
      expect(result.isValid).toBe(true);
    });

    it('should handle conditional validation', () => {
      const fields: FormField[] = [
        {
          id: uuidv4(),
          type: FieldType.Radio,
          label: 'Employment Status',
          key: 'employmentStatus',
          required: true,
          position: 0,
          options: [
            { label: 'Employed', value: 'employed' },
            { label: 'Unemployed', value: 'unemployed' },
          ],
        },
        {
          id: uuidv4(),
          type: FieldType.Text,
          label: 'Company Name',
          key: 'companyName',
          required: false,
          position: 1,
          conditionalLogic: {
            show: true,
            when: 'employmentStatus',
            is: 'employed',
          },
        },
      ];

      // Test when condition is met but required field is missing
      let result = validationService.validateSubmission(
        { employmentStatus: 'employed' },
        fields
      );
      expect(result.isValid).toBe(true); // companyName is not required

      // Make companyName required when employed
      fields[1].required = true;
      result = validationService.validateSubmission(
        { employmentStatus: 'employed' },
        fields
      );
      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('companyName');

      // Test when condition is not met
      result = validationService.validateSubmission(
        { employmentStatus: 'unemployed' },
        fields
      );
      expect(result.isValid).toBe(true); // companyName not required when unemployed
    });

    it('should collect multiple validation errors', () => {
      const fields: FormField[] = [
        {
          id: uuidv4(),
          type: FieldType.Text,
          label: 'Name',
          key: 'name',
          required: true,
          position: 0,
        },
        {
          id: uuidv4(),
          type: FieldType.Email,
          label: 'Email',
          key: 'email',
          required: true,
          position: 1,
        },
        {
          id: uuidv4(),
          type: FieldType.Number,
          label: 'Age',
          key: 'age',
          required: true,
          position: 2,
          validation: {
            min: 18,
          },
        },
      ];

      const result = validationService.validateSubmission(
        {
          email: 'invalid-email',
          age: 10,
        },
        fields
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.map(e => e.field)).toEqual(['name', 'email', 'age']);
    });
  });

  describe('sanitizeData', () => {
    it('should sanitize HTML from text inputs', () => {
      const data = {
        name: '<script>alert("XSS")</script>John Doe',
        description: '<p>Hello <b>world</b></p>',
      };

      const sanitized = validationService.sanitizeData(data);

      expect(sanitized.name).toBe('John Doe');
      expect(sanitized.description).toBe('Hello world');
    });

    it('should trim whitespace', () => {
      const data = {
        name: '  John Doe  ',
        email: ' john@example.com ',
      };

      const sanitized = validationService.sanitizeData(data);

      expect(sanitized.name).toBe('John Doe');
      expect(sanitized.email).toBe('john@example.com');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: '<b>John</b>',
          email: 'john@example.com',
        },
        tags: ['<i>tag1</i>', 'tag2'],
      };

      const sanitized = validationService.sanitizeData(data);

      expect(sanitized.user.name).toBe('John');
      expect(sanitized.tags[0]).toBe('tag1');
    });
  });
});