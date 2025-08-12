#!/usr/bin/env node

/**
 * Setup script for Dynamic Form Builder module
 * Handles initial configuration and verification
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import fs from 'fs/promises';
import path from 'path';
import { MigrationRunner } from './migrations/migrate';
import { FormBuilderConfiguration } from './config';
import { logger } from '../../utils/logger';

interface SetupOptions {
  skipDatabase?: boolean;
  skipRedis?: boolean;
  skipFileSystem?: boolean;
  skipMigrations?: boolean;
}

class DynamicFormBuilderSetup {
  private config: FormBuilderConfiguration;
  private pool?: Pool;
  private redis?: Redis;

  constructor() {
    this.config = new FormBuilderConfiguration();
  }

  /**
   * Run complete setup
   */
  async setup(options: SetupOptions = {}): Promise<void> {
    console.log('\n🚀 Dynamic Form Builder Module Setup');
    console.log('=====================================\n');

    try {
      // Check environment
      await this.checkEnvironment();

      // Setup database
      if (!options.skipDatabase) {
        await this.setupDatabase();
      }

      // Setup Redis
      if (!options.skipRedis) {
        await this.setupRedis();
      }

      // Setup file system
      if (!options.skipFileSystem) {
        await this.setupFileSystem();
      }

      // Run migrations
      if (!options.skipMigrations && !options.skipDatabase) {
        await this.runMigrations();
      }

      // Verify setup
      await this.verifySetup();

      console.log('\n✅ Setup completed successfully!\n');
    } catch (error) {
      console.error('\n❌ Setup failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Check environment variables
   */
  private async checkEnvironment(): Promise<void> {
    console.log('📋 Checking environment...');

    const required = [
      'DB_HOST',
      'DB_PORT',
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD',
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    const optional = [
      'REDIS_HOST',
      'REDIS_PORT',
      'REDIS_PASSWORD',
      'UPLOAD_DIR',
      'WS_PORT',
    ];

    const notSet = optional.filter(key => !process.env[key]);
    if (notSet.length > 0) {
      console.log(`⚠️  Optional environment variables not set: ${notSet.join(', ')}`);
    }

    console.log('✓ Environment check passed\n');
  }

  /**
   * Setup database connection
   */
  private async setupDatabase(): Promise<void> {
    console.log('🗄️  Setting up database...');

    this.pool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

    try {
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      console.log('✓ Database connection established');

      // Create user if not exists
      const userExists = await this.checkDatabaseUser();
      if (!userExists) {
        await this.createDatabaseUser();
      }

      console.log('✓ Database setup completed\n');
    } catch (error) {
      throw new Error(`Database setup failed: ${error}`);
    }
  }

  /**
   * Check if database user exists
   */
  private async checkDatabaseUser(): Promise<boolean> {
    if (!this.pool) return false;

    const result = await this.pool.query(
      "SELECT 1 FROM pg_user WHERE usename = 'formbuilder'"
    );

    return result.rows.length > 0;
  }

  /**
   * Create database user
   */
  private async createDatabaseUser(): Promise<void> {
    if (!this.pool) return;

    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE USER formbuilder WITH PASSWORD '${process.env.DB_PASSWORD}'
      `);

      await client.query(`
        GRANT ALL PRIVILEGES ON DATABASE ${process.env.DB_NAME} TO formbuilder
      `);

      console.log('✓ Database user created');
    } catch (error) {
      // User might already exist
      console.log('⚠️  Could not create user (may already exist)');
    } finally {
      client.release();
    }
  }

  /**
   * Setup Redis connection
   */
  private async setupRedis(): Promise<void> {
    console.log('🔴 Setting up Redis...');

    const config = this.config.get();
    if (!config.performance.cache.enabled) {
      console.log('⚠️  Cache is disabled in configuration');
      return;
    }

    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB ?? '0'),
    });

    try {
      // Test connection
      await this.redis.ping();
      console.log('✓ Redis connection established');

      // Clear old cache
      const keys = await this.redis.keys('formbuilder:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`✓ Cleared ${keys.length} cache entries`);
      }

      console.log('✓ Redis setup completed\n');
    } catch (error) {
      console.log('⚠️  Redis setup failed (cache will be disabled):', error);
    }
  }

  /**
   * Setup file system directories
   */
  private async setupFileSystem(): Promise<void> {
    console.log('📁 Setting up file system...');

    const config = this.config.get();
    const uploadDir = config.upload.directory;

    const directories = [
      uploadDir,
      path.join(uploadDir, 'temp'),
      path.join(uploadDir, 'forms'),
      path.join(uploadDir, 'thumbnails'),
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✓ Created directory: ${dir}`);
    }

    // Create .gitignore in upload directory
    const gitignore = `*
!.gitignore
`;
    await fs.writeFile(path.join(uploadDir, '.gitignore'), gitignore);

    console.log('✓ File system setup completed\n');
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    console.log('🔄 Running migrations...');

    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }

    const runner = new MigrationRunner(this.pool);
    await runner.migrate();

    console.log('✓ Migrations completed\n');
  }

  /**
   * Verify the setup
   */
  private async verifySetup(): Promise<void> {
    console.log('🔍 Verifying setup...');

    const checks: Array<{name: string; status: string; message: string}> = [];

    // Database check
    if (this.pool) {
      try {
        const result = await this.pool.query(
          "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'formbuilder'"
        );
        const tableCount = parseInt(result.rows[0].count);
        checks.push({
          name: 'Database tables',
          status: tableCount >= 10 ? 'pass' : 'fail',
          message: `${tableCount} tables found`,
        });
      } catch (error) {
        checks.push({
          name: 'Database tables',
          status: 'fail',
          message: (error as Error).message,
        });
      }
    }

    // Redis check
    if (this.redis) {
      try {
        const pong = await this.redis.ping();
        checks.push({
          name: 'Redis connection',
          status: pong === 'PONG' ? 'pass' : 'fail',
          message: pong,
        });
      } catch (error) {
        checks.push({
          name: 'Redis connection',
          status: 'fail',
          message: (error as Error).message,
        });
      }
    }

    // File system check
    const config = this.config.get();
    try {
      await fs.access(config.upload.directory, fs.constants.W_OK);
      checks.push({
        name: 'Upload directory',
        status: 'pass',
        message: config.upload.directory,
      });
    } catch (error) {
      checks.push({
        name: 'Upload directory',
        status: 'fail',
        message: 'Not writable',
      });
    }

    // Display results
    console.log('\nVerification Results:');
    console.log('--------------------');
    for (const check of checks) {
      const icon = check.status === 'pass' ? '✅' : '❌';
      console.log(`${icon} ${check.name}: ${check.message}`);
    }

    const failed = checks.filter(c => c.status === 'fail');
    if (failed.length > 0) {
      throw new Error(`${failed.length} verification checks failed`);
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
    if (this.redis) {
      await this.redis.quit();
    }
  }

  /**
   * Generate sample data
   */
  async generateSampleData(): Promise<void> {
    console.log('\n📊 Generating sample data...');

    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create sample form
      const formResult = await client.query(`
        INSERT INTO formbuilder.forms (
          user_id, title, description, fields, settings, status
        ) VALUES (
          gen_random_uuid(),
          'Sample Contact Form',
          'This is a sample form created during setup',
          $1::jsonb,
          $2::jsonb,
          'active'
        ) RETURNING id
      `, [
        JSON.stringify([
          {
            key: 'name',
            type: 'text',
            label: 'Full Name',
            required: true,
            placeholder: 'Enter your full name',
          },
          {
            key: 'email',
            type: 'email',
            label: 'Email Address',
            required: true,
            placeholder: 'your@email.com',
          },
          {
            key: 'message',
            type: 'textarea',
            label: 'Message',
            required: true,
            placeholder: 'Your message here...',
            rows: 5,
          },
        ]),
        JSON.stringify({
          submitButton: { text: 'Send Message' },
          successMessage: 'Thank you for your message!',
          theme: 'default',
        }),
      ]);

      await client.query('COMMIT');
      console.log('✓ Sample data created');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to create sample data:', error);
    } finally {
      client.release();
    }
  }
}

// CLI interface
if (require.main === module) {
  const setup = new DynamicFormBuilderSetup();
  const command = process.argv[2];

  (async () => {
    switch (command) {
      case 'sample':
        await setup.setup();
        await setup.generateSampleData();
        break;
      case 'verify':
        await setup.verifySetup();
        break;
      default:
        await setup.setup();
    }
  })();
}