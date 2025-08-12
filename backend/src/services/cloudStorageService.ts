/**
 * Cloud Storage Service
 * Multi-provider cloud storage integration with MEGA as primary provider
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import { Storage } from 'megajs';
import redisClient from '../config/redis';
import logger from '../utils/logger';

// Types
export interface CloudProvider {
  name: string;
  type: 'mega' | 's3' | 'gcs' | 'azure' | 'dropbox';
  config: CloudProviderConfig;
  isDefault: boolean;
  isActive: boolean;
  quota: {
    used: number;
    total: number;
    available: number;
  };
}

export interface CloudProviderConfig {
  // MEGA Configuration
  mega?: {
    email: string;
    password: string;
    keepalive?: boolean;
    autoload?: boolean;
  };

  // AWS S3 Configuration
  s3?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucket: string;
    endpoint?: string;
  };

  // Google Cloud Storage Configuration
  gcs?: {
    projectId: string;
    keyFilename: string;
    bucket: string;
  };

  // Azure Blob Storage Configuration
  azure?: {
    connectionString: string;
    containerName: string;
  };

  // Dropbox Configuration
  dropbox?: {
    accessToken: string;
    refreshToken?: string;
    appKey: string;
    appSecret: string;
  };
}

export interface CloudFile {
  id: string;
  localFileId: string;
  provider: string;
  cloudPath: string;
  size: number;
  hash: string;
  uploadedAt: Date;
  lastModified: Date;
  isPublic: boolean;
  shareUrl?: string;
  downloadUrl?: string;
  expiresAt?: Date;
  metadata: Record<string, any>;
  syncStatus: 'pending' | 'uploading' | 'synced' | 'error' | 'deleted';
  errorMessage?: string;
  retryCount: number;
}

export interface UploadProgress {
  fileId: string;
  provider: string;
  progress: number; // 0-100
  uploadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
  status: 'preparing' | 'uploading' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface SyncJob {
  jobId: string;
  type: 'upload' | 'download' | 'delete' | 'sync';
  fileId: string;
  provider: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number; // 1-10, higher is more urgent
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  progress?: number;
}

export interface StorageQuota {
  provider: string;
  used: number;
  total: number;
  available: number;
  filesCount: number;
  lastUpdated: Date;
}

export interface SyncPolicy {
  policyId: string;
  name: string;
  conditions: {
    fileTypes?: string[];
    maxSize?: number;
    categories?: string[];
    tags?: string[];
  };
  actions: {
    primaryProvider: string;
    backupProviders?: string[];
    autoSync: boolean;
    syncDelay?: number; // seconds
    compression?: boolean;
    encryption?: boolean;
  };
  schedule?: {
    enabled: boolean;
    pattern: string; // cron pattern
    timezone: string;
  };
  isActive: boolean;
}

class CloudStorageService extends EventEmitter {
  private providers: Map<string, CloudProvider> = new Map();
  private connections: Map<string, any> = new Map(); // Provider connections
  private syncQueue: SyncJob[] = [];
  private activeSyncJobs: Map<string, SyncJob> = new Map();
  private syncPolicies: Map<string, SyncPolicy> = new Map();
  private pool: Pool;
  private isInitialized: boolean = false;
  private syncWorkerInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Initialize cloud storage service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create database tables
      await this.createTables();
      
      // Load providers configuration
      await this.loadProviders();
      
      // Initialize provider connections
      await this.initializeProviders();
      
      // Load sync policies
      await this.loadSyncPolicies();
      
      // Start sync worker
      this.startSyncWorker();
      
      this.isInitialized = true;
      logger.info('Cloud storage service initialized');
    } catch (error) {
      logger.error('Failed to initialize cloud storage service:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const queries = [
      `
        CREATE TABLE IF NOT EXISTS cloud_providers (
          provider_id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          config JSONB NOT NULL,
          is_default BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          quota_used BIGINT DEFAULT 0,
          quota_total BIGINT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS cloud_files (
          cloud_file_id VARCHAR(255) PRIMARY KEY,
          local_file_id VARCHAR(255) NOT NULL,
          provider VARCHAR(255) NOT NULL,
          cloud_path TEXT NOT NULL,
          size BIGINT NOT NULL,
          hash VARCHAR(64) NOT NULL,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_public BOOLEAN DEFAULT false,
          share_url TEXT,
          download_url TEXT,
          expires_at TIMESTAMP,
          metadata JSONB,
          sync_status VARCHAR(50) DEFAULT 'pending',
          error_message TEXT,
          retry_count INTEGER DEFAULT 0,
          FOREIGN KEY (local_file_id) REFERENCES files(file_id) ON DELETE CASCADE,
          FOREIGN KEY (provider) REFERENCES cloud_providers(provider_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_cloud_files_local ON cloud_files(local_file_id);
        CREATE INDEX IF NOT EXISTS idx_cloud_files_provider ON cloud_files(provider);
        CREATE INDEX IF NOT EXISTS idx_cloud_files_status ON cloud_files(sync_status);
        CREATE INDEX IF NOT EXISTS idx_cloud_files_hash ON cloud_files(hash);
      `,
      `
        CREATE TABLE IF NOT EXISTS sync_jobs (
          job_id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          file_id VARCHAR(255) NOT NULL,
          provider VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          priority INTEGER DEFAULT 5,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          retry_count INTEGER DEFAULT 0,
          max_retries INTEGER DEFAULT 3,
          error_message TEXT,
          progress INTEGER DEFAULT 0,
          metadata JSONB
        );
        
        CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_sync_jobs_priority ON sync_jobs(priority DESC);
        CREATE INDEX IF NOT EXISTS idx_sync_jobs_created ON sync_jobs(created_at);
      `,
      `
        CREATE TABLE IF NOT EXISTS sync_policies (
          policy_id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          conditions JSONB,
          actions JSONB,
          schedule JSONB,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS storage_quotas (
          provider VARCHAR(255) PRIMARY KEY,
          used_bytes BIGINT DEFAULT 0,
          total_bytes BIGINT DEFAULT 0,
          files_count INTEGER DEFAULT 0,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (provider) REFERENCES cloud_providers(provider_id)
        );
      `
    ];

    for (const query of queries) {
      await this.pool.query(query);
    }
  }

  /**
   * Load providers from configuration
   */
  private async loadProviders(): Promise<void> {
    // Load from database
    const result = await this.pool.query(
      'SELECT * FROM cloud_providers WHERE is_active = true'
    );

    for (const row of result.rows) {
      const provider: CloudProvider = {
        name: row.name,
        type: row.type,
        config: row.config,
        isDefault: row.is_default,
        isActive: row.is_active,
        quota: {
          used: parseInt(row.quota_used),
          total: parseInt(row.quota_total),
          available: parseInt(row.quota_total) - parseInt(row.quota_used)
        }
      };

      this.providers.set(row.provider_id, provider);
    }

    // If no providers configured, create default MEGA provider
    if (this.providers.size === 0) {
      await this.createDefaultMegaProvider();
    }
  }

  /**
   * Create default MEGA provider
   */
  private async createDefaultMegaProvider(): Promise<void> {
    const providerId = 'mega_primary';
    const provider: CloudProvider = {
      name: 'MEGA Storage',
      type: 'mega',
      config: {
        mega: {
          email: process.env.MEGA_EMAIL || '',
          password: process.env.MEGA_PASSWORD || '',
          keepalive: true,
          autoload: true
        }
      },
      isDefault: true,
      isActive: true,
      quota: {
        used: 0,
        total: 50 * 1024 * 1024 * 1024, // 50GB default
        available: 50 * 1024 * 1024 * 1024
      }
    };

    // Save to database
    await this.pool.query(
      `INSERT INTO cloud_providers (
        provider_id, name, type, config, is_default, is_active,
        quota_used, quota_total
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        providerId,
        provider.name,
        provider.type,
        JSON.stringify(provider.config),
        provider.isDefault,
        provider.isActive,
        provider.quota.used,
        provider.quota.total
      ]
    );

    this.providers.set(providerId, provider);
    logger.info('Created default MEGA provider');
  }

  /**
   * Initialize provider connections
   */
  private async initializeProviders(): Promise<void> {
    for (const [providerId, provider] of this.providers) {
      try {
        await this.initializeProvider(providerId, provider);
      } catch (error) {
        logger.error(`Failed to initialize provider ${providerId}:`, error);
        provider.isActive = false;
      }
    }
  }

  /**
   * Initialize single provider connection
   */
  private async initializeProvider(providerId: string, provider: CloudProvider): Promise<void> {
    switch (provider.type) {
      case 'mega':
        await this.initializeMegaProvider(providerId, provider);
        break;
      case 's3':
        await this.initializeS3Provider(providerId, provider);
        break;
      case 'gcs':
        await this.initializeGCSProvider(providerId, provider);
        break;
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }
  }

  /**
   * Initialize MEGA provider
   */
  private async initializeMegaProvider(providerId: string, provider: CloudProvider): Promise<void> {
    const megaConfig = provider.config.mega!;
    
    if (!megaConfig.email || !megaConfig.password) {
      throw new Error('MEGA credentials not configured');
    }

    try {
      const storage = await Storage({
        email: megaConfig.email,
        password: megaConfig.password,
        keepalive: megaConfig.keepalive,
        autoload: megaConfig.autoload
      });

      // Test connection
      await storage.ready;
      
      // Get account info
      const accountInfo = storage.root;
      if (accountInfo) {
        // Update quota information
        const quota = await this.getMegaQuota(storage);
        provider.quota = quota;
        
        await this.updateProviderQuota(providerId, quota);
      }

      this.connections.set(providerId, storage);
      logger.info(`MEGA provider ${providerId} initialized successfully`);
    } catch (error) {
      logger.error(`Failed to initialize MEGA provider ${providerId}:`, error);
      throw error;
    }
  }

  /**
   * Initialize AWS S3 provider
   */
  private async initializeS3Provider(providerId: string, provider: CloudProvider): Promise<void> {
    // Placeholder for S3 initialization
    // In production, use AWS SDK
    logger.info(`S3 provider ${providerId} initialized (placeholder)`);
  }

  /**
   * Initialize Google Cloud Storage provider
   */
  private async initializeGCSProvider(providerId: string, provider: CloudProvider): Promise<void> {
    // Placeholder for GCS initialization
    // In production, use Google Cloud SDK
    logger.info(`GCS provider ${providerId} initialized (placeholder)`);
  }

  /**
   * Get MEGA quota information
   */
  private async getMegaQuota(storage: any): Promise<StorageQuota> {
    try {
      // MEGA API doesn't provide direct quota info in megajs
      // This is a simplified implementation
      return {
        provider: 'mega',
        used: 0,
        total: 50 * 1024 * 1024 * 1024, // 50GB
        available: 50 * 1024 * 1024 * 1024,
        filesCount: 0,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Failed to get MEGA quota:', error);
      throw error;
    }
  }

  /**
   * Upload file to cloud storage
   */
  async uploadFile(
    localFileId: string,
    filePath: string,
    options: {
      provider?: string;
      isPublic?: boolean;
      encryption?: boolean;
      compression?: boolean;
      expiresAt?: Date;
      customPath?: string;
    } = {}
  ): Promise<CloudFile> {
    try {
      const providerId = options.provider || this.getDefaultProvider();
      const provider = this.providers.get(providerId);
      
      if (!provider || !provider.isActive) {
        throw new Error(`Provider ${providerId} not available`);
      }

      // Create sync job
      const jobId = this.generateJobId();
      const syncJob: SyncJob = {
        jobId,
        type: 'upload',
        fileId: localFileId,
        provider: providerId,
        status: 'pending',
        priority: 5,
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      await this.saveSyncJob(syncJob);

      // Get file stats
      const stats = await fs.stat(filePath);
      const hash = await this.calculateFileHash(filePath);

      // Check for existing file with same hash
      const existingFile = await this.findCloudFileByHash(hash, providerId);
      if (existingFile) {
        return existingFile;
      }

      // Generate cloud path
      const cloudPath = options.customPath || this.generateCloudPath(localFileId, path.basename(filePath));

      // Create cloud file record
      const cloudFileId = this.generateCloudFileId();
      const cloudFile: CloudFile = {
        id: cloudFileId,
        localFileId,
        provider: providerId,
        cloudPath,
        size: stats.size,
        hash,
        uploadedAt: new Date(),
        lastModified: stats.mtime,
        isPublic: options.isPublic || false,
        expiresAt: options.expiresAt,
        metadata: {
          encryption: options.encryption || false,
          compression: options.compression || false,
          originalName: path.basename(filePath)
        },
        syncStatus: 'uploading',
        retryCount: 0
      };

      await this.saveCloudFile(cloudFile);

      // Start upload based on provider type
      switch (provider.type) {
        case 'mega':
          await this.uploadToMega(cloudFile, filePath, providerId);
          break;
        case 's3':
          await this.uploadToS3(cloudFile, filePath, providerId);
          break;
        default:
          throw new Error(`Upload not implemented for provider type: ${provider.type}`);
      }

      // Update sync job status
      syncJob.status = 'completed';
      syncJob.completedAt = new Date();
      await this.updateSyncJob(syncJob);

      // Update cloud file status
      cloudFile.syncStatus = 'synced';
      await this.updateCloudFile(cloudFile);

      this.emit('fileUploaded', { cloudFile, provider: providerId });

      return cloudFile;
    } catch (error) {
      logger.error('Cloud file upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload to MEGA
   */
  private async uploadToMega(cloudFile: CloudFile, filePath: string, providerId: string): Promise<void> {
    const storage = this.connections.get(providerId);
    if (!storage) {
      throw new Error('MEGA connection not available');
    }

    try {
      // Read file data
      const fileData = await fs.readFile(filePath);
      
      // Upload to MEGA
      const uploadedFile = await storage.root.upload({
        name: path.basename(cloudFile.cloudPath),
        size: fileData.length
      }, fileData);

      // Get public share link if requested
      if (cloudFile.isPublic) {
        const shareUrl = await uploadedFile.link();
        cloudFile.shareUrl = shareUrl;
        cloudFile.downloadUrl = shareUrl;
      }

      // Update metadata with MEGA-specific info
      cloudFile.metadata = {
        ...cloudFile.metadata,
        megaNodeId: uploadedFile.nodeId,
        megaKey: uploadedFile.key
      };

      logger.info(`File uploaded to MEGA: ${cloudFile.cloudPath}`);
    } catch (error) {
      logger.error('MEGA upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload to AWS S3 (placeholder)
   */
  private async uploadToS3(cloudFile: CloudFile, filePath: string, providerId: string): Promise<void> {
    // Placeholder implementation
    logger.info(`S3 upload placeholder for: ${cloudFile.cloudPath}`);
  }

  /**
   * Download file from cloud storage
   */
  async downloadFile(cloudFileId: string, destinationPath: string): Promise<boolean> {
    try {
      const cloudFile = await this.getCloudFile(cloudFileId);
      if (!cloudFile) {
        throw new Error('Cloud file not found');
      }

      const provider = this.providers.get(cloudFile.provider);
      if (!provider || !provider.isActive) {
        throw new Error(`Provider ${cloudFile.provider} not available`);
      }

      switch (provider.type) {
        case 'mega':
          return await this.downloadFromMega(cloudFile, destinationPath);
        case 's3':
          return await this.downloadFromS3(cloudFile, destinationPath);
        default:
          throw new Error(`Download not implemented for provider type: ${provider.type}`);
      }
    } catch (error) {
      logger.error('Cloud file download failed:', error);
      return false;
    }
  }

  /**
   * Download from MEGA
   */
  private async downloadFromMega(cloudFile: CloudFile, destinationPath: string): Promise<boolean> {
    const storage = this.connections.get(cloudFile.provider);
    if (!storage) {
      throw new Error('MEGA connection not available');
    }

    try {
      const nodeId = cloudFile.metadata.megaNodeId;
      const file = storage.root.children.find((child: any) => child.nodeId === nodeId);
      
      if (!file) {
        throw new Error('File not found in MEGA storage');
      }

      const downloadStream = file.download();
      const writeStream = require('fs').createWriteStream(destinationPath);

      return new Promise((resolve, reject) => {
        downloadStream.pipe(writeStream);
        
        writeStream.on('finish', () => {
          logger.info(`File downloaded from MEGA: ${cloudFile.cloudPath}`);
          resolve(true);
        });
        
        writeStream.on('error', reject);
        downloadStream.on('error', reject);
      });
    } catch (error) {
      logger.error('MEGA download failed:', error);
      return false;
    }
  }

  /**
   * Download from S3 (placeholder)
   */
  private async downloadFromS3(cloudFile: CloudFile, destinationPath: string): Promise<boolean> {
    // Placeholder implementation
    logger.info(`S3 download placeholder for: ${cloudFile.cloudPath}`);
    return true;
  }

  /**
   * Delete file from cloud storage
   */
  async deleteCloudFile(cloudFileId: string): Promise<boolean> {
    try {
      const cloudFile = await this.getCloudFile(cloudFileId);
      if (!cloudFile) {
        return false;
      }

      const provider = this.providers.get(cloudFile.provider);
      if (!provider) {
        return false;
      }

      // Delete from cloud provider
      let deleted = false;
      switch (provider.type) {
        case 'mega':
          deleted = await this.deleteFromMega(cloudFile);
          break;
        case 's3':
          deleted = await this.deleteFromS3(cloudFile);
          break;
        default:
          logger.warn(`Delete not implemented for provider type: ${provider.type}`);
          deleted = true; // Mark as deleted locally
      }

      if (deleted) {
        // Update status in database
        cloudFile.syncStatus = 'deleted';
        await this.updateCloudFile(cloudFile);

        this.emit('fileDeleted', { cloudFileId, provider: cloudFile.provider });
      }

      return deleted;
    } catch (error) {
      logger.error('Cloud file deletion failed:', error);
      return false;
    }
  }

  /**
   * Delete from MEGA
   */
  private async deleteFromMega(cloudFile: CloudFile): Promise<boolean> {
    const storage = this.connections.get(cloudFile.provider);
    if (!storage) {
      return false;
    }

    try {
      const nodeId = cloudFile.metadata.megaNodeId;
      const file = storage.root.children.find((child: any) => child.nodeId === nodeId);
      
      if (file) {
        await file.delete();
        logger.info(`File deleted from MEGA: ${cloudFile.cloudPath}`);
      }

      return true;
    } catch (error) {
      logger.error('MEGA deletion failed:', error);
      return false;
    }
  }

  /**
   * Delete from S3 (placeholder)
   */
  private async deleteFromS3(cloudFile: CloudFile): Promise<boolean> {
    logger.info(`S3 deletion placeholder for: ${cloudFile.cloudPath}`);
    return true;
  }

  /**
   * Sync file with cloud storage
   */
  async syncFile(localFileId: string, providerId?: string): Promise<boolean> {
    try {
      const provider = providerId || this.getDefaultProvider();
      
      // Create sync job
      const jobId = this.generateJobId();
      const syncJob: SyncJob = {
        jobId,
        type: 'sync',
        fileId: localFileId,
        provider,
        status: 'pending',
        priority: 5,
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      await this.saveSyncJob(syncJob);
      this.addToSyncQueue(syncJob);

      return true;
    } catch (error) {
      logger.error('File sync failed:', error);
      return false;
    }
  }

  /**
   * Get cloud files for local file
   */
  async getCloudFilesForLocal(localFileId: string): Promise<CloudFile[]> {
    const result = await this.pool.query(
      'SELECT * FROM cloud_files WHERE local_file_id = $1 AND sync_status != \'deleted\'',
      [localFileId]
    );

    return result.rows.map(this.mapRowToCloudFile);
  }

  /**
   * Get cloud file by ID
   */
  async getCloudFile(cloudFileId: string): Promise<CloudFile | null> {
    const result = await this.pool.query(
      'SELECT * FROM cloud_files WHERE cloud_file_id = $1',
      [cloudFileId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToCloudFile(result.rows[0]);
  }

  /**
   * Get storage quota for provider
   */
  async getStorageQuota(providerId: string): Promise<StorageQuota | null> {
    const provider = this.providers.get(providerId);
    if (!provider) return null;

    return {
      provider: providerId,
      used: provider.quota.used,
      total: provider.quota.total,
      available: provider.quota.available,
      filesCount: 0, // Would need to count from database
      lastUpdated: new Date()
    };
  }

  /**
   * Get all storage quotas
   */
  async getAllStorageQuotas(): Promise<StorageQuota[]> {
    const quotas: StorageQuota[] = [];
    
    for (const [providerId, provider] of this.providers) {
      if (provider.isActive) {
        const quota = await this.getStorageQuota(providerId);
        if (quota) {
          quotas.push(quota);
        }
      }
    }

    return quotas;
  }

  /**
   * Get sync jobs status
   */
  async getSyncJobsStatus(): Promise<{
    pending: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    const result = await this.pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM sync_jobs
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      GROUP BY status
    `);

    const stats = { pending: 0, running: 0, completed: 0, failed: 0 };
    
    for (const row of result.rows) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = parseInt(row.count);
      }
    }

    return stats;
  }

  /**
   * Load sync policies
   */
  private async loadSyncPolicies(): Promise<void> {
    const result = await this.pool.query(
      'SELECT * FROM sync_policies WHERE is_active = true'
    );

    for (const row of result.rows) {
      const policy: SyncPolicy = {
        policyId: row.policy_id,
        name: row.name,
        conditions: row.conditions,
        actions: row.actions,
        schedule: row.schedule,
        isActive: row.is_active
      };

      this.syncPolicies.set(policy.policyId, policy);
    }
  }

  /**
   * Start sync worker
   */
  private startSyncWorker(): void {
    // Process sync queue every 10 seconds
    this.syncWorkerInterval = setInterval(async () => {
      try {
        await this.processSyncQueue();
      } catch (error) {
        logger.error('Sync worker error:', error);
      }
    }, 10000);
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    // Get pending jobs from database
    const result = await this.pool.query(`
      SELECT * FROM sync_jobs 
      WHERE status = 'pending' 
      ORDER BY priority DESC, created_at ASC 
      LIMIT 5
    `);

    for (const row of result.rows) {
      const job = this.mapRowToSyncJob(row);
      
      if (this.activeSyncJobs.size < 3) { // Max 3 concurrent jobs
        await this.processSyncJob(job);
      }
    }
  }

  /**
   * Process single sync job
   */
  private async processSyncJob(job: SyncJob): Promise<void> {
    try {
      this.activeSyncJobs.set(job.jobId, job);
      
      // Update job status
      job.status = 'running';
      job.startedAt = new Date();
      await this.updateSyncJob(job);

      // Process based on job type
      switch (job.type) {
        case 'upload':
          await this.processSyncUpload(job);
          break;
        case 'download':
          await this.processSyncDownload(job);
          break;
        case 'delete':
          await this.processSyncDelete(job);
          break;
        case 'sync':
          await this.processSyncSync(job);
          break;
      }

      // Mark as completed
      job.status = 'completed';
      job.completedAt = new Date();
      await this.updateSyncJob(job);

    } catch (error) {
      logger.error(`Sync job ${job.jobId} failed:`, error);
      
      job.status = 'failed';
      job.errorMessage = error.message;
      job.retryCount++;
      
      // Retry if within limits
      if (job.retryCount <= job.maxRetries) {
        job.status = 'pending';
        // Add exponential backoff delay
        setTimeout(async () => {
          await this.updateSyncJob(job);
        }, Math.pow(2, job.retryCount) * 1000);
      } else {
        job.completedAt = new Date();
        await this.updateSyncJob(job);
      }
    } finally {
      this.activeSyncJobs.delete(job.jobId);
    }
  }

  /**
   * Process sync upload job
   */
  private async processSyncUpload(job: SyncJob): Promise<void> {
    // Get file info from database
    const fileResult = await this.pool.query(
      'SELECT * FROM files WHERE file_id = $1',
      [job.fileId]
    );

    if (fileResult.rows.length === 0) {
      throw new Error('File not found');
    }

    const file = fileResult.rows[0];
    
    // Upload file
    await this.uploadFile(job.fileId, file.path, {
      provider: job.provider
    });
  }

  /**
   * Process sync download job
   */
  private async processSyncDownload(job: SyncJob): Promise<void> {
    // Implementation for download sync
    logger.info(`Processing download sync for job ${job.jobId}`);
  }

  /**
   * Process sync delete job
   */
  private async processSyncDelete(job: SyncJob): Promise<void> {
    // Get cloud files for this file
    const cloudFiles = await this.getCloudFilesForLocal(job.fileId);
    
    for (const cloudFile of cloudFiles) {
      if (cloudFile.provider === job.provider) {
        await this.deleteCloudFile(cloudFile.id);
      }
    }
  }

  /**
   * Process sync sync job
   */
  private async processSyncSync(job: SyncJob): Promise<void> {
    // Check if file needs to be synced based on policies
    const shouldSync = await this.shouldSyncFile(job.fileId, job.provider);
    
    if (shouldSync) {
      await this.processSyncUpload(job);
    }
  }

  /**
   * Should sync file based on policies
   */
  private async shouldSyncFile(fileId: string, providerId: string): Promise<boolean> {
    // Get file info
    const fileResult = await this.pool.query(
      'SELECT * FROM files WHERE file_id = $1',
      [fileId]
    );

    if (fileResult.rows.length === 0) {
      return false;
    }

    const file = fileResult.rows[0];
    
    // Check sync policies
    for (const [policyId, policy] of this.syncPolicies) {
      if (!policy.isActive || policy.actions.primaryProvider !== providerId) {
        continue;
      }

      // Check conditions
      if (this.matchesPolicyConditions(file, policy.conditions)) {
        return policy.actions.autoSync;
      }
    }

    return false;
  }

  /**
   * Check if file matches policy conditions
   */
  private matchesPolicyConditions(file: any, conditions: any): boolean {
    if (conditions.fileTypes && !conditions.fileTypes.includes(file.mimetype)) {
      return false;
    }

    if (conditions.maxSize && file.size > conditions.maxSize) {
      return false;
    }

    if (conditions.categories && !conditions.categories.includes(file.category)) {
      return false;
    }

    if (conditions.tags && file.tags) {
      const fileTags = file.tags;
      const hasMatchingTag = conditions.tags.some((tag: string) => fileTags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  }

  /**
   * Add job to sync queue
   */
  private addToSyncQueue(job: SyncJob): void {
    this.syncQueue.push(job);
    this.syncQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate file hash
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = require('fs').createReadStream(filePath);
      
      stream.on('data', (data: Buffer) => {
        hash.update(data);
      });
      
      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * Find cloud file by hash
   */
  private async findCloudFileByHash(hash: string, provider: string): Promise<CloudFile | null> {
    const result = await this.pool.query(
      'SELECT * FROM cloud_files WHERE hash = $1 AND provider = $2 AND sync_status = \'synced\'',
      [hash, provider]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToCloudFile(result.rows[0]);
  }

  /**
   * Get default provider
   */
  private getDefaultProvider(): string {
    for (const [providerId, provider] of this.providers) {
      if (provider.isDefault && provider.isActive) {
        return providerId;
      }
    }

    // Return first active provider
    for (const [providerId, provider] of this.providers) {
      if (provider.isActive) {
        return providerId;
      }
    }

    throw new Error('No active cloud provider available');
  }

  /**
   * Generate cloud path
   */
  private generateCloudPath(fileId: string, filename: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return `uploads/${year}/${month}/${fileId}_${filename}`;
  }

  /**
   * Generate IDs
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private generateCloudFileId(): string {
    return `cf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Database operations
   */
  private async saveCloudFile(cloudFile: CloudFile): Promise<void> {
    await this.pool.query(`
      INSERT INTO cloud_files (
        cloud_file_id, local_file_id, provider, cloud_path, size, hash,
        uploaded_at, last_modified, is_public, share_url, download_url,
        expires_at, metadata, sync_status, retry_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      cloudFile.id,
      cloudFile.localFileId,
      cloudFile.provider,
      cloudFile.cloudPath,
      cloudFile.size,
      cloudFile.hash,
      cloudFile.uploadedAt,
      cloudFile.lastModified,
      cloudFile.isPublic,
      cloudFile.shareUrl,
      cloudFile.downloadUrl,
      cloudFile.expiresAt,
      JSON.stringify(cloudFile.metadata),
      cloudFile.syncStatus,
      cloudFile.retryCount
    ]);
  }

  private async updateCloudFile(cloudFile: CloudFile): Promise<void> {
    await this.pool.query(`
      UPDATE cloud_files SET
        sync_status = $1,
        share_url = $2,
        download_url = $3,
        metadata = $4,
        retry_count = $5,
        error_message = $6
      WHERE cloud_file_id = $7
    `, [
      cloudFile.syncStatus,
      cloudFile.shareUrl,
      cloudFile.downloadUrl,
      JSON.stringify(cloudFile.metadata),
      cloudFile.retryCount,
      cloudFile.errorMessage,
      cloudFile.id
    ]);
  }

  private async saveSyncJob(job: SyncJob): Promise<void> {
    await this.pool.query(`
      INSERT INTO sync_jobs (
        job_id, type, file_id, provider, status, priority,
        retry_count, max_retries, error_message, progress
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      job.jobId,
      job.type,
      job.fileId,
      job.provider,
      job.status,
      job.priority,
      job.retryCount,
      job.maxRetries,
      job.errorMessage,
      job.progress
    ]);
  }

  private async updateSyncJob(job: SyncJob): Promise<void> {
    await this.pool.query(`
      UPDATE sync_jobs SET
        status = $1,
        started_at = $2,
        completed_at = $3,
        retry_count = $4,
        error_message = $5,
        progress = $6
      WHERE job_id = $7
    `, [
      job.status,
      job.startedAt,
      job.completedAt,
      job.retryCount,
      job.errorMessage,
      job.progress,
      job.jobId
    ]);
  }

  private async updateProviderQuota(providerId: string, quota: any): Promise<void> {
    await this.pool.query(`
      UPDATE cloud_providers SET
        quota_used = $1,
        quota_total = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE provider_id = $3
    `, [quota.used, quota.total, providerId]);
  }

  /**
   * Map database rows to objects
   */
  private mapRowToCloudFile(row: any): CloudFile {
    return {
      id: row.cloud_file_id,
      localFileId: row.local_file_id,
      provider: row.provider,
      cloudPath: row.cloud_path,
      size: parseInt(row.size),
      hash: row.hash,
      uploadedAt: row.uploaded_at,
      lastModified: row.last_modified,
      isPublic: row.is_public,
      shareUrl: row.share_url,
      downloadUrl: row.download_url,
      expiresAt: row.expires_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      syncStatus: row.sync_status,
      errorMessage: row.error_message,
      retryCount: row.retry_count
    };
  }

  private mapRowToSyncJob(row: any): SyncJob {
    return {
      jobId: row.job_id,
      type: row.type,
      fileId: row.file_id,
      provider: row.provider,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      errorMessage: row.error_message,
      progress: row.progress
    };
  }

  /**
   * Get service statistics
   */
  async getStatistics(): Promise<{
    totalCloudFiles: number;
    totalCloudSize: number;
    syncedFiles: number;
    pendingSync: number;
    failedSync: number;
    quotaUsage: Record<string, { used: number; total: number }>;
  }> {
    const [fileStats, syncStats] = await Promise.all([
      this.pool.query(`
        SELECT 
          COUNT(*) as total_files,
          SUM(size) as total_size,
          COUNT(*) FILTER (WHERE sync_status = 'synced') as synced_files
        FROM cloud_files
        WHERE sync_status != 'deleted'
      `),
      this.pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'failed') as failed
        FROM sync_jobs
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `)
    ]);

    const quotaUsage: Record<string, { used: number; total: number }> = {};
    for (const [providerId, provider] of this.providers) {
      quotaUsage[providerId] = {
        used: provider.quota.used,
        total: provider.quota.total
      };
    }

    return {
      totalCloudFiles: parseInt(fileStats.rows[0].total_files),
      totalCloudSize: parseInt(fileStats.rows[0].total_size || '0'),
      syncedFiles: parseInt(fileStats.rows[0].synced_files),
      pendingSync: parseInt(syncStats.rows[0].pending),
      failedSync: parseInt(syncStats.rows[0].failed),
      quotaUsage
    };
  }
}

// Export singleton instance
const cloudStorageService = new CloudStorageService();
export default cloudStorageService;