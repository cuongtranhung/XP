/**
 * Image Processing Service
 * Comprehensive image processing with resize, thumbnails, watermarks, and optimization
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import sharp from 'sharp';
import redisClient from '../config/redis';
import logger from '../utils/logger';

// Types
export interface ImageProcessingJob {
  jobId: string;
  fileId: string;
  operations: ImageOperation[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number; // 1-10, higher is more urgent
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: number; // 0-100
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  results?: ProcessingResult[];
}

export interface ImageOperation {
  type: 'resize' | 'thumbnail' | 'watermark' | 'format' | 'quality' | 'crop' | 'rotate' | 'filter' | 'metadata';
  params: Record<string, any>;
  outputSuffix?: string; // e.g., '_thumb', '_medium'
  outputFormat?: string; // e.g., 'jpeg', 'png', 'webp'
}

export interface ResizeOperation extends ImageOperation {
  type: 'resize';
  params: {
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    position?: string;
    background?: string;
    withoutEnlargement?: boolean;
  };
}

export interface ThumbnailOperation extends ImageOperation {
  type: 'thumbnail';
  params: {
    sizes: Array<{ width: number; height: number; suffix: string }>;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
    progressive?: boolean;
  };
}

export interface WatermarkOperation extends ImageOperation {
  type: 'watermark';
  params: {
    watermarkPath?: string;
    text?: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity?: number; // 0-1
    size?: number; // percentage of image size
    margin?: number; // pixels
    fontFamily?: string;
    fontSize?: number;
    fontColor?: string;
  };
}

export interface CropOperation extends ImageOperation {
  type: 'crop';
  params: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface FilterOperation extends ImageOperation {
  type: 'filter';
  params: {
    blur?: number;
    sharpen?: number;
    brightness?: number; // -100 to 100
    contrast?: number; // -100 to 100
    saturation?: number; // -100 to 100
    hue?: number; // 0-360
    gamma?: number; // 0.1 to 3.0
    grayscale?: boolean;
    sepia?: boolean;
    negative?: boolean;
  };
}

export interface ProcessingResult {
  operationType: string;
  outputPath: string;
  outputSize: number;
  dimensions: { width: number; height: number };
  format: string;
  quality?: number;
  compressionRatio?: number;
  processingTime: number; // milliseconds
}

export interface ImageMetadata {
  format: string;
  width: number;
  height: number;
  channels: number;
  density: number;
  hasAlpha: boolean;
  hasProfile: boolean;
  colorSpace?: string;
  fileSize: number;
  exif?: Record<string, any>;
  icc?: Buffer;
}

export interface OptimizationConfig {
  jpeg: {
    quality: number;
    progressive: boolean;
    mozjpeg: boolean;
  };
  png: {
    quality: number;
    progressive: boolean;
    compressionLevel: number;
    adaptiveFiltering: boolean;
  };
  webp: {
    quality: number;
    lossless: boolean;
    nearLossless: boolean;
    smartSubsample: boolean;
  };
  avif: {
    quality: number;
    lossless: boolean;
    speed: number;
  };
}

export interface BatchProcessingOptions {
  concurrency: number;
  failFast: boolean;
  progressCallback?: (progress: BatchProgress) => void;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  progress: number; // 0-100
  currentFile?: string;
}

class ImageProcessingService extends EventEmitter {
  private processingQueue: ImageProcessingJob[] = [];
  private activeJobs: Map<string, ImageProcessingJob> = new Map();
  private optimizationConfig: OptimizationConfig;
  private pool: Pool;
  private isInitialized: boolean = false;
  private workerInterval: NodeJS.Timeout | null = null;
  private maxConcurrentJobs: number = 3;

  constructor() {
    super();
    
    this.optimizationConfig = {
      jpeg: {
        quality: 85,
        progressive: true,
        mozjpeg: true
      },
      png: {
        quality: 90,
        progressive: true,
        compressionLevel: 9,
        adaptiveFiltering: true
      },
      webp: {
        quality: 80,
        lossless: false,
        nearLossless: false,
        smartSubsample: true
      },
      avif: {
        quality: 75,
        lossless: false,
        speed: 5
      }
    };

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Initialize the image processing service
   */
  async initialize(config?: {
    maxConcurrentJobs?: number;
    optimization?: Partial<OptimizationConfig>;
  }): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (config) {
        this.maxConcurrentJobs = config.maxConcurrentJobs || 3;
        if (config.optimization) {
          this.optimizationConfig = { ...this.optimizationConfig, ...config.optimization };
        }
      }

      // Create database tables
      await this.createTables();
      
      // Load pending jobs
      await this.loadPendingJobs();
      
      // Start processing worker
      this.startProcessingWorker();
      
      this.isInitialized = true;
      logger.info('Image processing service initialized');
    } catch (error) {
      logger.error('Failed to initialize image processing service:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS image_processing_jobs (
        job_id VARCHAR(255) PRIMARY KEY,
        file_id VARCHAR(255) NOT NULL,
        operations JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        priority INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        progress INTEGER DEFAULT 0,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        results JSONB,
        FOREIGN KEY (file_id) REFERENCES files(file_id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_image_jobs_status ON image_processing_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_image_jobs_priority ON image_processing_jobs(priority DESC);
      CREATE INDEX IF NOT EXISTS idx_image_jobs_created ON image_processing_jobs(created_at);
    `;

    await this.pool.query(query);
  }

  /**
   * Load pending jobs from database
   */
  private async loadPendingJobs(): Promise<void> {
    const result = await this.pool.query(
      `SELECT * FROM image_processing_jobs 
       WHERE status IN ('pending', 'processing') 
       ORDER BY priority DESC, created_at ASC`
    );

    for (const row of result.rows) {
      const job = this.mapRowToJob(row);
      // Reset processing jobs to pending
      if (job.status === 'processing') {
        job.status = 'pending';
      }
      this.processingQueue.push(job);
    }

    logger.info(`Loaded ${this.processingQueue.length} pending image processing jobs`);
  }

  /**
   * Process image with operations
   */
  async processImage(
    fileId: string,
    operations: ImageOperation[],
    options: {
      priority?: number;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    try {
      const jobId = this.generateJobId();
      const job: ImageProcessingJob = {
        jobId,
        fileId,
        operations,
        status: 'pending',
        priority: options.priority || 5,
        createdAt: new Date(),
        progress: 0,
        retryCount: 0,
        maxRetries: options.maxRetries || 3
      };

      // Save job to database
      await this.saveJob(job);
      
      // Add to queue
      this.addToQueue(job);

      this.emit('jobCreated', { jobId, fileId, operations: operations.length });

      return jobId;
    } catch (error) {
      logger.error('Failed to create image processing job:', error);
      throw error;
    }
  }

  /**
   * Create thumbnail variations
   */
  async createThumbnails(
    fileId: string,
    sizes: Array<{ width: number; height: number; suffix: string }> = [
      { width: 150, height: 150, suffix: '_thumb' },
      { width: 300, height: 300, suffix: '_medium' },
      { width: 600, height: 600, suffix: '_large' }
    ]
  ): Promise<string> {
    const operation: ThumbnailOperation = {
      type: 'thumbnail',
      params: {
        sizes,
        quality: this.optimizationConfig.jpeg.quality,
        format: 'jpeg',
        progressive: true
      }
    };

    return await this.processImage(fileId, [operation], { priority: 7 });
  }

  /**
   * Optimize image for web
   */
  async optimizeForWeb(
    fileId: string,
    formats: Array<'jpeg' | 'webp' | 'avif'> = ['jpeg', 'webp']
  ): Promise<string> {
    const operations: ImageOperation[] = formats.map(format => ({
      type: 'format',
      params: {
        format,
        quality: this.optimizationConfig[format].quality,
        ...this.optimizationConfig[format]
      },
      outputSuffix: `_${format}`,
      outputFormat: format
    }));

    return await this.processImage(fileId, operations, { priority: 6 });
  }

  /**
   * Add watermark to image
   */
  async addWatermark(
    fileId: string,
    watermarkOptions: {
      watermarkPath?: string;
      text?: string;
      position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
      opacity?: number;
      size?: number;
    }
  ): Promise<string> {
    const operation: WatermarkOperation = {
      type: 'watermark',
      params: {
        position: 'bottom-right',
        opacity: 0.7,
        size: 10,
        ...watermarkOptions
      },
      outputSuffix: '_watermarked'
    };

    return await this.processImage(fileId, [operation], { priority: 4 });
  }

  /**
   * Batch process multiple images
   */
  async batchProcess(
    fileIds: string[],
    operations: ImageOperation[],
    options: BatchProcessingOptions = {
      concurrency: 3,
      failFast: false
    }
  ): Promise<{
    successful: string[];
    failed: Array<{ fileId: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ fileId: string; error: string }> = [];
    let completed = 0;

    const updateProgress = () => {
      const progress: BatchProgress = {
        total: fileIds.length,
        completed,
        failed: failed.length,
        progress: Math.round((completed / fileIds.length) * 100),
        currentFile: undefined
      };

      if (options.progressCallback) {
        options.progressCallback(progress);
      }

      this.emit('batchProgress', progress);
    };

    // Process in chunks based on concurrency
    const chunks = this.chunkArray(fileIds, options.concurrency);
    
    for (const chunk of chunks) {
      const promises = chunk.map(async (fileId) => {
        try {
          const jobId = await this.processImage(fileId, operations);
          
          // Wait for job completion
          await this.waitForJobCompletion(jobId);
          
          successful.push(fileId);
          completed++;
          updateProgress();
        } catch (error) {
          failed.push({ fileId, error: error.message });
          completed++;
          updateProgress();
          
          if (options.failFast) {
            throw error;
          }
        }
      });

      await Promise.all(promises);
    }

    return { successful, failed };
  }

  /**
   * Get image metadata
   */
  async getImageMetadata(filePath: string): Promise<ImageMetadata> {
    try {
      const image = sharp(filePath);
      const metadata = await image.metadata();
      const stats = await fs.stat(filePath);

      return {
        format: metadata.format || 'unknown',
        width: metadata.width || 0,
        height: metadata.height || 0,
        channels: metadata.channels || 0,
        density: metadata.density || 0,
        hasAlpha: metadata.hasAlpha || false,
        hasProfile: metadata.hasProfile || false,
        colorSpace: metadata.space,
        fileSize: stats.size,
        exif: metadata.exif,
        icc: metadata.icc
      };
    } catch (error) {
      logger.error('Failed to get image metadata:', error);
      throw error;
    }
  }

  /**
   * Get processing job status
   */
  async getJobStatus(jobId: string): Promise<ImageProcessingJob | null> {
    try {
      // Check active jobs first
      if (this.activeJobs.has(jobId)) {
        return this.activeJobs.get(jobId)!;
      }

      // Check database
      const result = await this.pool.query(
        'SELECT * FROM image_processing_jobs WHERE job_id = $1',
        [jobId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToJob(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get job status:', error);
      return null;
    }
  }

  /**
   * Cancel processing job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      // Remove from queue
      this.processingQueue = this.processingQueue.filter(job => job.jobId !== jobId);
      
      // If job is active, mark for cancellation
      const activeJob = this.activeJobs.get(jobId);
      if (activeJob) {
        activeJob.status = 'failed';
        activeJob.errorMessage = 'Cancelled by user';
        await this.updateJob(activeJob);
        this.activeJobs.delete(jobId);
      }

      // Update in database
      await this.pool.query(
        `UPDATE image_processing_jobs 
         SET status = 'failed', error_message = 'Cancelled by user', completed_at = CURRENT_TIMESTAMP
         WHERE job_id = $1`,
        [jobId]
      );

      this.emit('jobCancelled', { jobId });
      return true;
    } catch (error) {
      logger.error('Failed to cancel job:', error);
      return false;
    }
  }

  /**
   * Start processing worker
   */
  private startProcessingWorker(): void {
    this.workerInterval = setInterval(async () => {
      try {
        await this.processQueue();
      } catch (error) {
        logger.error('Processing worker error:', error);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Process job queue
   */
  private async processQueue(): Promise<void> {
    // Process pending jobs up to max concurrency
    while (this.activeJobs.size < this.maxConcurrentJobs && this.processingQueue.length > 0) {
      const job = this.processingQueue.shift()!;
      await this.executeJob(job);
    }
  }

  /**
   * Execute processing job
   */
  private async executeJob(job: ImageProcessingJob): Promise<void> {
    try {
      this.activeJobs.set(job.jobId, job);
      
      // Update job status
      job.status = 'processing';
      job.startedAt = new Date();
      await this.updateJob(job);

      // Get file info
      const fileResult = await this.pool.query(
        'SELECT * FROM files WHERE file_id = $1',
        [job.fileId]
      );

      if (fileResult.rows.length === 0) {
        throw new Error('File not found');
      }

      const file = fileResult.rows[0];
      
      // Check if file exists
      try {
        await fs.access(file.path);
      } catch {
        throw new Error('Source file not accessible');
      }

      // Process operations
      const results: ProcessingResult[] = [];
      let operationIndex = 0;

      for (const operation of job.operations) {
        const startTime = Date.now();
        const result = await this.executeOperation(file.path, operation, file.filename);
        const endTime = Date.now();

        result.processingTime = endTime - startTime;
        results.push(result);

        // Update progress
        operationIndex++;
        job.progress = Math.round((operationIndex / job.operations.length) * 100);
        await this.updateJob(job);

        this.emit('operationCompleted', {
          jobId: job.jobId,
          operation: operation.type,
          result
        });
      }

      // Job completed successfully
      job.status = 'completed';
      job.completedAt = new Date();
      job.progress = 100;
      job.results = results;
      await this.updateJob(job);

      this.emit('jobCompleted', { jobId: job.jobId, results });

    } catch (error) {
      logger.error(`Job ${job.jobId} failed:`, error);
      
      job.status = 'failed';
      job.errorMessage = error.message;
      job.retryCount++;

      // Retry if within limits
      if (job.retryCount <= job.maxRetries) {
        job.status = 'pending';
        job.progress = 0;
        
        // Add exponential backoff
        setTimeout(() => {
          this.addToQueue(job);
        }, Math.pow(2, job.retryCount) * 1000);
      } else {
        job.completedAt = new Date();
      }

      await this.updateJob(job);
      this.emit('jobFailed', { jobId: job.jobId, error: error.message });
    } finally {
      this.activeJobs.delete(job.jobId);
    }
  }

  /**
   * Execute single operation
   */
  private async executeOperation(
    inputPath: string,
    operation: ImageOperation,
    originalFilename: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    // Generate output path
    const ext = path.extname(originalFilename);
    const basename = path.basename(originalFilename, ext);
    const outputFormat = operation.outputFormat || 'jpeg';
    const suffix = operation.outputSuffix || `_${operation.type}`;
    const outputFilename = `${basename}${suffix}.${outputFormat}`;
    const outputPath = path.join(path.dirname(inputPath), outputFilename);

    let image = sharp(inputPath);
    
    switch (operation.type) {
      case 'resize':
        image = await this.applyResize(image, operation as ResizeOperation);
        break;
      case 'thumbnail':
        return await this.applyThumbnails(inputPath, operation as ThumbnailOperation, originalFilename);
      case 'watermark':
        image = await this.applyWatermark(image, operation as WatermarkOperation);
        break;
      case 'crop':
        image = await this.applyCrop(image, operation as CropOperation);
        break;
      case 'rotate':
        image = await this.applyRotate(image, operation);
        break;
      case 'filter':
        image = await this.applyFilter(image, operation as FilterOperation);
        break;
      case 'format':
        image = await this.applyFormat(image, operation);
        break;
      case 'quality':
        image = await this.applyQuality(image, operation);
        break;
      default:
        throw new Error(`Unsupported operation: ${operation.type}`);
    }

    // Apply output format
    image = this.applyOutputFormat(image, outputFormat, operation.params.quality);
    
    // Save processed image
    await image.toFile(outputPath);
    
    // Get result metadata
    const metadata = await image.metadata();
    const stats = await fs.stat(outputPath);
    const originalStats = await fs.stat(inputPath);

    return {
      operationType: operation.type,
      outputPath,
      outputSize: stats.size,
      dimensions: {
        width: metadata.width || 0,
        height: metadata.height || 0
      },
      format: outputFormat,
      quality: operation.params.quality,
      compressionRatio: originalStats.size / stats.size,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Apply resize operation
   */
  private async applyResize(image: sharp.Sharp, operation: ResizeOperation): Promise<sharp.Sharp> {
    const { width, height, fit, position, background, withoutEnlargement } = operation.params;

    return image.resize({
      width,
      height,
      fit: fit as keyof sharp.FitEnum,
      position,
      background,
      withoutEnlargement
    });
  }

  /**
   * Apply thumbnails (multiple sizes)
   */
  private async applyThumbnails(
    inputPath: string,
    operation: ThumbnailOperation,
    originalFilename: string
  ): Promise<ProcessingResult> {
    const results: ProcessingResult[] = [];
    const startTime = Date.now();
    
    for (const size of operation.params.sizes) {
      const ext = path.extname(originalFilename);
      const basename = path.basename(originalFilename, ext);
      const format = operation.params.format || 'jpeg';
      const outputFilename = `${basename}${size.suffix}.${format}`;
      const outputPath = path.join(path.dirname(inputPath), outputFilename);

      const image = sharp(inputPath)
        .resize(size.width, size.height, {
          fit: 'cover',
          position: 'center'
        });

      // Apply format and quality
      const processedImage = this.applyOutputFormat(
        image,
        format,
        operation.params.quality
      );

      await processedImage.toFile(outputPath);
      
      const stats = await fs.stat(outputPath);
      const metadata = await processedImage.metadata();

      results.push({
        operationType: `thumbnail_${size.width}x${size.height}`,
        outputPath,
        outputSize: stats.size,
        dimensions: { width: size.width, height: size.height },
        format,
        quality: operation.params.quality,
        compressionRatio: 1,
        processingTime: Date.now() - startTime
      });
    }

    // Return combined result
    const totalSize = results.reduce((sum, r) => sum + r.outputSize, 0);
    return {
      operationType: 'thumbnail',
      outputPath: path.dirname(results[0].outputPath),
      outputSize: totalSize,
      dimensions: { width: 0, height: 0 }, // Multiple sizes
      format: operation.params.format || 'jpeg',
      quality: operation.params.quality,
      compressionRatio: 1,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Apply watermark operation
   */
  private async applyWatermark(image: sharp.Sharp, operation: WatermarkOperation): Promise<sharp.Sharp> {
    const { watermarkPath, text, position, opacity, size, margin } = operation.params;

    if (watermarkPath) {
      // Image watermark
      const watermark = sharp(watermarkPath);
      const metadata = await image.metadata();
      
      // Calculate watermark size
      const maxSize = Math.min(metadata.width!, metadata.height!) * (size || 10) / 100;
      const resizedWatermark = watermark.resize({ width: Math.round(maxSize), height: Math.round(maxSize), fit: 'inside' });
      
      // Calculate position
      const wmMetadata = await resizedWatermark.metadata();
      const { left, top } = this.calculateWatermarkPosition(
        position || 'bottom-right',
        metadata.width!,
        metadata.height!,
        wmMetadata.width!,
        wmMetadata.height!,
        margin || 10
      );

      return image.composite([{
        input: await resizedWatermark.toBuffer(),
        left,
        top,
        blend: 'over'
      }]);
    } else if (text) {
      // Text watermark
      const metadata = await image.metadata();
      const fontSize = operation.params.fontSize || Math.max(12, Math.min(metadata.width!, metadata.height!) / 30);
      
      // Create SVG text
      const textSvg = `
        <svg width="${metadata.width}" height="${metadata.height}">
          <text 
            x="50%" 
            y="90%" 
            text-anchor="middle" 
            font-family="${operation.params.fontFamily || 'Arial'}"
            font-size="${fontSize}"
            fill="${operation.params.fontColor || 'white'}"
            fill-opacity="${opacity || 0.7}"
            stroke="black"
            stroke-width="1"
            stroke-opacity="0.3"
          >
            ${text}
          </text>
        </svg>
      `;

      return image.composite([{
        input: Buffer.from(textSvg),
        blend: 'over'
      }]);
    }

    return image;
  }

  /**
   * Apply crop operation
   */
  private async applyCrop(image: sharp.Sharp, operation: CropOperation): Promise<sharp.Sharp> {
    const { left, top, width, height } = operation.params;
    return image.extract({ left, top, width, height });
  }

  /**
   * Apply rotate operation
   */
  private async applyRotate(image: sharp.Sharp, operation: ImageOperation): Promise<sharp.Sharp> {
    const angle = operation.params.angle || 0;
    const background = operation.params.background || { r: 255, g: 255, b: 255, alpha: 0 };
    return image.rotate(angle, { background });
  }

  /**
   * Apply filter operation
   */
  private async applyFilter(image: sharp.Sharp, operation: FilterOperation): Promise<sharp.Sharp> {
    const { 
      blur, sharpen, brightness, contrast, saturation, hue, gamma,
      grayscale, sepia, negative 
    } = operation.params;

    if (blur) {
      image = image.blur(blur);
    }

    if (sharpen) {
      image = image.sharpen(sharpen);
    }

    if (brightness || contrast || saturation || hue) {
      image = image.modulate({
        brightness: brightness ? 1 + (brightness / 100) : undefined,
        saturation: saturation ? 1 + (saturation / 100) : undefined,
        hue: hue ? hue : undefined
      });
    }

    if (gamma) {
      image = image.gamma(gamma);
    }

    if (grayscale) {
      image = image.grayscale();
    }

    if (sepia) {
      image = image.tint({ r: 112, g: 66, b: 20 });
    }

    if (negative) {
      image = image.negate();
    }

    return image;
  }

  /**
   * Apply format operation
   */
  private async applyFormat(image: sharp.Sharp, operation: ImageOperation): Promise<sharp.Sharp> {
    const format = operation.params.format;
    const quality = operation.params.quality || 85;

    return this.applyOutputFormat(image, format, quality);
  }

  /**
   * Apply quality operation
   */
  private async applyQuality(image: sharp.Sharp, operation: ImageOperation): Promise<sharp.Sharp> {
    const quality = operation.params.quality || 85;
    const format = operation.params.format || 'jpeg';

    return this.applyOutputFormat(image, format, quality);
  }

  /**
   * Apply output format
   */
  private applyOutputFormat(image: sharp.Sharp, format: string, quality?: number): sharp.Sharp {
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        return image.jpeg({
          quality: quality || this.optimizationConfig.jpeg.quality,
          progressive: this.optimizationConfig.jpeg.progressive,
          mozjpeg: this.optimizationConfig.jpeg.mozjpeg
        });

      case 'png':
        return image.png({
          quality: quality || this.optimizationConfig.png.quality,
          progressive: this.optimizationConfig.png.progressive,
          compressionLevel: this.optimizationConfig.png.compressionLevel,
          adaptiveFiltering: this.optimizationConfig.png.adaptiveFiltering
        });

      case 'webp':
        return image.webp({
          quality: quality || this.optimizationConfig.webp.quality,
          lossless: this.optimizationConfig.webp.lossless,
          nearLossless: this.optimizationConfig.webp.nearLossless,
          smartSubsample: this.optimizationConfig.webp.smartSubsample
        });

      case 'avif':
        return image.avif({
          quality: quality || this.optimizationConfig.avif.quality,
          lossless: this.optimizationConfig.avif.lossless,
          speed: this.optimizationConfig.avif.speed
        });

      default:
        return image;
    }
  }

  /**
   * Calculate watermark position
   */
  private calculateWatermarkPosition(
    position: string,
    imageWidth: number,
    imageHeight: number,
    watermarkWidth: number,
    watermarkHeight: number,
    margin: number
  ): { left: number; top: number } {
    switch (position) {
      case 'top-left':
        return { left: margin, top: margin };
      case 'top-right':
        return { left: imageWidth - watermarkWidth - margin, top: margin };
      case 'bottom-left':
        return { left: margin, top: imageHeight - watermarkHeight - margin };
      case 'bottom-right':
        return { left: imageWidth - watermarkWidth - margin, top: imageHeight - watermarkHeight - margin };
      case 'center':
        return { 
          left: Math.round((imageWidth - watermarkWidth) / 2), 
          top: Math.round((imageHeight - watermarkHeight) / 2) 
        };
      default:
        return { left: margin, top: margin };
    }
  }

  /**
   * Wait for job completion
   */
  private async waitForJobCompletion(jobId: string, timeout: number = 300000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const job = await this.getJobStatus(jobId);
      
      if (!job) {
        throw new Error('Job not found');
      }

      if (job.status === 'completed') {
        return;
      }

      if (job.status === 'failed') {
        throw new Error(job.errorMessage || 'Job failed');
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Job timeout');
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Add job to queue
   */
  private addToQueue(job: ImageProcessingJob): void {
    // Insert in priority order
    const insertIndex = this.processingQueue.findIndex(
      queueJob => queueJob.priority <= job.priority
    );
    
    if (insertIndex === -1) {
      this.processingQueue.push(job);
    } else {
      this.processingQueue.splice(insertIndex, 0, job);
    }
  }

  /**
   * Generate job ID
   */
  private generateJobId(): string {
    return `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Database operations
   */
  private async saveJob(job: ImageProcessingJob): Promise<void> {
    await this.pool.query(`
      INSERT INTO image_processing_jobs (
        job_id, file_id, operations, status, priority,
        progress, retry_count, max_retries
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      job.jobId,
      job.fileId,
      JSON.stringify(job.operations),
      job.status,
      job.priority,
      job.progress,
      job.retryCount,
      job.maxRetries
    ]);
  }

  private async updateJob(job: ImageProcessingJob): Promise<void> {
    await this.pool.query(`
      UPDATE image_processing_jobs SET
        status = $1,
        started_at = $2,
        completed_at = $3,
        progress = $4,
        error_message = $5,
        retry_count = $6,
        results = $7
      WHERE job_id = $8
    `, [
      job.status,
      job.startedAt,
      job.completedAt,
      job.progress,
      job.errorMessage,
      job.retryCount,
      job.results ? JSON.stringify(job.results) : null,
      job.jobId
    ]);
  }

  /**
   * Map database row to job object
   */
  private mapRowToJob(row: any): ImageProcessingJob {
    return {
      jobId: row.job_id,
      fileId: row.file_id,
      operations: JSON.parse(row.operations),
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      progress: row.progress,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      results: row.results ? JSON.parse(row.results) : undefined
    };
  }

  /**
   * Get service statistics
   */
  async getStatistics(): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    pendingJobs: number;
    processingJobs: number;
    avgProcessingTime: number;
    topOperations: Array<{ operation: string; count: number }>;
  }> {
    const [statusStats, operationStats] = await Promise.all([
      this.pool.query(`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration
        FROM image_processing_jobs
        WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        GROUP BY status
      `),
      this.pool.query(`
        SELECT 
          operation_type,
          COUNT(*) as count
        FROM (
          SELECT 
            jsonb_array_elements(operations)->>'type' as operation_type
          FROM image_processing_jobs
          WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        ) ops
        GROUP BY operation_type
        ORDER BY count DESC
        LIMIT 10
      `)
    ]);

    const stats = {
      totalJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      pendingJobs: 0,
      processingJobs: 0,
      avgProcessingTime: 0
    };

    let totalDuration = 0;
    let completedCount = 0;

    for (const row of statusStats.rows) {
      const count = parseInt(row.count);
      stats.totalJobs += count;

      switch (row.status) {
        case 'completed':
          stats.completedJobs = count;
          if (row.avg_duration) {
            totalDuration += parseFloat(row.avg_duration) * count;
            completedCount += count;
          }
          break;
        case 'failed':
          stats.failedJobs = count;
          break;
        case 'pending':
          stats.pendingJobs = count;
          break;
        case 'processing':
          stats.processingJobs = count;
          break;
      }
    }

    stats.avgProcessingTime = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;

    const topOperations = operationStats.rows.map(row => ({
      operation: row.operation_type,
      count: parseInt(row.count)
    }));

    return { ...stats, topOperations };
  }

  /**
   * Cleanup old jobs
   */
  async cleanupOldJobs(daysToKeep: number = 30): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM image_processing_jobs 
       WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'
       AND status IN ('completed', 'failed')`
    );

    return result.rowCount || 0;
  }
}

// Export singleton instance
const imageProcessingService = new ImageProcessingService();
export default imageProcessingService;