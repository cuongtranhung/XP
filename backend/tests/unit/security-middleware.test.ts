/**
 * Unit Tests for Security Middleware
 * Tests XSS prevention, content validation, and file upload security
 */

import { Request, Response } from 'express';
import { validateFormContent, validateSubmissionContent, validateFileUpload } from '../../src/modules/dynamicFormBuilder/middleware/security';
import { DynamicFormBuilderError } from '../../src/modules/dynamicFormBuilder/types';

describe('Security Middleware Tests', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      user: { id: 'test-user-id' }
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    mockNext = jest.fn();
  });

  describe('validateFormContent', () => {
    it('should pass valid form content', () => {
      mockReq.body = {
        name: 'Valid Form Name',
        description: 'Valid description',
        fields: [
          {
            id: 'field1',
            type: 'text',
            label: 'Valid Label',
            placeholder: 'Valid placeholder',
            defaultValue: 'Valid default'
          }
        ]
      };

      validateFormContent(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block script injection in form name', () => {
      mockReq.body = {
        name: 'Malicious <script>alert("xss")</script> Name'
      };

      validateFormContent(mockReq, mockRes, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_CONTENT',
          message: 'Invalid content in form name'
        }
      });
    });

    it('should block javascript protocol in description', () => {
      mockReq.body = {
        name: 'Valid Name',
        description: 'Click <a href="javascript:alert(\'xss\')">here</a>'
      };

      validateFormContent(mockReq, mockRes, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should block event handlers in field labels', () => {
      mockReq.body = {
        name: 'Valid Name',
        fields: [
          {
            id: 'field1',
            type: 'text',
            label: 'Label with onclick="malicious()" handler'
          }
        ]
      };

      validateFormContent(mockReq, mockRes, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should block malicious content in field options', () => {
      mockReq.body = {
        name: 'Valid Name',
        fields: [
          {
            id: 'field1',
            type: 'select',
            label: 'Valid Label',
            options: [
              {
                value: 'option1',
                label: 'Option with <iframe src="evil.com"></iframe>'
              }
            ]
          }
        ]
      };

      validateFormContent(mockReq, mockRes, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle missing fields gracefully', () => {
      mockReq.body = {
        name: 'Valid Name'
        // No description, no fields
      };

      validateFormContent(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateSubmissionContent', () => {
    it('should pass valid submission data', () => {
      mockReq.body = {
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          message: 'This is a valid message'
        }
      };
      mockReq.params = { formId: 'test-form-id' };

      validateSubmissionContent(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block script injection in submission data', () => {
      mockReq.body = {
        data: {
          name: 'John Doe',
          message: 'Message with <script>alert("xss")</script> content'
        }
      };
      mockReq.params = { formId: 'test-form-id' };

      validateSubmissionContent(mockReq, mockRes, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_SUBMISSION_CONTENT',
          message: 'Invalid content in form submission'
        }
      });
    });

    it('should block malicious content in array values', () => {
      mockReq.body = {
        data: {
          tags: ['valid-tag', '<script>evil()</script>', 'another-valid-tag']
        }
      };
      mockReq.params = { formId: 'test-form-id' };

      validateSubmissionContent(mockReq, mockRes, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle missing or invalid data gracefully', () => {
      mockReq.body = {};
      
      validateSubmissionContent(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();

      mockReq.body = { data: null };
      validateSubmissionContent(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateFileUpload', () => {
    it('should pass valid CSV file', () => {
      mockReq.file = {
        originalname: 'data.csv',
        mimetype: 'text/csv',
        size: 1024 * 1024 // 1MB
      };

      validateFileUpload(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject files that are too large', () => {
      mockReq.file = {
        originalname: 'large-file.csv',
        mimetype: 'text/csv',
        size: 15 * 1024 * 1024 // 15MB (over 10MB limit)
      };

      validateFileUpload(mockReq, mockRes, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File too large. Maximum size is 10MB'
        }
      });
    });

    it('should reject invalid file types', () => {
      mockReq.file = {
        originalname: 'malicious.exe',
        mimetype: 'application/octet-stream',
        size: 1024
      };

      validateFileUpload(mockReq, mockRes, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Invalid file type. Only CSV, Excel, JSON and text files are allowed'
        }
      });
    });

    it('should reject dangerous file extensions', () => {
      mockReq.file = {
        originalname: 'script.js',
        mimetype: 'text/javascript',
        size: 1024
      };

      validateFileUpload(mockReq, mockRes, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'DANGEROUS_FILE_TYPE',
          message: 'File type not allowed for security reasons'
        }
      });
    });

    it('should handle multiple files', () => {
      mockReq.files = [
        {
          originalname: 'valid.csv',
          mimetype: 'text/csv',
          size: 1024
        },
        {
          originalname: 'also-valid.json',
          mimetype: 'application/json',
          size: 2048
        }
      ];

      validateFileUpload(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass when no files are uploaded', () => {
      // No req.file or req.files
      validateFileUpload(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle various dangerous extensions', () => {
      const dangerousFiles = [
        'malware.exe',
        'script.bat',
        'command.cmd',
        'screensaver.scr',
        'program.pif',
        'app.jar',
        'code.php',
        'page.asp',
        'servlet.jsp'
      ];

      dangerousFiles.forEach(filename => {
        mockReq.file = {
          originalname: filename,
          mimetype: 'application/octet-stream',
          size: 1024
        };

        validateFileUpload(mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        
        // Reset mocks for next iteration
        mockRes.status.mockClear();
        mockRes.json.mockClear();
        mockNext.mockClear();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined user gracefully', () => {
      mockReq.user = undefined;
      mockReq.body = {
        name: 'Valid Form Name'
      };

      validateFormContent(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle complex nested objects', () => {
      mockReq.body = {
        name: 'Valid Form Name',
        fields: [
          {
            id: 'field1',
            type: 'text',
            label: 'Valid Label',
            validation: {
              rules: {
                pattern: 'Valid pattern',
                message: 'Valid <script>alert("xss")</script> message'
              }
            }
          }
        ]
      };

      // Should pass because we're not validating nested validation objects
      validateFormContent(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});