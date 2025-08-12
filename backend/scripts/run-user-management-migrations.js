const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Import the existing database connection from the project
const { Pool } = require('pg');

// Use the same configuration as the project
const pool = new Pool({
  host: process.env.DB_HOST || '172.26.240.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '@abcd1234',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting User Management migrations...');
    
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_management_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files from user-management folder
    const migrationsDir = path.join(__dirname, '..', 'migrations', 'user-management');
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    console.log(`📁 Found ${sqlFiles.length} migration files`);

    let successCount = 0;
    let skipCount = 0;

    for (const file of sqlFiles) {
      // Check if migration was already executed
      const result = await client.query(
        'SELECT * FROM user_management_migrations WHERE filename = $1',
        [file]
      );

      if (result.rows.length > 0) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        skipCount++;
        continue;
      }

      // Read and execute migration
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf8');
      
      console.log(`⚡ Running migration: ${file}`);
      
      try {
        await client.query('BEGIN');
        
        // Execute the migration SQL
        await client.query(sql);
        
        // Record the migration
        await client.query(
          'INSERT INTO user_management_migrations (filename) VALUES ($1)',
          [file]
        );
        
        await client.query('COMMIT');
        console.log(`✅ Migration ${file} completed successfully`);
        successCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration ${file} failed:`, error.message);
        throw error;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully executed: ${successCount} migrations`);
    console.log(`⏭️  Skipped (already run): ${skipCount} migrations`);
    console.log('✨ All migrations completed successfully!');
    
    // Verify tables exist
    console.log('\n🔍 Verifying database structure...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'roles', 'permissions', 'user_roles', 'user_groups', 'user_group_members', 'audit_logs')
      ORDER BY table_name;
    `);
    
    console.log('📋 Tables created:');
    tables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Check for views
    const views = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    if (views.rows.length > 0) {
      console.log('\n👁️ Views created:');
      views.rows.forEach(row => {
        console.log(`   ✅ ${row.table_name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations
runMigrations().catch(console.error);