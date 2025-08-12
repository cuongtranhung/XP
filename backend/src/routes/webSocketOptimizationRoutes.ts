/**
 * WebSocket Optimization Routes
 * REST API endpoints for WebSocket optimization management: pools, queues, metrics, performance
 */

import { Router, Request, Response } from 'express';
import { param, body, query } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { webSocketOptimizationService } from '../services/webSocketOptimizationService';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';

const router = Router();

// Validation schemas
const poolCreationValidation = [
  body('name')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Pool name is required and must be 1-100 characters'),
  
  body('maxConnections')
    .optional()
    .isInt({ min: 10, max: 10000 })
    .withMessage('Max connections must be between 10 and 10000'),
  
  body('connectionTimeout')
    .optional()
    .isInt({ min: 5000, max: 300000 })
    .withMessage('Connection timeout must be between 5000ms and 300000ms'),
  
  body('idleTimeout')
    .optional()
    .isInt({ min: 60000, max: 3600000 })
    .withMessage('Idle timeout must be between 60000ms and 3600000ms')
];

const queueCreationValidation = [
  body('name')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Queue name is required and must be 1-100 characters'),
  
  body('type')
    .isIn(['realtime', 'broadcast', 'notification', 'system'])
    .withMessage('Queue type must be realtime, broadcast, notification, or system'),
  
  body('maxSize')
    .optional()
    .isInt({ min: 100, max: 50000 })
    .withMessage('Max size must be between 100 and 50000'),
  
  body('processingRate')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Processing rate must be between 1 and 1000 messages per second'),
  
  body('retryAttempts')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Retry attempts must be between 0 and 10'),
  
  body('dlqEnabled')
    .optional()
    .isBoolean()
    .withMessage('DLQ enabled must be a boolean')
];

const messageQueueingValidation = [
  body('type')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Message type is required'),
  
  body('payload')
    .isObject()
    .withMessage('Message payload is required'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Priority must be low, medium, high, or critical'),
  
  body('targetUsers')
    .optional()
    .isArray()
    .withMessage('Target users must be an array'),
  
  body('targetRooms')
    .optional()
    .isArray()
    .withMessage('Target rooms must be an array'),
  
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled at must be a valid ISO 8601 date'),
  
  body('maxRetries')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Max retries must be between 0 and 10')
];

// Validation error handler
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Admin access check middleware
const requireAdmin = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

/**
 * @route   POST /websocket/pools
 * @desc    Create a new connection pool
 * @access  Private (admin)
 */
router.post('/websocket/pools',
  authenticate,
  requireAdmin,
  poolCreationValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { name, maxConnections, connectionTimeout, idleTimeout } = req.body;

      const poolId = await webSocketOptimizationService.createConnectionPool({
        name,
        maxConnections,
        connectionTimeout,
        idleTimeout
      });

      res.json({
        success: true,
        data: {
          poolId,
          poolConfig: {
            name,
            maxConnections,
            connectionTimeout,
            idleTimeout
          }
        },
        message: 'Connection pool created successfully'
      });

      logger.info('Connection pool created via REST API', {
        poolId,
        name,
        maxConnections
      });

    } catch (error) {
      logger.error('Failed to create connection pool', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to create connection pool',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /websocket/queues
 * @desc    Create a new message queue
 * @access  Private (admin)
 */
router.post('/websocket/queues',
  authenticate,
  requireAdmin,
  queueCreationValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { name, type, maxSize, processingRate, retryAttempts, dlqEnabled } = req.body;

      const queueId = await webSocketOptimizationService.createMessageQueue({
        name,
        type,
        maxSize,
        processingRate,
        retryAttempts,
        dlqEnabled
      });

      res.json({
        success: true,
        data: {
          queueId,
          queueConfig: {
            name,
            type,
            maxSize,
            processingRate,
            retryAttempts,
            dlqEnabled
          }
        },
        message: 'Message queue created successfully'
      });

      logger.info('Message queue created via REST API', {
        queueId,
        name,
        type,
        maxSize
      });

    } catch (error) {
      logger.error('Failed to create message queue', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to create message queue',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /websocket/messages/queue
 * @desc    Queue a message for optimized delivery
 * @access  Private
 */
router.post('/websocket/messages/queue',
  authenticate,
  messageQueueingValidation,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const {
        queueId,
        type,
        priority,
        payload,
        targetUsers,
        targetRooms,
        scheduledAt,
        maxRetries
      } = req.body;

      const messageId = await webSocketOptimizationService.queueMessage({
        queueId,
        type,
        priority,
        payload,
        targetUsers,
        targetRooms,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        maxRetries
      });

      res.json({
        success: true,
        data: {
          messageId,
          queuedAt: new Date().toISOString(),
          estimatedDelivery: scheduledAt || 'immediate'
        },
        message: 'Message queued successfully'
      });

      logger.debug('Message queued via REST API', {
        messageId,
        type,
        priority,
        targetUsers: targetUsers?.length || 0,
        targetRooms: targetRooms?.length || 0
      });

    } catch (error) {
      logger.error('Failed to queue message', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to queue message',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /websocket/pools/:poolId
 * @desc    Get connection pool status
 * @access  Private (admin)
 */
router.get('/websocket/pools/:poolId',
  authenticate,
  requireAdmin,
  [
    param('poolId')
      .isString()
      .withMessage('Pool ID is required')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { poolId } = req.params;

      const poolStatus = webSocketOptimizationService.getConnectionPoolStatus(poolId);

      if (!poolStatus) {
        return res.status(404).json({
          success: false,
          message: 'Connection pool not found'
        });
      }

      res.json({
        success: true,
        data: {
          pool: poolStatus,
          utilizationPercentage: (poolStatus.activeConnections / poolStatus.maxConnections) * 100,
          isHealthy: poolStatus.activeConnections < poolStatus.maxConnections * 0.9
        },
        message: 'Connection pool status retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get connection pool status', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get connection pool status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /websocket/queues/:queueId
 * @desc    Get message queue status
 * @access  Private (admin)
 */
router.get('/websocket/queues/:queueId',
  authenticate,
  requireAdmin,
  [
    param('queueId')
      .isString()
      .withMessage('Queue ID is required')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { queueId } = req.params;

      const queueStatus = webSocketOptimizationService.getMessageQueueStatus(queueId);

      if (!queueStatus) {
        return res.status(404).json({
          success: false,
          message: 'Message queue not found'
        });
      }

      res.json({
        success: true,
        data: {
          queue: queueStatus.queue,
          pendingMessages: queueStatus.pendingMessages,
          processingRate: queueStatus.processingRate,
          utilizationPercentage: (queueStatus.pendingMessages / queueStatus.queue.maxSize) * 100,
          isHealthy: queueStatus.pendingMessages < queueStatus.queue.maxSize * 0.8
        },
        message: 'Message queue status retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get message queue status', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get message queue status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /websocket/metrics
 * @desc    Get comprehensive performance metrics
 * @access  Private (admin)
 */
router.get('/websocket/metrics',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const metrics = webSocketOptimizationService.getPerformanceMetrics();

      // Calculate additional insights
      const insights = {
        connectionUtilization: metrics.connections.total > 0 
          ? (metrics.connections.active / metrics.connections.total) * 100 
          : 0,
        messageSuccessRate: metrics.messages.sent > 0 
          ? ((metrics.messages.sent - metrics.messages.failed) / metrics.messages.sent) * 100 
          : 100,
        systemHealthScore: calculateHealthScore(metrics),
        recommendations: generateRecommendations(metrics)
      };

      res.json({
        success: true,
        data: {
          metrics,
          insights,
          timestamp: new Date().toISOString()
        },
        message: 'Performance metrics retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get performance metrics', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get performance metrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   POST /websocket/optimize
 * @desc    Trigger performance optimization
 * @access  Private (admin)
 */
router.post('/websocket/optimize',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const optimizationResult = await webSocketOptimizationService.optimizePerformance();

      res.json({
        success: true,
        data: {
          optimizations: optimizationResult.optimizations,
          performanceImprovement: {
            memoryReduction: optimizationResult.beforeMetrics.memory.percentage - 
                             optimizationResult.afterMetrics.memory.percentage,
            connectionEfficiency: calculateConnectionEfficiency(
              optimizationResult.beforeMetrics, 
              optimizationResult.afterMetrics
            ),
            messageLatencyImprovement: optimizationResult.beforeMetrics.messages.avgLatency - 
                                      optimizationResult.afterMetrics.messages.avgLatency
          },
          beforeMetrics: optimizationResult.beforeMetrics,
          afterMetrics: optimizationResult.afterMetrics
        },
        message: 'Performance optimization completed successfully'
      });

      logger.info('WebSocket performance optimization triggered via REST API', {
        optimizationCount: optimizationResult.optimizations.length,
        memoryImprovement: optimizationResult.beforeMetrics.memory.percentage - 
                          optimizationResult.afterMetrics.memory.percentage
      });

    } catch (error) {
      logger.error('Failed to optimize performance', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to optimize performance',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /websocket/pools
 * @desc    List all connection pools
 * @access  Private (admin)
 */
router.get('/websocket/pools',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const metrics = webSocketOptimizationService.getPerformanceMetrics();

      const poolsWithStatus = metrics.pools.map(pool => ({
        ...pool,
        utilizationPercentage: (pool.activeConnections / pool.maxConnections) * 100,
        isHealthy: pool.activeConnections < pool.maxConnections * 0.9,
        status: pool.activeConnections < pool.maxConnections * 0.5 ? 'underutilized' :
                pool.activeConnections < pool.maxConnections * 0.8 ? 'optimal' :
                pool.activeConnections < pool.maxConnections * 0.9 ? 'busy' : 'critical'
      }));

      res.json({
        success: true,
        data: {
          pools: poolsWithStatus,
          totalPools: poolsWithStatus.length,
          healthyPools: poolsWithStatus.filter(p => p.isHealthy).length,
          totalConnections: poolsWithStatus.reduce((sum, p) => sum + p.activeConnections, 0)
        },
        message: 'Connection pools retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get connection pools', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get connection pools',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /websocket/queues
 * @desc    List all message queues
 * @access  Private (admin)
 */
router.get('/websocket/queues',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const metrics = webSocketOptimizationService.getPerformanceMetrics();

      const queuesWithStatus = metrics.queues.map(queue => {
        const utilizationPercentage = (queue.currentSize / queue.maxSize) * 100;
        return {
          ...queue,
          utilizationPercentage,
          isHealthy: queue.currentSize < queue.maxSize * 0.8,
          status: queue.currentSize < queue.maxSize * 0.3 ? 'low' :
                  queue.currentSize < queue.maxSize * 0.7 ? 'medium' :
                  queue.currentSize < queue.maxSize * 0.9 ? 'high' : 'critical'
        };
      });

      res.json({
        success: true,
        data: {
          queues: queuesWithStatus,
          totalQueues: queuesWithStatus.length,
          healthyQueues: queuesWithStatus.filter(q => q.isHealthy).length,
          totalQueuedMessages: queuesWithStatus.reduce((sum, q) => sum + q.currentSize, 0)
        },
        message: 'Message queues retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get message queues', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get message queues',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route   GET /websocket/health
 * @desc    Get WebSocket optimization service health status
 * @access  Private
 */
router.get('/websocket/health',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const metrics = webSocketOptimizationService.getPerformanceMetrics();
      
      const healthStatus = {
        status: 'healthy' as 'healthy' | 'warning' | 'critical',
        uptime: metrics.uptime,
        checks: {
          memoryUsage: {
            status: metrics.memory.percentage < 80 ? 'healthy' : 
                   metrics.memory.percentage < 95 ? 'warning' : 'critical',
            value: metrics.memory.percentage,
            threshold: 80
          },
          connectionHealth: {
            status: metrics.connections.failed < metrics.connections.total * 0.1 ? 'healthy' : 'warning',
            value: metrics.connections.failed,
            total: metrics.connections.total
          },
          messageProcessing: {
            status: metrics.messages.throughput > 10 ? 'healthy' : 'warning',
            value: metrics.messages.throughput,
            threshold: 10
          },
          redisConnection: {
            status: metrics.redis.connections > 0 ? 'healthy' : 'critical',
            value: metrics.redis.connections
          }
        }
      };

      // Determine overall status
      const checkStatuses = Object.values(healthStatus.checks).map(check => check.status);
      if (checkStatuses.includes('critical')) {
        healthStatus.status = 'critical';
      } else if (checkStatuses.includes('warning')) {
        healthStatus.status = 'warning';
      }

      res.json({
        success: true,
        data: healthStatus,
        message: 'WebSocket optimization service health retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get service health', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get service health',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Helper functions
function calculateHealthScore(metrics: any): number {
  let score = 100;
  
  // Memory usage penalty
  if (metrics.memory.percentage > 80) score -= 20;
  else if (metrics.memory.percentage > 60) score -= 10;
  
  // Connection failure penalty
  if (metrics.connections.total > 0) {
    const failureRate = metrics.connections.failed / metrics.connections.total;
    if (failureRate > 0.1) score -= 30;
    else if (failureRate > 0.05) score -= 15;
  }
  
  // Message processing penalty
  if (metrics.messages.failed > 0) {
    const messageFailureRate = metrics.messages.failed / (metrics.messages.sent + metrics.messages.failed);
    if (messageFailureRate > 0.1) score -= 25;
    else if (messageFailureRate > 0.05) score -= 10;
  }
  
  // Throughput bonus
  if (metrics.messages.throughput > 100) score += 5;
  
  return Math.max(0, Math.min(100, score));
}

function generateRecommendations(metrics: any): string[] {
  const recommendations: string[] = [];
  
  if (metrics.memory.percentage > 80) {
    recommendations.push('High memory usage detected. Consider optimizing connection pools.');
  }
  
  if (metrics.connections.total > 0 && metrics.connections.failed / metrics.connections.total > 0.05) {
    recommendations.push('High connection failure rate. Check network stability and timeout settings.');
  }
  
  if (metrics.messages.throughput < 10) {
    recommendations.push('Low message throughput. Consider increasing processing rate or adding more queues.');
  }
  
  if (metrics.redis.latency > 100) {
    recommendations.push('High Redis latency detected. Consider Redis optimization or clustering.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System is performing optimally. No immediate actions required.');
  }
  
  return recommendations;
}

function calculateConnectionEfficiency(beforeMetrics: any, afterMetrics: any): number {
  const beforeEfficiency = beforeMetrics.connections.active / (beforeMetrics.connections.active + beforeMetrics.connections.idle);
  const afterEfficiency = afterMetrics.connections.active / (afterMetrics.connections.active + afterMetrics.connections.idle);
  
  return ((afterEfficiency - beforeEfficiency) / beforeEfficiency) * 100;
}

export default router;