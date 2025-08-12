import { AuthService } from '../../services/authService';
import { UserModel } from '../../models/User';
import { PasswordResetTokenModel } from '../../models/PasswordResetToken';
import { emailService } from '../../services/emailService';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../models/PasswordResetToken');
jest.mock('../../services/emailService', () => ({
  emailService: {
    sendWelcomeEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  },
}));
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'StrongPassword123!',
        name: 'Test User',
      };

      // Mock database responses
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(null);
      (UserModel.create as jest.Mock).mockResolvedValue({
        id: '123',
        email: userData.email,
        full_name: userData.name,
        email_verified: false,
        created_at: new Date(),
      });

      // Mock bcrypt
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      // Mock JWT
      (jwt.sign as jest.Mock).mockReturnValue('mockToken');

      const result = await AuthService.register(userData);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('token', 'mockToken');
      expect(result.data?.user).toMatchObject({
        id: '123',
        email: userData.email,
        name: userData.name,
      });
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(
        userData.email,
        userData.name
      );
    });

    it('should fail if user already exists', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'StrongPassword123!',
        name: 'Existing User',
      };

      // Mock existing user
      (UserModel.findByEmail as jest.Mock).mockResolvedValue({
        id: '123',
        email: userData.email,
        full_name: userData.name,
      });

      const result = await AuthService.register(userData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('User with this email already exists');
      expect(UserModel.create).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'StrongPassword123!',
        name: 'Test User',
      };

      (UserModel.findByEmail as jest.Mock).mockResolvedValue(null);
      (UserModel.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await AuthService.register(userData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to register user');
    });
  });

  describe('login', () => {
    it('should login user successfully with correct credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'CorrectPassword123!',
      };

      const mockUser = {
        id: '123',
        email: loginData.email,
        full_name: 'Test User',
        password_hash: 'hashedPassword',
        email_verified: true,
      };

      // Mock database and bcrypt
      (UserModel.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (UserModel.updateLastLogin as jest.Mock).mockResolvedValue(undefined);

      // Mock JWT
      (jwt.sign as jest.Mock).mockReturnValue('mockToken');

      const result = await AuthService.login(loginData);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('token', 'mockToken');
      expect(UserModel.updateLastLogin).toHaveBeenCalledWith('123');
    });

    it('should fail with incorrect password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      const mockUser = {
        id: '123',
        email: loginData.email,
        full_name: 'Test User',
        password_hash: 'hashedPassword',
        email_verified: true,
      };

      (UserModel.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await AuthService.login(loginData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid email or password');
    });

    it('should fail if user does not exist', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      (UserModel.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await AuthService.login(loginData);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid email or password');
    });
  });

  describe('forgotPassword', () => {
    it('should send password reset email successfully', async () => {
      const email = 'test@example.com';
      const mockUser = {
        id: '123',
        email,
        full_name: 'Test User',
      };

      (UserModel.findByEmail as jest.Mock).mockResolvedValue(mockUser);
      (PasswordResetTokenModel.create as jest.Mock).mockResolvedValue({
        token: 'resetToken123',
      });

      const result = await AuthService.forgotPassword(email);

      expect(result.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        email,
        mockUser.full_name,
        'resetToken123'
      );
    });

    it('should return success even if user does not exist (security)', async () => {
      const email = 'nonexistent@example.com';

      (UserModel.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await AuthService.forgotPassword(email);

      expect(result.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully with valid token', async () => {
      const token = 'validToken123';
      const newPassword = 'NewStrongPassword123!';

      const mockTokenRecord = {
        user_id: '123',
        token,
        expires_at: new Date(Date.now() + 3600000),
      };

      (PasswordResetTokenModel.findByToken as jest.Mock).mockResolvedValue(mockTokenRecord);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      (UserModel.updatePassword as jest.Mock).mockResolvedValue(undefined);
      (PasswordResetTokenModel.delete as jest.Mock).mockResolvedValue(undefined);

      const result = await AuthService.resetPassword(token, newPassword);

      expect(result.success).toBe(true);
      expect(UserModel.updatePassword).toHaveBeenCalledWith('123', 'newHashedPassword');
      expect(PasswordResetTokenModel.delete).toHaveBeenCalledWith(token);
    });

    it('should fail with invalid or expired token', async () => {
      const token = 'invalidToken123';
      const newPassword = 'NewStrongPassword123!';

      (PasswordResetTokenModel.findByToken as jest.Mock).mockResolvedValue(null);

      const result = await AuthService.resetPassword(token, newPassword);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid or expired reset token');
    });
  });

  describe('validateToken', () => {
    it('should validate a valid token successfully', async () => {
      const token = 'validToken';
      const decodedToken = {
        userId: '123',
        email: 'test@example.com',
        iat: Date.now() / 1000,
        exp: (Date.now() / 1000) + 3600,
      };

      (jwt.verify as jest.Mock).mockReturnValue(decodedToken);

      const mockUser = {
        id: '123',
        email: 'test@example.com',
        full_name: 'Test User',
        email_verified: true,
      };

      (UserModel.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await AuthService.validateToken(token);

      expect(result.success).toBe(true);
      expect(result.data?.user).toMatchObject({
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('should fail with invalid token', async () => {
      const token = 'invalidToken';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await AuthService.validateToken(token);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid token');
    });
  });
});