import { Router } from 'express';
import { AuthController } from '../controllers/authController';

const router = Router();

// Public routes (no authentication required)
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

// Protected routes (authentication required)
router.get('/validate', AuthController.validateToken);
router.post('/logout', AuthController.logout);

export default router;