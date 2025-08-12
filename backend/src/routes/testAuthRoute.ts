import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

// Mock user data for testing (matching actual database user)
const TEST_USER = {
  id: '2',
  email: 'cuongtranhung@gmail.com',
  password_hash: '$2a$12$m52OogB/ct6pTsv9lYNXWOtTufbGYpzdBzhnKm3qK.t4A2k9uYDG.',
  full_name: 'Trần Đăng Khôi',
  is_active: true,
  is_verified: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Test login endpoint
router.post('/test-login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    console.log('Test login attempt:', { email, password: '***' });
    
    // Check if email matches
    if (email !== TEST_USER.email) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, TEST_USER.password_hash);
    console.log('Password validation result:', isPasswordValid);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: TEST_USER.id, 
        email: TEST_USER.email 
      },
      process.env.JWT_SECRET ?? 'test-secret',
      { 
        expiresIn: '24h' 
      }
    );
    
    // Return success response
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: TEST_USER.id,
        email: TEST_USER.email,
        full_name: TEST_USER.full_name,
        is_active: TEST_USER.is_active,
        is_verified: TEST_USER.is_verified,
        created_at: TEST_USER.created_at,
        updated_at: TEST_USER.updated_at
      }
    });
    
  } catch (error) {
    console.error('Test login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;