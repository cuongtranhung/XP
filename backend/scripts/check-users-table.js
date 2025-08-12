const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || '172.26.240.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '@abcd1234'
});

async function checkUsersTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking users table structure...\n');
    
    // Get column information
    const columns = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Users table columns:');
    console.log('─'.repeat(80));
    columns.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(25)} | ${col.data_type.padEnd(20)} | ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL    '} | ${col.column_default || ''}`);
    });
    
    // Check if id is integer or uuid
    const idColumn = columns.rows.find(col => col.column_name === 'id');
    console.log('\n⚠️  Important: Users.id is of type:', idColumn?.data_type);
    
    if (idColumn?.data_type === 'integer') {
      console.log('❌ Users.id is INTEGER - need to convert to UUID for User Management module');
      console.log('   The User Management module expects UUID for all ID fields.');
    } else if (idColumn?.data_type === 'uuid') {
      console.log('✅ Users.id is UUID - compatible with User Management module');
    }
    
    // Check constraints
    const constraints = await client.query(`
      SELECT 
        conname as constraint_name,
        contype as constraint_type
      FROM pg_constraint
      WHERE conrelid = 'users'::regclass;
    `);
    
    console.log('\n🔒 Constraints:');
    constraints.rows.forEach(con => {
      const type = {
        'p': 'PRIMARY KEY',
        'u': 'UNIQUE',
        'f': 'FOREIGN KEY',
        'c': 'CHECK'
      }[con.constraint_type] || con.constraint_type;
      console.log(`  - ${con.constraint_name}: ${type}`);
    });
    
    // Check if required columns exist
    const requiredColumns = [
      'username', 'phone_number', 'department', 'position',
      'is_approved', 'is_blocked', 'status', 'last_login', 'last_activity'
    ];
    
    console.log('\n📌 Required columns for User Management:');
    for (const colName of requiredColumns) {
      const exists = columns.rows.some(col => col.column_name === colName);
      console.log(`  ${exists ? '✅' : '❌'} ${colName}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkUsersTable();