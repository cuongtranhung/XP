import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { getDatabaseConfig } from '../utils/database';

class DatabaseMigration {
  private pool: Pool;

  constructor() {
    this.pool = new Pool(getDatabaseConfig());
  }

  async runMigration(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      console.log('🚀 Starting database migration...');
      
      // Read and execute schema.sql
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schemaSql = await fs.readFile(schemaPath, 'utf-8');
      
      // Split SQL statements and execute them one by one
      const statements = schemaSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.toLowerCase().includes('create') || 
            statement.toLowerCase().includes('insert') ||
            statement.toLowerCase().includes('alter')) {
          try {
            await client.query(statement);
            console.log('✅ Executed:', statement.substring(0, 50) + '...');
          } catch (error: any) {
            if (error.code === '42P07') {
              // Table already exists
              console.log('⚠️  Already exists:', statement.substring(0, 50) + '...');
            } else {
              console.error('❌ Error executing:', statement.substring(0, 50) + '...');
              throw error;
            }
          }
        }
      }
      
      console.log('✅ Database migration completed successfully!');
      
      // Test connection and show table info
      await this.showDatabaseInfo(client);
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  private async showDatabaseInfo(client: any): Promise<void> {
    try {
      console.log('\n📊 Database Information:');
      
      // Show all tables
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      console.log('Tables created:');
      tablesResult.rows.forEach((row: any) => {
        console.log(`  - ${row.table_name}`);
      });
      
      // Show users table structure
      const usersStructure = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);
      
      console.log('\n👤 Users table structure:');
      usersStructure.rows.forEach((row: any) => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      
      // Count existing records
      const userCount = await client.query('SELECT COUNT(*) as count FROM users');
      const tokenCount = await client.query('SELECT COUNT(*) as count FROM password_reset_tokens');
      
      console.log('\n📈 Current data:)');
      console.log(`  - Users: ${userCount.rows[0].count}`);
      console.log(`  - Password reset tokens: ${tokenCount.rows[0].count}`);
      
    } catch (error) {
      console.error('⚠️  Could not retrieve database info:', error);
    }
  }
  
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new DatabaseMigration();
  
  migration.runMigration()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    })
    .finally(() => {
      migration.close();
    });
}

export default DatabaseMigration;