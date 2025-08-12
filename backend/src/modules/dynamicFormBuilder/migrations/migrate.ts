/**
 * Migration Runner for Dynamic Form Builder
 */

import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../../utils/logger';

interface Migration {
  version: number;
  name: string;
  file: string;
  sql: string;
}

export class MigrationRunner {
  private pool: Pool;
  private schema: string;

  constructor(pool: Pool, schema: string = 'formbuilder') {
    this.pool = pool;
    this.schema = schema;
  }

  /**
   * Initialize migration tracking table
   */
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${this.schema}`);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.schema}.schema_migrations (
          version INTEGER PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      logger.info('Migration tracking table initialized');
    } finally {
      client.release();
    }
  }

  /**
   * Get applied migrations
   */
  async getAppliedMigrations(): Promise<number[]> {
    const result = await this.pool.query(`
      SELECT version FROM ${this.schema}.schema_migrations ORDER BY version
    `);
    
    return result.rows.map(row => row.version);
  }

  /**
   * Load migration files
   */
  async loadMigrations(): Promise<Migration[]> {
    const migrationDir = path.join(__dirname);
    const files = await fs.readdir(migrationDir);
    
    const migrations: Migration[] = [];
    
    for (const file of files) {
      if (file.endsWith('.sql')) {
        const match = file.match(/^(\d{3})_(.+)\.sql$/);
        if (match) {
          const version = parseInt(match[1]);
          const name = match[2];
          const filePath = path.join(migrationDir, file);
          const sql = await fs.readFile(filePath, 'utf-8');
          
          migrations.push({ version, name, file, sql });
        }
      }
    }
    
    return migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Run a single migration
   */
  async runMigration(migration: Migration): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Run migration SQL
      await client.query(migration.sql);
      
      // Record migration
      await client.query(
        `INSERT INTO ${this.schema}.schema_migrations (version, name) VALUES ($1, $2)`,
        [migration.version, migration.name]
      );
      
      await client.query('COMMIT');
      
      logger.info(`Migration ${migration.version}_${migration.name} applied successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to apply migration ${migration.version}_${migration.name}`, { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    await this.initialize();
    
    const appliedVersions = await this.getAppliedMigrations();
    const migrations = await this.loadMigrations();
    
    const pendingMigrations = migrations.filter(
      m => !appliedVersions.includes(m.version)
    );
    
    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return;
    }
    
    logger.info(`Found ${pendingMigrations.length} pending migrations`);
    
    for (const migration of pendingMigrations) {
      await this.runMigration(migration);
    }
    
    logger.info('All migrations completed successfully');
  }

  /**
   * Rollback last migration
   */
  async rollback(): Promise<void> {
    const appliedVersions = await this.getAppliedMigrations();
    
    if (appliedVersions.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }
    
    const lastVersion = appliedVersions[appliedVersions.length - 1];
    
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Note: This requires down migrations to be implemented
      // For now, we just remove the migration record
      await client.query(
        `DELETE FROM ${this.schema}.schema_migrations WHERE version = $1`,
        [lastVersion]
      );
      
      await client.query('COMMIT');
      
      logger.info(`Rolled back migration version ${lastVersion}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Failed to rollback migration ${lastVersion}`, { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reset all migrations
   */
  async reset(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Drop schema cascade
      await client.query(`DROP SCHEMA IF EXISTS ${this.schema} CASCADE`);
      
      await client.query('COMMIT');
      
      logger.info('Database reset successfully');
      
      // Re-run all migrations
      await this.migrate();
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to reset database', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get migration status
   */
  async status(): Promise<void> {
    const appliedVersions = await this.getAppliedMigrations();
    const migrations = await this.loadMigrations();
    
    console.log('Migration Status:');
    console.log('=================');
    
    for (const migration of migrations) {
      const applied = appliedVersions.includes(migration.version);
      const status = applied ? '✓ Applied' : '○ Pending';
      console.log(`${status} ${migration.version}_${migration.name}`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  const pool = new Pool({
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432'),
    database: process.env.DB_NAME ?? 'xp_formbuilder',
    user: process.env.DB_USER ?? 'formbuilder',
    password: process.env.DB_PASSWORD,
  });
  
  const runner = new MigrationRunner(pool);
  
  (async () => {
    try {
      switch (command) {
        case 'migrate':
          await runner.migrate();
          break;
        case 'rollback':
          await runner.rollback();
          break;
        case 'reset':
          await runner.reset();
          break;
        case 'status':
          await runner.status();
          break;
        default:
          console.log('Usage: ts-node migrate.ts [migrate|rollback|reset|status]');
      }
    } catch (error) {
      console.error('Migration error:', error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  })();
}