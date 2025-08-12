import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { 
  loginRateLimit, 
  registerRateLimit, 
  forgotPasswordRateLimit,
  resetPasswordRateLimit 
} from '../middleware/rateLimiter';
import { 
  handleValidationErrors,
  sanitizeInput,
  validateContentType 
} from '../middleware/validation';
import {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateProfileUpdate
} from '../utils/validation';

const router = Router();

// Middleware applied to all auth routes
router.use(sanitizeInput);

// Health check endpoint
router.get('/health', AuthController.healthCheck);

// Test change password without middleware
router.post('/test-change-password', (_req, res) => {
  res.json({ success: true, message: 'Test route works' });
});

// Public routes (no authentication required)
router.post(
  '/register',
  validateContentType(['application/json']),
  registerRateLimit,
  validateRegistration(),
  handleValidationErrors,
  AuthController.register
);

router.post(
  '/login',
  validateContentType(['application/json']),
  loginRateLimit,
  validateLogin(),
  handleValidationErrors,
  AuthController.login
);

router.post(
  '/forgot-password',
  validateContentType(['application/json']),
  forgotPasswordRateLimit,
  validateForgotPassword(),
  handleValidationErrors,
  AuthController.forgotPassword
);

router.post(
  '/reset-password',
  validateContentType(['application/json']),
  resetPasswordRateLimit,
  validateResetPassword(),
  handleValidationErrors,
  AuthController.resetPassword
);

router.get(
  '/verify-reset-token/:token',
  AuthController.verifyResetToken
);

router.get(
  '/verify-email/:token',
  AuthController.verifyEmail
);

router.post(
  '/resend-verification',
  validateContentType(['application/json']),
  validateForgotPassword(), // Reuse email validation
  handleValidationErrors,
  AuthController.resendEmailVerification
);

// Protected routes (authentication required)
router.get(
  '/me',
  authenticate,
  AuthController.getCurrentUser
);

router.post(
  '/logout',
  authenticate,
  AuthController.logout
);

router.post(
  '/change-password',
  authenticate,
  AuthController.changePassword
);

router.put(
  '/profile',
  authenticate,
  validateProfileUpdate(),
  handleValidationErrors,
  AuthController.updateProfile
);

router.get(
  '/validate',
  AuthController.validateToken
);

export default router;