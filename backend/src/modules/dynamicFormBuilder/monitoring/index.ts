/**
 * Monitoring and Metrics for Dynamic Form Builder
 */

import { register, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '../../../utils/logger';

// Metrics
const formCreatedCounter = new Counter({
  name: 'formbuilder_forms_created_total',
  help: 'Total number of forms created',
  labelNames: ['status'],
});

const formSubmissionCounter = new Counter({
  name: 'formbuilder_submissions_total',
  help: 'Total number of form submissions',
  labelNames: ['form_id', 'status'],
});

const formViewCounter = new Counter({
  name: 'formbuilder_form_views_total',
  help: 'Total number of form views',
  labelNames: ['form_id'],
});

const apiRequestDuration = new Histogram({
  name: 'formbuilder_api_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const activeFormsGauge = new Gauge({
  name: 'formbuilder_active_forms',
  help: 'Number of active forms',
});

const activeUsersGauge = new Gauge({
  name: 'formbuilder_active_users',
  help: 'Number of users with active forms',
});

const websocketConnectionsGauge = new Gauge({
  name: 'formbuilder_websocket_connections',
  help: 'Number of active WebSocket connections',
});

const cacheHitRatio = new Gauge({
  name: 'formbuilder_cache_hit_ratio',
  help: 'Cache hit ratio',
});

const fileStorageUsageGauge = new Gauge({
  name: 'formbuilder_file_storage_bytes',
  help: 'File storage usage in bytes',
  labelNames: ['type'],
});

const webhookQueueSizeGauge = new Gauge({
  name: 'formbuilder_webhook_queue_size',
  help: 'Number of webhooks in queue',
});

const webhookSuccessRate = new Gauge({
  name: 'formbuilder_webhook_success_rate',
  help: 'Webhook delivery success rate',
});

// Monitoring service
export class MonitoringService {
  private static instance: MonitoringService;
  private metricsInterval?: NodeJS.Timeout;

  private constructor() {}

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Record form creation
   */
  recordFormCreation(status: 'success' | 'failure' = 'success'): void {
    formCreatedCounter.inc({ status });
  }

  /**
   * Record form submission
   */
  recordFormSubmission(formId: string, status: 'success' | 'failure' = 'success'): void {
    formSubmissionCounter.inc({ form_id: formId, status });
  }

  /**
   * Record form view
   */
  recordFormView(formId: string): void {
    formViewCounter.inc({ form_id: formId });
  }

  /**
   * Record API request duration
   */
  recordApiRequest(method: string, route: string, statusCode: number, duration: number): void {
    apiRequestDuration.observe(
      { method, route, status_code: statusCode.toString() },
      duration / 1000 // Convert to seconds
    );
  }

  /**
   * Update active forms count
   */
  updateActiveFormsCount(count: number): void {
    activeFormsGauge.set(count);
  }

  /**
   * Update active users count
   */
  updateActiveUsersCount(count: number): void {
    activeUsersGauge.set(count);
  }

  /**
   * Update WebSocket connections count
   */
  updateWebSocketConnections(count: number): void {
    websocketConnectionsGauge.set(count);
  }

  /**
   * Update cache hit ratio
   */
  updateCacheHitRatio(ratio: number): void {
    cacheHitRatio.set(ratio);
  }

  /**
   * Update file storage usage
   */
  updateFileStorageUsage(type: 'uploads' | 'thumbnails', bytes: number): void {
    fileStorageUsageGauge.set({ type }, bytes);
  }

  /**
   * Update webhook queue size
   */
  updateWebhookQueueSize(size: number): void {
    webhookQueueSizeGauge.set(size);
  }

  /**
   * Update webhook success rate
   */
  updateWebhookSuccessRate(rate: number): void {
    webhookSuccessRate.set(rate);
  }

  /**
   * Get all metrics
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Start collecting metrics
   */
  startMetricsCollection(interval: number = 60000): void {
    this.metricsInterval = setInterval(() => {
      this.collectMetrics().catch(error => {
        logger.error('Failed to collect metrics', { error });
      });
    }, interval);
  }

  /**
   * Stop collecting metrics
   */
  stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }

  /**
   * Collect current metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Collect database metrics
      const { getDb } = await import('../database');
      const db = getDb();
      
      const formsResult = await db.query(
        'SELECT COUNT(*) as count FROM forms WHERE status = $1',
        ['active']
      );
      this.updateActiveFormsCount(formsResult.rows[0].count);

      const usersResult = await db.query(
        'SELECT COUNT(DISTINCT user_id) as count FROM forms WHERE status = $1',
        ['active']
      );
      this.updateActiveUsersCount(usersResult.rows[0].count);

      // Collect file storage metrics
      const { default: fileUploadService } = await import('../services/FileUploadService');
      const storageStats = await fileUploadService.getStorageStats();
      this.updateFileStorageUsage('uploads', storageStats.totalSize);
      this.updateFileStorageUsage('thumbnails', storageStats.thumbnailSize);

      // Collect webhook metrics
      const { WebhookService } = await import('../services/WebhookService');
      const webhookService = new WebhookService();
      const webhookStats = await webhookService.getQueueStats();
      this.updateWebhookQueueSize(webhookStats.pending + webhookStats.processing);
      const total = webhookStats.completed + webhookStats.failed;
      const successRate = total > 0 ? (webhookStats.completed / total) * 100 : 100;
      this.updateWebhookSuccessRate(successRate);

      logger.debug('Metrics collected successfully');
    } catch (error) {
      logger.error('Failed to collect metrics', { error });
    }
  }
}

// Middleware for Express
export function metricsMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      MonitoringService.getInstance().recordApiRequest(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration
      );
    });

    next();
  };
}

// Initialize monitoring
export async function initializeMonitoring(config: any): Promise<void> {
  const monitoring = MonitoringService.getInstance();
  
  if (config.metrics?.collectInterval) {
    monitoring.startMetricsCollection(config.metrics.collectInterval);
  }

  logger.info('Monitoring service initialized');
}

// Export metrics endpoint handler
export async function metricsHandler(req: any, res: any): Promise<void> {
  try {
    const metrics = await MonitoringService.getInstance().getMetrics();
    res.set('Content-Type', register.contentType);
    res.end(metrics);
  } catch (error) {
    res.status(500).end();
  }
}