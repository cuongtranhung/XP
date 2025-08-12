#!/usr/bin/env node

/**
 * Database Setup Script
 * Sets up PostgreSQL database with proper configuration
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database configuration
const getDatabaseConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  }

  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'postgres',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
};

const pool = new Pool(getDatabaseConfig());

const setupDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database setup...\n');

    // Test connection
    console.log('1. Testing database connection...');
    await client.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    // Get database info
    console.log('2. Database Information:');
    const versionResult = await client.query('SELECT version()');
    console.log(`   PostgreSQL Version: ${versionResult.rows[0].version.split(' ')[1]}`);
    
    const dbResult = await client.query('SELECT current_database()');
    console.log(`   Current Database: ${dbResult.rows[0].current_database}`);
    
    const userResult = await client.query('SELECT current_user');
    console.log(`   Current User: ${userResult.rows[0].current_user}\n`);

    // Check if tables exist
    console.log('3. Checking existing tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log('   Existing tables:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('   No tables found');
    }
    console.log();

    // Run migrations if needed
    const migrationsPath = path.join(__dirname, '..', 'migrations');
    if (fs.existsSync(migrationsPath)) {
      console.log('4. Running migrations...');
      const migrationFiles = fs.readdirSync(migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        console.log(`   Running ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
        await client.query(sql);
        console.log(`   ✅ ${file} completed`);
      }
    }

    console.log('\n🎉 Database setup completed successfully!');
    
    // Final verification
    console.log('\n5. Final verification...');
    const finalTablesResult = await client.query(`
      SELECT table_name, 
             (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('   Database schema:');
    finalTablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name} (${row.column_count} columns)`);
    });

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

// Handle script execution
if (require.main === module) {
  setupDatabase().catch(console.error);
}

module.exports = { setupDatabase };