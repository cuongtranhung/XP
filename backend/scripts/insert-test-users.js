const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || '172.26.240.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '@abcd1234'
});

async function insertTestUsers() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Inserting test users...\n');
    
    await client.query('BEGIN');
    
    // Get role IDs
    const rolesResult = await client.query('SELECT id, name FROM roles');
    const roles = {};
    rolesResult.rows.forEach(r => roles[r.name] = r.id);
    
    // Get group IDs
    const groupsResult = await client.query('SELECT id, name FROM user_groups');
    const groups = {};
    groupsResult.rows.forEach(g => groups[g.name] = g.id);
    
    // Test users data
    const testUsers = [
      {
        email: 'admin@example.com',
        username: 'admin',
        full_name: 'System Administrator',
        phone_number: '0901234567',
        department: 'IT',
        position: 'System Admin',
        is_approved: true,
        is_blocked: false,
        status: 'active',
        role: 'admin',
        group: 'administrators'
      },
      {
        email: 'manager1@example.com',
        username: 'manager1',
        full_name: 'Sales Manager',
        phone_number: '0901234568',
        department: 'Sales',
        position: 'Department Manager',
        is_approved: true,
        is_blocked: false,
        status: 'active',
        role: 'manager',
        group: 'managers'
      },
      {
        email: 'user1@example.com',
        username: 'user1',
        full_name: 'John Doe',
        phone_number: '0901234569',
        department: 'Sales',
        position: 'Sales Representative',
        is_approved: true,
        is_blocked: false,
        status: 'active',
        role: 'user',
        group: 'all_users'
      },
      {
        email: 'user2@example.com',
        username: 'user2',
        full_name: 'Jane Smith',
        phone_number: '0901234570',
        department: 'Marketing',
        position: 'Marketing Specialist',
        is_approved: false,  // Needs approval
        is_blocked: false,
        status: 'inactive',
        role: 'user',
        group: 'all_users'
      },
      {
        email: 'blocked@example.com',
        username: 'blockeduser',
        full_name: 'Blocked User',
        phone_number: '0901234571',
        department: 'HR',
        position: 'HR Assistant',
        is_approved: true,
        is_blocked: true,  // Blocked user
        status: 'inactive',
        role: 'user',
        group: 'all_users'
      }
    ];
    
    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [userData.email, userData.username]
      );
      
      if (existingUser.rows.length > 0) {
        console.log(`⏭️  User ${userData.email} already exists`);
        continue;
      }
      
      // Insert user with a default password hash (password: "Password123!")
      // In production, use proper bcrypt hashing
      const defaultPasswordHash = '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'; // bcrypt hash of "Password123!"
      
      const insertResult = await client.query(`
        INSERT INTO users (
          email, username, password_hash, full_name, phone_number, 
          department, position, is_approved, is_blocked, status,
          email_verified, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING id
      `, [
        userData.email,
        userData.username,
        defaultPasswordHash,
        userData.full_name,
        userData.phone_number,
        userData.department,
        userData.position,
        userData.is_approved,
        userData.is_blocked,
        userData.status,
        true  // email_verified
      ]);
      
      const userId = insertResult.rows[0].id;
      
      // Assign role
      if (userData.role && roles[userData.role]) {
        await client.query(
          'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, roles[userData.role]]
        );
      }
      
      // Assign to group
      if (userData.group && groups[userData.group]) {
        await client.query(
          'INSERT INTO user_group_members (user_id, group_id, role_in_group) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [userId, groups[userData.group], 'member']
        );
      }
      
      console.log(`✅ Created user: ${userData.email} (${userData.full_name})`);
      console.log(`   - Role: ${userData.role}`);
      console.log(`   - Group: ${userData.group}`);
      console.log(`   - Approved: ${userData.is_approved ? 'Yes' : 'No'}`);
      console.log(`   - Blocked: ${userData.is_blocked ? 'Yes' : 'No'}`);
      console.log('');
    }
    
    await client.query('COMMIT');
    
    // Show summary
    console.log('\n📊 User Summary:');
    console.log('─'.repeat(50));
    
    const summary = await client.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_approved = true) as approved_users,
        COUNT(*) FILTER (WHERE is_blocked = true) as blocked_users,
        COUNT(*) FILTER (WHERE status = 'active') as active_users
      FROM users
      WHERE deleted_at IS NULL
    `);
    
    const stats = summary.rows[0];
    console.log(`Total Users: ${stats.total_users}`);
    console.log(`Approved: ${stats.approved_users}`);
    console.log(`Blocked: ${stats.blocked_users}`);
    console.log(`Active: ${stats.active_users}`);
    
    // Show users by role
    console.log('\n👥 Users by Role:');
    console.log('─'.repeat(50));
    
    const roleStats = await client.query(`
      SELECT 
        r.display_name,
        COUNT(ur.user_id) as user_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      GROUP BY r.id, r.display_name
      ORDER BY r.priority DESC
    `);
    
    roleStats.rows.forEach(row => {
      console.log(`${row.display_name}: ${row.user_count} users`);
    });
    
    console.log('\n✨ Test users inserted successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error inserting test users:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

insertTestUsers().catch(console.error);