import { AuthService } from './src/services/authService';
import { pool } from './src/utils/database';

async function testLogin() {
  try {
    console.log('Testing login for cuongtranhung@gmail.com...');
    
    const result = await AuthService.login({
      email: 'cuongtranhung@gmail.com',
      password: '@Abcd6789'
    });
    
    console.log('Login result:', JSON.stringify(result, null, 2));
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

testLogin();