import * as yup from 'yup';

// Password validation schema
export const passwordSchema = yup
  .string()
  .required('Password is required')
  .min(8, 'Password must be at least 8 characters')
  .matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  );

// Email validation schema
export const emailSchema = yup
  .string()
  .required('Email is required')
  .email('Please enter a valid email address');

// Full name validation schema
export const fullNameSchema = yup
  .string()
  .required('Full name is required')
  .min(2, 'Full name must be at least 2 characters')
  .max(50, 'Full name must not exceed 50 characters')
  .matches(/^[A-Za-z\s]+$/, 'Full name must contain only letters and spaces');

// Login validation schema
export const loginSchema = yup.object({
  email: emailSchema,
  password: yup.string().required('Password is required'),
});

// Registration validation schema
export const registerSchema = yup.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
  fullName: fullNameSchema,
  terms: yup
    .boolean()
    .oneOf([true], 'You must agree to the Terms of Service and Privacy Policy')
    .required('You must agree to the Terms of Service and Privacy Policy'),
});

// Forgot password validation schema
export const forgotPasswordSchema = yup.object({
  email: emailSchema,
});

// Reset password validation schema
export const resetPasswordSchema = yup.object({
  password: passwordSchema,
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
});

// Change password validation schema
export const changePasswordSchema = yup.object({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: yup
    .string()
    .required('Please confirm your new password')
    .oneOf([yup.ref('newPassword')], 'Passwords must match'),
});

// Utility functions for validation
export const validateEmail = (email: string): boolean => {
  try {
    emailSchema.validateSync(email);
    return true;
  } catch {
    return false;
  }
};

export const validatePassword = (password: string): boolean => {
  try {
    passwordSchema.validateSync(password);
    return true;
  } catch {
    return false;
  }
};

export const getPasswordStrength = (password: string): {
  score: number;
  label: string;
  color: string;
} => {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score < 3) {
    return { score, label: 'Weak', color: 'text-red-600' };
  } else if (score < 5) {
    return { score, label: 'Medium', color: 'text-yellow-600' };
  } else {
    return { score, label: 'Strong', color: 'text-green-600' };
  }
};