import { Pool } from 'pg';
import { getDatabaseConfig } from '../utils/database';

async function testDatabaseConnection() {
  console.log('🧪 Testing database connection...');
  
  const config = getDatabaseConfig();
  console.log('📋 Database configuration:');
  
  // Mask password in logs
  const maskedConfig = { ...config };
  if (maskedConfig.connectionString) {
    maskedConfig.connectionString = maskedConfig.connectionString.replace(/:([^:@]+)@/, ':****@');
  }
  if (maskedConfig.password) {
    maskedConfig.password = '****';
  }
  
  console.log(JSON.stringify(maskedConfig, null, 2));
  
  const pool = new Pool(config);
  
  try {
    console.log('🔌 Attempting to connect to database...');
    const client = await pool.connect();
    
    console.log('✅ Successfully connected to PostgreSQL!');
    
    // Test basic query
    const result = await client.query('SELECT version(), current_database(), current_user');
    console.log('📊 Database info:');
    console.log(`  - PostgreSQL Version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
    console.log(`  - Current Database: ${result.rows[0].current_database}`);
    console.log(`  - Current User: ${result.rows[0].current_user}`);
    
    // Check if our tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'password_reset_tokens', 'user_sessions')
      ORDER BY table_name
    `);
    
    console.log('📋 Existing tables:');
    if (tablesResult.rows.length === 0) {
      console.log('  - No tables found. Database migration needed.');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name} ✅`);
      });
    }
    
    client.release();
    
  } catch (error: any) {
    console.error('❌ Database connection failed:');
    console.error(`  Error: ${error.message}`);
    console.error(`  Code: ${error.code || 'Unknown'}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Troubleshooting tips:');
      console.log('  1. Make sure PostgreSQL is installed and running');
      console.log('  2. Check if PostgreSQL is listening on the correct host/port');
      console.log('  3. Verify database credentials in .env file');
      console.log('  4. Try: sudo service postgresql start (Linux) or brew services start postgresql (Mac)');
    } else if (error.code === '28P01') {
      console.log('\n🔧 Authentication failed:');
      console.log('  1. Check username and password in .env file');
      console.log('  2. Verify user exists in PostgreSQL');
      console.log('  3. Check pg_hba.conf for authentication method');
    } else if (error.code === '3D000') {
      console.log('\n🔧 Database does not exist:');
      console.log('  1. Create database: CREATE DATABASE postgres;');
      console.log('  2. Or update DATABASE_URL in .env with existing database name');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
  
  console.log('🎉 Database connection test completed successfully!');
}

// Run test if called directly
if (require.main === module) {
  testDatabaseConnection()
    .then(() => process.exit(0))
    .catch(console.error);
}

export default testDatabaseConnection;