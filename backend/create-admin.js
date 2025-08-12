const bcrypt = require('bcrypt');
const { pool } = require('./dist/utils/database.js');

(async () => {
  try {
    console.log('Creating admin user...');
    
    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    // Check if user exists
    const existingUser = await pool.query('SELECT id, email FROM users WHERE email = $1', ['admin@fullstackauth.com']);
    
    if (existingUser.rows.length > 0) {
      console.log('User exists, updating password...');
      await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2', [hashedPassword, 'admin@fullstackauth.com']);
      console.log('✅ User password updated:', existingUser.rows[0]);
    } else {
      console.log('Creating new user...');
      const insertQuery = `
        INSERT INTO users (email, password_hash, full_name, department, position, is_approved, is_blocked, email_verified, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, email, full_name
      `;
      
      const result = await pool.query(insertQuery, [
        'admin@fullstackauth.com', 
        hashedPassword, 
        'Admin User', 
        'IT', 
        'Administrator', 
        true, 
        false, 
        true
      ]);
      
      console.log('✅ Test user created:', result.rows[0]);
    }
    
    console.log('✅ Admin user setup complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
})();