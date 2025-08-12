import { EventEmitter } from 'events';
import { logger } from './logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerOptions {
  name: string;
  timeout?: number;           // Request timeout in ms
  errorThreshold?: number;    // Number of failures before opening
  successThreshold?: number;  // Number of successes to close from half-open
  resetTimeout?: number;      // Time before trying half-open state
  volumeThreshold?: number;   // Minimum requests before error threshold applies
  errorRate?: number;         // Error rate percentage to open circuit
}

interface CircuitStats {
  requests: number;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

/**
 * Circuit Breaker implementation for fault tolerance
 */
export class CircuitBreaker extends EventEmitter {
  private name: string;
  private state: CircuitState = CircuitState.CLOSED;
  private stats: CircuitStats;
  private options: Required<CircuitBreakerOptions>;
  private resetTimer: NodeJS.Timeout | null = null;
  private halfOpenTests = 0;

  constructor(options: CircuitBreakerOptions) {
    super();
    
    this.name = options.name;
    this.options = {
      name: options.name,
      timeout: options.timeout || 10000,
      errorThreshold: options.errorThreshold || 5,
      successThreshold: options.successThreshold || 2,
      resetTimeout: options.resetTimeout || 30000,
      volumeThreshold: options.volumeThreshold || 10,
      errorRate: options.errorRate || 50
    };
    
    this.stats = {
      requests: 0,
      failures: 0,
      successes: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      throw new Error(`Circuit breaker is OPEN for ${this.name}`);
    }

    // Track request
    this.stats.requests++;

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(fn);
      
      // Record success
      this.onSuccess();
      
      return result;
    } catch (error) {
      // Record failure
      this.onFailure();
      
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timeout after ${this.options.timeout}ms`));
      }, this.options.timeout);

      try {
        const result = await fn();
        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.stats.successes++;
    this.stats.consecutiveSuccesses++;
    this.stats.consecutiveFailures = 0;
    this.stats.lastSuccessTime = new Date();

    // Check if we should close from half-open
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.stats.consecutiveSuccesses >= this.options.successThreshold) {
        this.close();
      }
    }

    this.emit('success', this.getStatus());
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.stats.failures++;
    this.stats.consecutiveFailures++;
    this.stats.consecutiveSuccesses = 0;
    this.stats.lastFailureTime = new Date();

    // Check if we should open the circuit
    if (this.state === CircuitState.CLOSED) {
      if (this.shouldOpen()) {
        this.open();
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Single failure in half-open reopens immediately
      this.open();
    }

    this.emit('failure', this.getStatus());
  }

  /**
   * Check if circuit should open
   */
  private shouldOpen(): boolean {
    // Check consecutive failures
    if (this.stats.consecutiveFailures >= this.options.errorThreshold) {
      return true;
    }

    // Check error rate if volume threshold met
    if (this.stats.requests >= this.options.volumeThreshold) {
      const errorRate = (this.stats.failures / this.stats.requests) * 100;
      return errorRate >= this.options.errorRate;
    }

    return false;
  }

  /**
   * Open the circuit
   */
  private open(): void {
    this.state = CircuitState.OPEN;
    
    logger.warn(`Circuit breaker OPENED for ${this.name}`);
    
    // Schedule reset to half-open
    this.resetTimer = setTimeout(() => {
      this.halfOpen();
    }, this.options.resetTimeout);

    this.emit('open', this.getStatus());
  }

  /**
   * Half-open the circuit for testing
   */
  private halfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenTests = 0;
    this.stats.consecutiveSuccesses = 0;
    this.stats.consecutiveFailures = 0;
    
    logger.info(`Circuit breaker HALF-OPEN for ${this.name}`);
    
    this.emit('halfOpen', this.getStatus());
  }

  /**
   * Close the circuit
   */
  private close(): void {
    this.state = CircuitState.CLOSED;
    this.resetStats();
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    
    logger.info(`Circuit breaker CLOSED for ${this.name}`);
    
    this.emit('close', this.getStatus());
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      requests: 0,
      failures: 0,
      successes: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0
    };
  }

  /**
   * Get circuit breaker status
   */
  getStatus(): {
    name: string;
    state: CircuitState;
    stats: CircuitStats;
    isOpen: boolean;
  } {
    return {
      name: this.name,
      state: this.state,
      stats: { ...this.stats },
      isOpen: this.state === CircuitState.OPEN
    };
  }

  /**
   * Force open the circuit (for testing/emergency)
   */
  forceOpen(): void {
    this.open();
  }

  /**
   * Force close the circuit (for testing/recovery)
   */
  forceClose(): void {
    this.close();
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.close();
    this.resetStats();
  }
}

/**
 * Circuit breaker factory for managing multiple breakers
 */
class CircuitBreakerFactory {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker
   */
  getBreaker(options: CircuitBreakerOptions): CircuitBreaker {
    const existing = this.breakers.get(options.name);
    if (existing) return existing;

    const breaker = new CircuitBreaker(options);
    this.breakers.set(options.name, breaker);
    
    // Log circuit events
    breaker.on('open', (status) => {
      logger.warn(`Circuit ${status.name} opened`, status.stats);
    });
    
    breaker.on('close', (status) => {
      logger.info(`Circuit ${status.name} closed`, status.stats);
    });
    
    breaker.on('halfOpen', (status) => {
      logger.info(`Circuit ${status.name} half-open`, status.stats);
    });

    return breaker;
  }

  /**
   * Get all circuit breakers status
   */
  getAllStatus(): Array<ReturnType<CircuitBreaker['getStatus']>> {
    return Array.from(this.breakers.values()).map(breaker => breaker.getStatus());
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

export const circuitBreakerFactory = new CircuitBreakerFactory();

// Pre-configured breakers for common services
export const emailServiceBreaker = circuitBreakerFactory.getBreaker({
  name: 'email-service',
  timeout: 5000,
  errorThreshold: 3,
  resetTimeout: 30000
});

export const paymentServiceBreaker = circuitBreakerFactory.getBreaker({
  name: 'payment-service',
  timeout: 10000,
  errorThreshold: 2,
  resetTimeout: 60000
});

export const storageServiceBreaker = circuitBreakerFactory.getBreaker({
  name: 'storage-service',
  timeout: 15000,
  errorThreshold: 5,
  resetTimeout: 30000
});

export default CircuitBreaker;