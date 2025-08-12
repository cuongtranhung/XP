/**
 * Comprehensive data validation and sanitization utilities
 * No external dependencies for maximum stability
 */

// Type guards
export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

export const isBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

export const isArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value);
};

// HTML sanitization without external dependencies
export const sanitizeHtml = (dirty: string): string => {
  const div = document.createElement('div');
  div.textContent = dirty;
  return div.innerHTML;
};

export const sanitizeText = (text: unknown): string => {
  if (!isString(text)) return '';
  
  return text
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
};

export const sanitizeNumber = (value: unknown, defaultValue = 0): number => {
  if (isNumber(value)) return value;
  
  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

export const sanitizeEmail = (email: unknown): string => {
  if (!isString(email)) return '';
  
  const sanitized = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  return emailRegex.test(sanitized) ? sanitized : '';
};

export const sanitizeUrl = (url: unknown): string => {
  if (!isString(url)) return '';
  
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
};

// Validation functions
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Safe JSON operations
export const safeJsonParse = <T = unknown>(
  json: string,
  defaultValue?: T
): T | undefined => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
};

export const safeJsonStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return '{}';
  }
};

// Safe array/object access
export const safeGet = <T>(
  obj: any,
  path: string,
  defaultValue?: T
): T | undefined => {
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result == null) {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result ?? defaultValue;
};

export default {
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  sanitizeHtml,
  sanitizeText,
  sanitizeNumber,
  sanitizeEmail,
  sanitizeUrl,
  validateEmail,
  validatePassword,
  safeJsonParse,
  safeJsonStringify,
  safeGet
};