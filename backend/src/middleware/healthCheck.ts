import { Request, Response, Router } from 'express';
import os from 'os';
import { database } from '../config/database';
import { circuitBreakerFactory } from '../utils/circuitBreaker';
import { logger } from '../utils/logger';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    memory: ComponentHealth;
    circuitBreakers: ComponentHealth;
    diskSpace: ComponentHealth;
  };
  metrics: {
    cpu: CPUMetrics;
    memory: MemoryMetrics;
    requests: RequestMetrics;
  };
}

interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  message?: string;
  responseTime?: number;
  details?: any;
}

interface CPUMetrics {
  usage: number;
  loadAverage: number[];
  cores: number;
}

interface MemoryMetrics {
  total: number;
  used: number;
  free: number;
  percentage: number;
}

interface RequestMetrics {
  total: number;
  successful: number;
  failed: number;
  averageResponseTime: number;
}

/**
 * Health check service
 */
class HealthCheckService {
  private requestMetrics: RequestMetrics = {
    total: 0,
    successful: 0,
    failed: 0,
    averageResponseTime: 0
  };

  private responseTimes: number[] = [];
  private readonly maxResponseTimes = 100;

  /**
   * Track request metrics
   */
  trackRequest(success: boolean, responseTime: number): void {
    this.requestMetrics.total++;
    
    if (success) {
      this.requestMetrics.successful++;
    } else {
      this.requestMetrics.failed++;
    }

    // Track response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.maxResponseTimes) {
      this.responseTimes.shift();
    }

    // Calculate average
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.requestMetrics.averageResponseTime = sum / this.responseTimes.length;
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    
    try {
      const isHealthy = await database.healthCheck();
      const responseTime = Date.now() - start;
      
      return {
        status: isHealthy ? 'up' : 'down',
        responseTime,
        details: database.getStatus()
      };
    } catch (error) {
      return {
        status: 'down',
        message: error.message,
        responseTime: Date.now() - start
      };
    }
  }

  /**
   * Check memory health
   */
  private checkMemory(): ComponentHealth {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;

    let status: 'up' | 'degraded' | 'down' = 'up';
    let message: string | undefined;

    if (percentage > 90) {
      status = 'down';
      message = 'Critical memory usage';
    } else if (percentage > 75) {
      status = 'degraded';
      message = 'High memory usage';
    }

    return {
      status,
      message,
      details: {
        total: Math.round(total / 1024 / 1024),
        used: Math.round(used / 1024 / 1024),
        free: Math.round(free / 1024 / 1024),
        percentage: Math.round(percentage)
      }
    };
  }

  /**
   * Check circuit breakers health
   */
  private checkCircuitBreakers(): ComponentHealth {
    const breakers = circuitBreakerFactory.getAllStatus();
    const openBreakers = breakers.filter(b => b.isOpen);
    
    let status: 'up' | 'degraded' | 'down' = 'up';
    let message: string | undefined;

    if (openBreakers.length > 0) {
      status = 'degraded';
      message = `${openBreakers.length} circuit(s) open`;
    }

    return {
      status,
      message,
      details: breakers
    };
  }

  /**
   * Check disk space
   */
  private async checkDiskSpace(): Promise<ComponentHealth> {
    // Simplified disk check - in production use proper disk usage library
    try {
      const stats = await import('fs').then(fs => {
        return new Promise((resolve, reject) => {
          fs.promises.statfs('/')
            .then(resolve)
            .catch(() => {
              // Fallback for systems without statfs
              resolve({ bsize: 0, blocks: 0, bfree: 0, bavail: 0 });
            });
        });
      }) as any;

      if (stats.blocks > 0) {
        const total = stats.blocks * stats.bsize;
        const free = stats.bavail * stats.bsize;
        const used = total - free;
        const percentage = (used / total) * 100;

        let status: 'up' | 'degraded' | 'down' = 'up';
        let message: string | undefined;

        if (percentage > 90) {
          status = 'down';
          message = 'Critical disk usage';
        } else if (percentage > 75) {
          status = 'degraded';
          message = 'High disk usage';
        }

        return {
          status,
          message,
          details: {
            total: Math.round(total / 1024 / 1024 / 1024),
            used: Math.round(used / 1024 / 1024 / 1024),
            free: Math.round(free / 1024 / 1024 / 1024),
            percentage: Math.round(percentage)
          }
        };
      }

      return { status: 'up' };
    } catch (error) {
      return {
        status: 'up',
        message: 'Disk check not available'
      };
    }
  }

  /**
   * Get CPU metrics
   */
  private getCPUMetrics(): CPUMetrics {
    const cpus = os.cpus();
    const loadAverage = os.loadavg();

    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const usage = 100 - ~~(100 * totalIdle / totalTick);

    return {
      usage,
      loadAverage,
      cores: cpus.length
    };
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics(): MemoryMetrics {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return {
      total: Math.round(total / 1024 / 1024),
      used: Math.round(used / 1024 / 1024),
      free: Math.round(free / 1024 / 1024),
      percentage: Math.round((used / total) * 100)
    };
  }

  /**
   * Get overall health status
   */
  async getHealth(): Promise<HealthStatus> {
    const [database, diskSpace] = await Promise.all([
      this.checkDatabase(),
      this.checkDiskSpace()
    ]);

    const memory = this.checkMemory();
    const circuitBreakers = this.checkCircuitBreakers();

    // Determine overall status
    const checks = { database, memory, circuitBreakers, diskSpace };
    const statuses = Object.values(checks).map(c => c.status);
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (statuses.includes('down')) {
      status = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      metrics: {
        cpu: this.getCPUMetrics(),
        memory: this.getMemoryMetrics(),
        requests: { ...this.requestMetrics }
      }
    };
  }

  /**
   * Get liveness status (basic check)
   */
  getLiveness(): { status: string; timestamp: string } {
    return {
      status: 'alive',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get readiness status
   */
  async getReadiness(): Promise<{ ready: boolean; checks: any }> {
    const dbStatus = await this.checkDatabase();
    const ready = dbStatus.status === 'up';

    return {
      ready,
      checks: {
        database: dbStatus.status
      }
    };
  }
}

// Create singleton instance
export const healthCheckService = new HealthCheckService();

/**
 * Health check routes
 */
export const healthCheckRouter = Router();

// Main health endpoint
healthCheckRouter.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await healthCheckService.getHealth();
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Liveness probe (Kubernetes)
healthCheckRouter.get('/health/live', (req: Request, res: Response) => {
  res.json(healthCheckService.getLiveness());
});

// Readiness probe (Kubernetes)
healthCheckRouter.get('/health/ready', async (req: Request, res: Response) => {
  try {
    const readiness = await healthCheckService.getReadiness();
    res.status(readiness.ready ? 200 : 503).json(readiness);
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message
    });
  }
});

// Metrics endpoint
healthCheckRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const health = await healthCheckService.getHealth();
    res.json(health.metrics);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default healthCheckService;