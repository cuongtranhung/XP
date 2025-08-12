import { body, ValidationChain } from 'express-validator';

// Email validation
export const validateEmail = (): ValidationChain => {
  return body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase();
};

// Password validation
export const validatePassword = (field: string = 'password'): ValidationChain => {
  return body(field)
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number');
};

// Full name validation  
export const validateFullName = (): ValidationChain => {
  return body('fullName')
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters')
    .matches(/^[^<>"&\n\r\t]+$/)
    .withMessage('Full name cannot contain HTML tags or dangerous characters (< > " & newlines)')
    .custom((value: string) => {
      // Additional check to prevent obvious script injections
      if (value && /(<script|javascript:|on\w+\s*=)/i.test(value)) {
        throw new Error('Full name contains potentially dangerous content');
      }
      return true;
    })
    .trim();
};

// Password confirmation validation
export const validatePasswordConfirmation = (): ValidationChain => {
  return body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== (req.body as any).password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    });
};

// Optional full name validation for profile updates
export const validateOptionalFullName = (): ValidationChain => {
  return body('fullName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters')
    .matches(/^[^<>"&\n\r\t]+$/)
    .withMessage('Full name cannot contain HTML tags or dangerous characters (< > " & newlines)')
    .custom((value: string) => {
      // Additional check to prevent obvious script injections
      if (value && /(<script|javascript:|on\w+\s*=)/i.test(value)) {
        throw new Error('Full name contains potentially dangerous content');
      }
      return true;
    })
    .trim();
};

// Optional email validation for profile updates
export const validateOptionalEmail = (): ValidationChain => {
  return body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase();
};

// Optional avatar URL validation for profile updates
export const validateOptionalAvatarUrl = (): ValidationChain => {
  return body('avatarUrl')
    .optional()
    .isLength({ max: 100000 }) // Increase limit for base64 images (up to ~100KB)
    .withMessage('Avatar URL must not exceed 100,000 characters')
    .matches(/^(https?:\/\/|data:image\/|\/)/i)
    .withMessage('Avatar URL must be a valid HTTP/HTTPS URL, data URL, or relative path');
};

// Registration validation chain
export const validateRegistration = (): ValidationChain[] => {
  return [
    validateEmail(),
    validatePassword(),
    validatePasswordConfirmation(),
    validateFullName()
  ];
};

// Login validation chain
export const validateLogin = (): ValidationChain[] => {
  return [
    validateEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ];
};

// Forgot password validation
export const validateForgotPassword = (): ValidationChain[] => {
  return [validateEmail()];
};

// Reset password validation
export const validateResetPassword = (): ValidationChain[] => {
  return [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required')
      .isLength({ min: 32, max: 128 })
      .withMessage('Invalid reset token format'),
    validatePassword('newPassword'), // Changed to match controller
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== (req.body as any).newPassword) {
          throw new Error('Password confirmation does not match new password');
        }
        return true;
      })
  ];
};

// Sanitize input to prevent XSS
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>?/gm, '')
    .trim();
};

// Change password validation chain
export const validateChangePassword = (): ValidationChain[] => {
  return [
    validatePassword('currentPassword'),
    validatePassword('newPassword'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== (req.body as any).newPassword) {
          throw new Error('Password confirmation does not match new password');
        }
        return true;
      })
  ];
};

// Optional date of birth validation for profile updates
export const validateOptionalDateOfBirth = (): ValidationChain => {
  return body('dateOfBirth')
    .optional()
    .isISO8601({ strict: true })
    .withMessage('Date of birth must be in YYYY-MM-DD format')
    .custom((value: string) => {
      if (value) {
        const date = new Date(value);
        const today = new Date();
        const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
        
        if (date > today) {
          throw new Error('Date of birth cannot be in the future');
        }
        
        if (date < minDate) {
          throw new Error('Please provide a valid date of birth');
        }
      }
      return true;
    });
};

// Profile update validation chain
export const validateProfileUpdate = (): ValidationChain[] => {
  return [
    validateOptionalFullName(),
    validateOptionalEmail(),
    validateOptionalAvatarUrl(),
    validateOptionalDateOfBirth(),
    body()
      .custom((_value, { req }) => {
        // Ensure at least one field is provided
        const body = req.body as any;
        if (!body.fullName && !body.email && !body.avatarUrl && !body.dateOfBirth) {
          throw new Error('At least one field (fullName, email, avatarUrl, or dateOfBirth) must be provided');
        }
        return true;
      })
  ];
};

// Validate and sanitize user input
export const sanitizeUserInput = (data: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value as any;
    }
  }
  
  return sanitized;
};