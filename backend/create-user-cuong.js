const bcrypt = require('bcrypt');
const { pool } = require('./dist/utils/database.js');

(async () => {
  try {
    console.log('Creating user cuongtranhung@gmail.com...');
    
    // Hash password
    const hashedPassword = await bcrypt.hash('@Abcd6789', 12);
    
    // Check if user exists
    const existingUser = await pool.query('SELECT id, email FROM users WHERE email = $1', ['cuongtranhung@gmail.com']);
    
    if (existingUser.rows.length > 0) {
      console.log('User exists, updating password...');
      await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2', [hashedPassword, 'cuongtranhung@gmail.com']);
      console.log('✅ User password updated:', existingUser.rows[0]);
    } else {
      console.log('Creating new user...');
      const insertQuery = `
        INSERT INTO users (email, password_hash, full_name, department, position, is_approved, is_blocked, email_verified, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, email, full_name
      `;
      
      const result = await pool.query(insertQuery, [
        'cuongtranhung@gmail.com', 
        hashedPassword, 
        'Cuong Tran Hung', 
        'IT', 
        'Developer', 
        true, 
        false, 
        true
      ]);
      
      console.log('✅ User created:', result.rows[0]);
    }
    
    // Assign admin role to user
    const roleQuery = `
      INSERT INTO user_roles (user_id, role_id, assigned_at)
      SELECT u.id, r.id, NOW()
      FROM users u, roles r
      WHERE u.email = $1 AND r.name = 'admin'
      ON CONFLICT (user_id, role_id) DO NOTHING
    `;
    
    await pool.query(roleQuery, ['cuongtranhung@gmail.com']);
    console.log('✅ Admin role assigned to user');
    
    console.log('✅ User setup complete');
    console.log('📧 Email: cuongtranhung@gmail.com');
    console.log('🔐 Password: @Abcd6789');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
})();