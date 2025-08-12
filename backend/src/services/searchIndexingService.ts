/**
 * Search Indexing Service
 * Manages search indexes, data synchronization, and index optimization
 */

import { EventEmitter } from 'events';
import * as schedule from 'node-cron';
import { Pool } from 'pg';
import redisClient from '../config/redis';
import logger from '../utils/logger';
import searchService from './searchService';

// Types
export interface IndexField {
  name: string;
  type: 'text' | 'keyword' | 'number' | 'date' | 'boolean' | 'geo' | 'nested';
  searchable?: boolean;
  facetable?: boolean;
  sortable?: boolean;
  boost?: number;
  analyzer?: string;
  synonyms?: string[];
  stopWords?: string[];
}

export interface IndexSchema {
  indexId: string;
  name: string;
  tableName: string;
  fields: IndexField[];
  settings: IndexSettings;
  mappings: IndexMappings;
  status: 'active' | 'building' | 'rebuilding' | 'paused' | 'error';
  version: number;
  createdAt: Date;
  updatedAt: Date;
  documentCount: number;
  sizeInBytes: number;
}

export interface IndexSettings {
  numberOfShards?: number;
  numberOfReplicas?: number;
  refreshInterval?: string;
  maxResultWindow?: number;
  analyzers?: Record<string, AnalyzerConfig>;
  tokenizers?: Record<string, TokenizerConfig>;
  filters?: Record<string, FilterConfig>;
}

export interface AnalyzerConfig {
  type: string;
  tokenizer: string;
  filters?: string[];
  charFilters?: string[];
}

export interface TokenizerConfig {
  type: string;
  minGram?: number;
  maxGram?: number;
  tokenChars?: string[];
}

export interface FilterConfig {
  type: string;
  synonyms?: string[];
  stopWords?: string[];
  minLength?: number;
  maxLength?: number;
}

export interface IndexMappings {
  properties: Record<string, FieldMapping>;
  dynamic?: boolean | 'strict';
  dateDetection?: boolean;
  numericDetection?: boolean;
}

export interface FieldMapping {
  type: string;
  index?: boolean;
  store?: boolean;
  boost?: number;
  analyzer?: string;
  searchAnalyzer?: string;
  fields?: Record<string, FieldMapping>;
  format?: string;
  nullValue?: any;
}

export interface IndexingTask {
  taskId: string;
  indexId: string;
  type: 'full' | 'incremental' | 'delta' | 'real-time';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  documentsProcessed: number;
  documentsTotal: number;
  errors: IndexingError[];
  progress: number;
}

export interface IndexingError {
  documentId: string;
  error: string;
  timestamp: Date;
  retryCount: number;
}

export interface IndexingOptions {
  batchSize?: number;
  parallel?: boolean;
  maxWorkers?: number;
  retryOnError?: boolean;
  maxRetries?: number;
  continueOnError?: boolean;
  validateDocuments?: boolean;
  transformFunction?: (doc: any) => any;
}

export interface SyncConfig {
  indexId: string;
  enabled: boolean;
  syncType: 'real-time' | 'near-real-time' | 'batch';
  syncInterval?: string; // Cron pattern for batch sync
  changeTracking: 'timestamp' | 'version' | 'cdc' | 'trigger';
  lastSyncTime?: Date;
  lastSyncVersion?: string;
}

export interface IndexStats {
  indexId: string;
  documentCount: number;
  sizeInBytes: number;
  searchCount: number;
  avgSearchLatency: number;
  indexingRate: number;
  lastIndexedAt: Date;
  fieldStats: Record<string, FieldStats>;
}

export interface FieldStats {
  uniqueValues: number;
  nullCount: number;
  minValue?: any;
  maxValue?: any;
  avgLength?: number;
  topValues?: Array<{ value: any; count: number }>;
}

class SearchIndexingService extends EventEmitter {
  private indexes: Map<string, IndexSchema> = new Map();
  private indexingTasks: Map<string, IndexingTask> = new Map();
  private syncConfigs: Map<string, SyncConfig> = new Map();
  private pool: Pool;
  private syncJobs: Map<string, schedule.ScheduledTask> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Initialize the indexing service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create indexes table if not exists
      await this.createIndexesTable();
      
      // Load existing indexes
      await this.loadIndexes();
      
      // Start sync jobs
      await this.startSyncJobs();
      
      // Setup change tracking
      await this.setupChangeTracking();
      
      this.isInitialized = true;
      logger.info('Search indexing service initialized');
    } catch (error) {
      logger.error('Failed to initialize search indexing service:', error);
      throw error;
    }
  }

  /**
   * Create indexes metadata table
   */
  private async createIndexesTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS search_indexes (
        index_id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        table_name VARCHAR(255) NOT NULL,
        schema_json TEXT NOT NULL,
        settings_json TEXT,
        mappings_json TEXT,
        status VARCHAR(50) DEFAULT 'active',
        version INTEGER DEFAULT 1,
        document_count INTEGER DEFAULT 0,
        size_in_bytes BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS search_index_sync (
        index_id VARCHAR(255) PRIMARY KEY,
        enabled BOOLEAN DEFAULT true,
        sync_type VARCHAR(50) DEFAULT 'batch',
        sync_interval VARCHAR(255),
        change_tracking VARCHAR(50) DEFAULT 'timestamp',
        last_sync_time TIMESTAMP,
        last_sync_version VARCHAR(255),
        FOREIGN KEY (index_id) REFERENCES search_indexes(index_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS search_index_stats (
        index_id VARCHAR(255),
        stat_date DATE,
        search_count INTEGER DEFAULT 0,
        avg_search_latency DECIMAL(10, 2),
        indexing_rate DECIMAL(10, 2),
        error_count INTEGER DEFAULT 0,
        PRIMARY KEY (index_id, stat_date),
        FOREIGN KEY (index_id) REFERENCES search_indexes(index_id) ON DELETE CASCADE
      );
    `;

    await this.pool.query(query);
  }

  /**
   * Load existing indexes from database
   */
  private async loadIndexes(): Promise<void> {
    const query = `
      SELECT 
        si.*,
        sis.enabled as sync_enabled,
        sis.sync_type,
        sis.sync_interval,
        sis.change_tracking,
        sis.last_sync_time,
        sis.last_sync_version
      FROM search_indexes si
      LEFT JOIN search_index_sync sis ON si.index_id = sis.index_id
      WHERE si.status != 'deleted'
    `;

    const result = await this.pool.query(query);
    
    for (const row of result.rows) {
      const schema: IndexSchema = {
        indexId: row.index_id,
        name: row.name,
        tableName: row.table_name,
        fields: JSON.parse(row.schema_json),
        settings: row.settings_json ? JSON.parse(row.settings_json) : {},
        mappings: row.mappings_json ? JSON.parse(row.mappings_json) : {},
        status: row.status,
        version: row.version,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        documentCount: row.document_count,
        sizeInBytes: row.size_in_bytes
      };
      
      this.indexes.set(schema.indexId, schema);

      if (row.sync_enabled) {
        const syncConfig: SyncConfig = {
          indexId: row.index_id,
          enabled: row.sync_enabled,
          syncType: row.sync_type,
          syncInterval: row.sync_interval,
          changeTracking: row.change_tracking,
          lastSyncTime: row.last_sync_time,
          lastSyncVersion: row.last_sync_version
        };
        
        this.syncConfigs.set(schema.indexId, syncConfig);
      }
    }
  }

  /**
   * Create a new search index
   */
  async createIndex(
    name: string,
    tableName: string,
    fields: IndexField[],
    settings?: IndexSettings
  ): Promise<IndexSchema> {
    try {
      const indexId = `idx_${tableName}_${Date.now()}`;
      
      // Generate mappings from fields
      const mappings = this.generateMappings(fields);
      
      // Default settings
      const indexSettings: IndexSettings = {
        numberOfShards: 1,
        numberOfReplicas: 0,
        refreshInterval: '1s',
        maxResultWindow: 10000,
        ...settings
      };

      const schema: IndexSchema = {
        indexId,
        name,
        tableName,
        fields,
        settings: indexSettings,
        mappings,
        status: 'building',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        documentCount: 0,
        sizeInBytes: 0
      };

      // Save to database
      await this.saveIndex(schema);
      
      // Create physical index
      await this.createPhysicalIndex(schema);
      
      // Register with search service
      await searchService.createIndex(indexId, {
        name,
        fields,
        settings: indexSettings as any
      });
      
      this.indexes.set(indexId, schema);
      
      // Start initial indexing
      await this.reindex(indexId, { batchSize: 1000 });
      
      this.emit('indexCreated', { indexId, name });
      
      return schema;
    } catch (error) {
      logger.error('Failed to create index:', error);
      throw error;
    }
  }

  /**
   * Generate field mappings from schema
   */
  private generateMappings(fields: IndexField[]): IndexMappings {
    const properties: Record<string, FieldMapping> = {};
    
    for (const field of fields) {
      const mapping: FieldMapping = {
        type: this.mapFieldType(field.type),
        index: field.searchable !== false,
        store: false,
        boost: field.boost || 1.0
      };

      if (field.type === 'text') {
        mapping.analyzer = field.analyzer || 'standard';
        mapping.searchAnalyzer = field.analyzer || 'standard';
        
        // Add keyword field for aggregations
        if (field.facetable) {
          mapping.fields = {
            keyword: {
              type: 'keyword',
              index: true
            }
          };
        }
      }

      if (field.type === 'date') {
        mapping.format = 'strict_date_optional_time||epoch_millis';
      }

      properties[field.name] = mapping;
    }

    return {
      properties,
      dynamic: 'strict',
      dateDetection: true,
      numericDetection: true
    };
  }

  /**
   * Map field type to index type
   */
  private mapFieldType(type: string): string {
    const typeMap: Record<string, string> = {
      'text': 'text',
      'keyword': 'keyword',
      'number': 'double',
      'date': 'date',
      'boolean': 'boolean',
      'geo': 'geo_point',
      'nested': 'nested'
    };
    
    return typeMap[type] || 'text';
  }

  /**
   * Create physical index in PostgreSQL
   */
  private async createPhysicalIndex(schema: IndexSchema): Promise<void> {
    const textFields = schema.fields
      .filter(f => f.type === 'text' && f.searchable)
      .map(f => f.name);

    if (textFields.length === 0) return;

    // Create GIN index for full-text search
    const indexName = `${schema.tableName}_search_idx`;
    const searchVector = textFields
      .map(field => `to_tsvector('english', COALESCE(${field}::text, ''))`)
      .join(' || ');

    const query = `
      CREATE INDEX IF NOT EXISTS ${indexName}
      ON ${schema.tableName}
      USING GIN ((${searchVector}));
    `;

    await this.pool.query(query);

    // Create additional indexes for facetable fields
    for (const field of schema.fields) {
      if (field.facetable || field.sortable) {
        const facetIndexName = `${schema.tableName}_${field.name}_idx`;
        await this.pool.query(
          `CREATE INDEX IF NOT EXISTS ${facetIndexName} ON ${schema.tableName} (${field.name});`
        );
      }
    }
  }

  /**
   * Save index to database
   */
  private async saveIndex(schema: IndexSchema): Promise<void> {
    const query = `
      INSERT INTO search_indexes (
        index_id, name, table_name, schema_json, 
        settings_json, mappings_json, status, version,
        document_count, size_in_bytes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (index_id) DO UPDATE SET
        name = EXCLUDED.name,
        schema_json = EXCLUDED.schema_json,
        settings_json = EXCLUDED.settings_json,
        mappings_json = EXCLUDED.mappings_json,
        status = EXCLUDED.status,
        version = EXCLUDED.version,
        document_count = EXCLUDED.document_count,
        size_in_bytes = EXCLUDED.size_in_bytes,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(query, [
      schema.indexId,
      schema.name,
      schema.tableName,
      JSON.stringify(schema.fields),
      JSON.stringify(schema.settings),
      JSON.stringify(schema.mappings),
      schema.status,
      schema.version,
      schema.documentCount,
      schema.sizeInBytes
    ]);
  }

  /**
   * Reindex all documents
   */
  async reindex(
    indexId: string,
    options: IndexingOptions = {}
  ): Promise<IndexingTask> {
    const schema = this.indexes.get(indexId);
    if (!schema) {
      throw new Error(`Index ${indexId} not found`);
    }

    const task: IndexingTask = {
      taskId: `task_${Date.now()}`,
      indexId,
      type: 'full',
      status: 'running',
      startTime: new Date(),
      documentsProcessed: 0,
      documentsTotal: 0,
      errors: [],
      progress: 0
    };

    this.indexingTasks.set(task.taskId, task);
    
    try {
      // Update index status
      schema.status = 'rebuilding';
      await this.updateIndexStatus(indexId, 'rebuilding');
      
      // Get total count
      const countResult = await this.pool.query(
        `SELECT COUNT(*) as total FROM ${schema.tableName}`
      );
      task.documentsTotal = parseInt(countResult.rows[0].total);

      // Process in batches
      const batchSize = options.batchSize || 1000;
      let offset = 0;
      
      while (offset < task.documentsTotal) {
        const documents = await this.fetchDocuments(
          schema.tableName,
          offset,
          batchSize
        );

        // Transform documents if needed
        const transformedDocs = options.transformFunction
          ? documents.map(options.transformFunction)
          : documents;

        // Index documents
        for (const doc of transformedDocs) {
          try {
            await this.indexDocument(schema, doc);
            task.documentsProcessed++;
          } catch (error) {
            task.errors.push({
              documentId: doc.id || 'unknown',
              error: error.message,
              timestamp: new Date(),
              retryCount: 0
            });
            
            if (!options.continueOnError) {
              throw error;
            }
          }
        }

        // Update progress
        task.progress = Math.round(
          (task.documentsProcessed / task.documentsTotal) * 100
        );
        
        this.emit('indexingProgress', {
          taskId: task.taskId,
          progress: task.progress,
          documentsProcessed: task.documentsProcessed
        });

        offset += batchSize;
      }

      // Update index status
      schema.status = 'active';
      schema.documentCount = task.documentsProcessed;
      await this.updateIndexStatus(indexId, 'active');
      
      task.status = 'completed';
      task.endTime = new Date();
      
      this.emit('indexingComplete', { taskId: task.taskId, indexId });
      
      return task;
    } catch (error) {
      task.status = 'failed';
      task.endTime = new Date();
      
      schema.status = 'error';
      await this.updateIndexStatus(indexId, 'error');
      
      logger.error(`Indexing failed for ${indexId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch documents from database
   */
  private async fetchDocuments(
    tableName: string,
    offset: number,
    limit: number
  ): Promise<any[]> {
    const query = `
      SELECT * FROM ${tableName}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await this.pool.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Index a single document
   */
  private async indexDocument(
    schema: IndexSchema,
    document: any
  ): Promise<void> {
    // Prepare document for indexing
    const indexDoc: any = {};
    
    for (const field of schema.fields) {
      if (document[field.name] !== undefined) {
        indexDoc[field.name] = document[field.name];
      }
    }

    // Add to search service
    await searchService.indexDocument(schema.indexId, document.id, indexDoc);
    
    // Update Redis cache
    const cacheKey = `search:${schema.indexId}:${document.id}`;
    await redisClient.setex(
      cacheKey,
      3600, // 1 hour cache
      JSON.stringify(indexDoc)
    );
  }

  /**
   * Update index status
   */
  private async updateIndexStatus(
    indexId: string,
    status: string
  ): Promise<void> {
    const query = `
      UPDATE search_indexes
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE index_id = $2
    `;
    
    await this.pool.query(query, [status, indexId]);
  }

  /**
   * Setup real-time change tracking
   */
  private async setupChangeTracking(): Promise<void> {
    // Setup PostgreSQL triggers for change tracking
    for (const [indexId, schema] of this.indexes) {
      const syncConfig = this.syncConfigs.get(indexId);
      
      if (syncConfig?.enabled && syncConfig.syncType === 'real-time') {
        await this.setupTableTriggers(schema);
      }
    }
  }

  /**
   * Setup table triggers for real-time sync
   */
  private async setupTableTriggers(schema: IndexSchema): Promise<void> {
    const triggerName = `search_sync_${schema.tableName}`;
    const functionName = `${triggerName}_func`;

    const query = `
      -- Create trigger function
      CREATE OR REPLACE FUNCTION ${functionName}()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Notify about changes
        PERFORM pg_notify('search_sync', json_build_object(
          'table', TG_TABLE_NAME,
          'operation', TG_OP,
          'id', CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
          END,
          'index_id', '${schema.indexId}'
        )::text);
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Create trigger
      DROP TRIGGER IF EXISTS ${triggerName} ON ${schema.tableName};
      CREATE TRIGGER ${triggerName}
      AFTER INSERT OR UPDATE OR DELETE ON ${schema.tableName}
      FOR EACH ROW EXECUTE FUNCTION ${functionName}();
    `;

    await this.pool.query(query);
    
    // Listen for notifications
    await this.pool.query(`LISTEN search_sync`);
  }

  /**
   * Start sync jobs for batch synchronization
   */
  private async startSyncJobs(): Promise<void> {
    for (const [indexId, syncConfig] of this.syncConfigs) {
      if (syncConfig.enabled && syncConfig.syncType === 'batch' && syncConfig.syncInterval) {
        const job = schedule.schedule(syncConfig.syncInterval, async () => {
          await this.syncIndex(indexId);
        });
        
        this.syncJobs.set(indexId, job);
        job.start();
      }
    }
  }

  /**
   * Sync index with source data
   */
  async syncIndex(indexId: string): Promise<void> {
    const schema = this.indexes.get(indexId);
    const syncConfig = this.syncConfigs.get(indexId);
    
    if (!schema || !syncConfig) {
      throw new Error(`Index or sync config not found for ${indexId}`);
    }

    try {
      let query: string;
      let params: any[] = [];

      // Build sync query based on change tracking type
      switch (syncConfig.changeTracking) {
        case 'timestamp':
          query = `
            SELECT * FROM ${schema.tableName}
            WHERE updated_at > $1
            ORDER BY updated_at ASC
          `;
          params = [syncConfig.lastSyncTime || new Date(0)];
          break;
          
        case 'version':
          query = `
            SELECT * FROM ${schema.tableName}
            WHERE version > $1
            ORDER BY version ASC
          `;
          params = [syncConfig.lastSyncVersion || '0'];
          break;
          
        default:
          // Full sync
          query = `SELECT * FROM ${schema.tableName}`;
      }

      const result = await this.pool.query(query, params);
      
      // Index changed documents
      for (const doc of result.rows) {
        await this.indexDocument(schema, doc);
      }

      // Update sync config
      syncConfig.lastSyncTime = new Date();
      if (result.rows.length > 0) {
        const lastDoc = result.rows[result.rows.length - 1];
        syncConfig.lastSyncVersion = lastDoc.version || lastDoc.id;
      }

      await this.updateSyncConfig(syncConfig);
      
      this.emit('syncComplete', {
        indexId,
        documentsSync: result.rows.length
      });
    } catch (error) {
      logger.error(`Sync failed for index ${indexId}:`, error);
      throw error;
    }
  }

  /**
   * Update sync configuration
   */
  private async updateSyncConfig(config: SyncConfig): Promise<void> {
    const query = `
      INSERT INTO search_index_sync (
        index_id, enabled, sync_type, sync_interval,
        change_tracking, last_sync_time, last_sync_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (index_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        sync_type = EXCLUDED.sync_type,
        sync_interval = EXCLUDED.sync_interval,
        change_tracking = EXCLUDED.change_tracking,
        last_sync_time = EXCLUDED.last_sync_time,
        last_sync_version = EXCLUDED.last_sync_version
    `;

    await this.pool.query(query, [
      config.indexId,
      config.enabled,
      config.syncType,
      config.syncInterval,
      config.changeTracking,
      config.lastSyncTime,
      config.lastSyncVersion
    ]);
  }

  /**
   * Get index statistics
   */
  async getIndexStats(indexId: string): Promise<IndexStats> {
    const schema = this.indexes.get(indexId);
    if (!schema) {
      throw new Error(`Index ${indexId} not found`);
    }

    // Get basic stats
    const statsQuery = `
      SELECT 
        COUNT(*) as search_count,
        AVG(search_latency) as avg_search_latency,
        AVG(indexing_rate) as indexing_rate
      FROM search_index_stats
      WHERE index_id = $1
      AND stat_date >= CURRENT_DATE - INTERVAL '7 days'
    `;

    const statsResult = await this.pool.query(statsQuery, [indexId]);
    const stats = statsResult.rows[0];

    // Get field statistics
    const fieldStats: Record<string, FieldStats> = {};
    
    for (const field of schema.fields) {
      const fieldQuery = `
        SELECT 
          COUNT(DISTINCT ${field.name}) as unique_values,
          COUNT(*) FILTER (WHERE ${field.name} IS NULL) as null_count,
          MIN(${field.name}) as min_value,
          MAX(${field.name}) as max_value
        FROM ${schema.tableName}
      `;

      const fieldResult = await this.pool.query(fieldQuery);
      const fieldStat = fieldResult.rows[0];

      fieldStats[field.name] = {
        uniqueValues: parseInt(fieldStat.unique_values),
        nullCount: parseInt(fieldStat.null_count),
        minValue: fieldStat.min_value,
        maxValue: fieldStat.max_value
      };

      // Get top values for facetable fields
      if (field.facetable) {
        const topValuesQuery = `
          SELECT ${field.name} as value, COUNT(*) as count
          FROM ${schema.tableName}
          WHERE ${field.name} IS NOT NULL
          GROUP BY ${field.name}
          ORDER BY count DESC
          LIMIT 10
        `;

        const topValuesResult = await this.pool.query(topValuesQuery);
        fieldStats[field.name].topValues = topValuesResult.rows;
      }
    }

    return {
      indexId,
      documentCount: schema.documentCount,
      sizeInBytes: schema.sizeInBytes,
      searchCount: parseInt(stats?.search_count || '0'),
      avgSearchLatency: parseFloat(stats?.avg_search_latency || '0'),
      indexingRate: parseFloat(stats?.indexing_rate || '0'),
      lastIndexedAt: schema.updatedAt,
      fieldStats
    };
  }

  /**
   * Optimize index
   */
  async optimizeIndex(indexId: string): Promise<void> {
    const schema = this.indexes.get(indexId);
    if (!schema) {
      throw new Error(`Index ${indexId} not found`);
    }

    try {
      // Analyze table for query optimization
      await this.pool.query(`ANALYZE ${schema.tableName}`);
      
      // Reindex if needed
      await this.pool.query(`REINDEX TABLE ${schema.tableName}`);
      
      // Clear cache
      const pattern = `search:${indexId}:*`;
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }

      // Update statistics
      await this.updateIndexStatistics(indexId);
      
      this.emit('indexOptimized', { indexId });
    } catch (error) {
      logger.error(`Failed to optimize index ${indexId}:`, error);
      throw error;
    }
  }

  /**
   * Update index statistics
   */
  private async updateIndexStatistics(indexId: string): Promise<void> {
    const schema = this.indexes.get(indexId);
    if (!schema) return;

    // Get document count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as count FROM ${schema.tableName}`
    );
    schema.documentCount = parseInt(countResult.rows[0].count);

    // Estimate size
    const sizeResult = await this.pool.query(
      `SELECT pg_total_relation_size('${schema.tableName}') as size`
    );
    schema.sizeInBytes = parseInt(sizeResult.rows[0].size);

    // Update in database
    await this.pool.query(
      `UPDATE search_indexes 
       SET document_count = $1, size_in_bytes = $2, updated_at = CURRENT_TIMESTAMP
       WHERE index_id = $3`,
      [schema.documentCount, schema.sizeInBytes, indexId]
    );
  }

  /**
   * Delete an index
   */
  async deleteIndex(indexId: string): Promise<boolean> {
    try {
      const schema = this.indexes.get(indexId);
      if (!schema) {
        return false;
      }

      // Stop sync job if exists
      const syncJob = this.syncJobs.get(indexId);
      if (syncJob) {
        syncJob.stop();
        this.syncJobs.delete(indexId);
      }

      // Remove from search service
      await searchService.deleteIndex(indexId);
      
      // Drop physical indexes
      await this.dropPhysicalIndexes(schema);
      
      // Mark as deleted in database
      await this.pool.query(
        `UPDATE search_indexes SET status = 'deleted' WHERE index_id = $1`,
        [indexId]
      );

      // Clear cache
      const pattern = `search:${indexId}:*`;
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }

      this.indexes.delete(indexId);
      this.syncConfigs.delete(indexId);
      
      this.emit('indexDeleted', { indexId });
      
      return true;
    } catch (error) {
      logger.error(`Failed to delete index ${indexId}:`, error);
      throw error;
    }
  }

  /**
   * Drop physical indexes
   */
  private async dropPhysicalIndexes(schema: IndexSchema): Promise<void> {
    const indexName = `${schema.tableName}_search_idx`;
    await this.pool.query(`DROP INDEX IF EXISTS ${indexName}`);

    for (const field of schema.fields) {
      if (field.facetable || field.sortable) {
        const facetIndexName = `${schema.tableName}_${field.name}_idx`;
        await this.pool.query(`DROP INDEX IF EXISTS ${facetIndexName}`);
      }
    }
  }

  /**
   * Get all indexes
   */
  getIndexes(): IndexSchema[] {
    return Array.from(this.indexes.values());
  }

  /**
   * Get index by ID
   */
  getIndex(indexId: string): IndexSchema | undefined {
    return this.indexes.get(indexId);
  }

  /**
   * Get indexing task status
   */
  getIndexingTask(taskId: string): IndexingTask | undefined {
    return this.indexingTasks.get(taskId);
  }

  /**
   * Cancel indexing task
   */
  async cancelIndexingTask(taskId: string): Promise<boolean> {
    const task = this.indexingTasks.get(taskId);
    if (!task || task.status !== 'running') {
      return false;
    }

    task.status = 'cancelled';
    task.endTime = new Date();
    
    this.emit('indexingCancelled', { taskId });
    
    return true;
  }

  /**
   * Cleanup old tasks
   */
  async cleanupOldTasks(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let cleaned = 0;
    
    for (const [taskId, task] of this.indexingTasks) {
      if (task.endTime && task.endTime < cutoffDate) {
        this.indexingTasks.delete(taskId);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Export singleton instance
const searchIndexingService = new SearchIndexingService();
export default searchIndexingService;