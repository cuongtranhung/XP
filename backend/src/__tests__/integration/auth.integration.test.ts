import request from 'supertest';
import express from 'express';
import authRouter from '../../routes/authRoutes';
import { AuthService } from '../../services/authService';

// Mock the services
jest.mock('../../services/authService');

describe('Auth API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    // Mock AuthService static methods
    jest.spyOn(AuthService, 'register');
    jest.spyOn(AuthService, 'login');
    jest.spyOn(AuthService, 'forgotPassword');
    jest.spyOn(AuthService, 'resetPassword');
    jest.spyOn(AuthService, 'validateToken');
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'StrongPassword123!',
        fullName: 'Test User', // Changed to fullName
        confirmPassword: 'StrongPassword123!' // Add required field
      };

      (AuthService.register as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          token: 'mockToken',
          user: {
            id: '123',
            email: userData.email,
            name: userData.fullName,
            emailVerified: false,
          },
        },
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          token: 'mockToken',
          user: {
            id: '123',
            email: userData.email,
            name: userData.fullName,
          },
        },
      });
    });

    it('should fail with invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'StrongPassword123!',
        fullName: 'Test User', // Changed from 'name' to 'fullName' to match validation
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: expect.stringContaining('valid email'),
          })
        ])
      });
    });

    it('should fail with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'weak',
        fullName: 'Test User',
        confirmPassword: 'weak' // Add required field
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
            message: expect.stringContaining('at least 8 characters'),
          })
        ])
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'CorrectPassword123!',
      };

      (AuthService.login as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          token: 'mockToken',
          user: {
            id: '123',
            email: loginData.email,
            name: 'Test User',
            emailVerified: true,
          },
        },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          token: 'mockToken',
          user: {
            id: '123',
            email: loginData.email,
          },
        },
      });
    });

    it('should fail with invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      (AuthService.login as jest.Mock).mockResolvedValue({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send password reset email', async () => {
      const email = 'test@example.com';

      (AuthService.forgotPassword as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          message: 'Password reset instructions sent to your email',
        },
      });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Password reset instructions sent to your email',
        },
      });
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const resetData = {
        token: 'validToken1234567890123456789012', // Must be at least 32 chars
        newPassword: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!' // Add required field
      };

      (AuthService.resetPassword as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          message: 'Password reset successful',
        },
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Password reset successful',
        },
      });
    });

    it('should fail with invalid token', async () => {
      const resetData = {
        token: 'invalidToken1234567890123456789012', // Must be at least 32 chars
        newPassword: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!' // Add required field
      };

      (AuthService.resetPassword as jest.Mock).mockResolvedValue({
        success: false,
        message: 'Invalid or expired reset token' // Changed to match actual response
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid or expired reset token'
      });
    });
  });

  describe('GET /api/auth/validate', () => {
    it('should validate a valid token', async () => {
      const token = 'validToken';

      (AuthService.validateToken as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          user: {
            id: '123',
            email: 'test@example.com',
            name: 'Test User',
            emailVerified: true,
          },
        },
      });

      const response = await request(app)
        .get('/api/auth/validate')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: '123',
            email: 'test@example.com',
            name: 'Test User',
          },
        },
      });
    });

    it('should fail without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/validate')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: 'No token provided'
      });
    });
  });
});