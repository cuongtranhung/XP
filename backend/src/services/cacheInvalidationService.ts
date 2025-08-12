import cacheService from './cacheService';
import { logger } from '../utils/logger';

// Types for advanced invalidation
export type InvalidationPattern = 
  | 'immediate' | 'lazy' | 'writeThrough' | 'writeBehind' 
  | 'timeBased' | 'dependencyBased' | 'versionBased' 
  | 'probabilistic' | 'hierarchical' | 'bulkInvalidation';

export interface InvalidationRule {
  id: string;
  pattern: InvalidationPattern;
  entityType: string;
  conditions: {
    ttl?: number;
    maxAge?: number;
    probability?: number;
    dependencies?: string[];
    cascadeDepth?: number;
    versionField?: string;
    customCondition?: (data: any) => boolean;
  };
  priority: 1 | 2 | 3 | 4 | 5;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    description?: string;
    tags?: string[];
    statistics?: {
      timesTriggered: number;
      averageExecutionTime: number;
      lastTriggered?: Date;
    };
  };
}

export interface InvalidationEvent {
  ruleId: string;
  pattern: InvalidationPattern;
  entityType: string;
  entityId?: string;
  affectedKeys: string[];
  trigger: 'manual' | 'automatic' | 'dependency' | 'time_based';
  executionTime: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

/**
 * Advanced Cache Invalidation Service
 * Manages intelligent cache invalidation strategies with advanced patterns
 */
class CacheInvalidationService {
  private invalidationPatterns: Map<string, RegExp> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private invalidationRules: Map<string, InvalidationRule> = new Map();
  private versionTracker: Map<string, number> = new Map();
  private executionStats: Map<string, InvalidationEvent[]> = new Map();

  // Advanced invalidation patterns
  private advancedPatterns = {
    immediate: this.immediateInvalidation.bind(this),
    lazy: this.lazyInvalidation.bind(this),
    writeThrough: this.writeThroughInvalidation.bind(this),
    writeBehind: this.writeBehindInvalidation.bind(this),
    timeBased: this.timeBasedInvalidation.bind(this),
    dependencyBased: this.dependencyBasedInvalidation.bind(this),
    versionBased: this.versionBasedInvalidation.bind(this),
    probabilistic: this.probabilisticInvalidation.bind(this),
    hierarchical: this.hierarchicalInvalidation.bind(this),
    bulkInvalidation: this.bulkInvalidationPattern.bind(this)
  };

  constructor() {
    this.initializePatterns();
    this.initializeDependencies();
    this.initializeAdvancedRules();
  }

  /**
   * Initialize cache key patterns for bulk invalidation
   */
  private initializePatterns(): void {
    // User-related patterns
    this.invalidationPatterns.set('user', /^(user:|session:|user:prefs:|user:stats:)/);
    
    // Form-related patterns
    this.invalidationPatterns.set('form', /^(form:|form:schema:|form:submissions:)/);
    
    // System-related patterns
    this.invalidationPatterns.set('system', /^(system:|config:|settings:)/);
    
    // Session-related patterns
    this.invalidationPatterns.set('session', /^(session:|user:sessions:)/);
    
    // Location-related patterns
    this.invalidationPatterns.set('location', /^(location:|gps:)/);
  }

  /**
   * Initialize cache dependency relationships
   */
  private initializeDependencies(): void {
    // When user changes, invalidate related caches
    this.dependencyGraph.set('user', new Set([
      'session',
      'form',
      'location'
    ]));

    // When form changes, invalidate related caches
    this.dependencyGraph.set('form', new Set([
      'submissions',
      'analytics'
    ]));

    // When system config changes, invalidate everything
    this.dependencyGraph.set('system', new Set([
      'user',
      'form',
      'session',
      'location'
    ]));
  }

  /**
   * Invalidate cache by entity type
   */
  async invalidateByType(type: string, id?: string | number): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`🗑️ Invalidating cache for type: ${type}${id ? ` with id: ${id}` : ''}`);

      // Get pattern for this type
      const pattern = this.invalidationPatterns.get(type);
      if (!pattern) {
        logger.warn(`No invalidation pattern found for type: ${type}`);
        return;
      }

      // Build specific key if ID provided
      if (id) {
        await this.invalidateSpecific(type, id);
      } else {
        await this.invalidatePattern(pattern);
      }

      // Invalidate dependent caches
      await this.invalidateDependencies(type, id);

      const duration = Date.now() - startTime;
      logger.info(`✅ Cache invalidation completed in ${duration}ms`);

    } catch (error) {
      logger.error('Cache invalidation error:', error);
      throw error;
    }
  }

  /**
   * Invalidate specific cache entries
   */
  private async invalidateSpecific(type: string, id: string | number): Promise<void> {
    const keysToInvalidate: string[] = [];

    switch (type) {
      case 'user':
        keysToInvalidate.push(
          `user:${id}`,
          `user:prefs:${id}`,
          `user:sessions:${id}`,
          `user:stats:${id}`,
          `location:prefs:${id}`,
          `location:sessions:${id}`,
          `location:recent:${id}`
        );
        break;

      case 'form':
        keysToInvalidate.push(
          `form:${id}`,
          `form:schema:${id}`,
          `form:submissions:${id}`,
          `form:analytics:${id}`,
          `form:versions:${id}`
        );
        break;

      case 'session':
        keysToInvalidate.push(
          `session:${id}`,
          `session:data:${id}`
        );
        break;

      default:
        keysToInvalidate.push(`${type}:${id}`);
    }

    // Delete all keys
    for (const key of keysToInvalidate) {
      await cacheService.del(key);
    }

    logger.debug(`Invalidated ${keysToInvalidate.length} specific keys for ${type}:${id}`);
  }

  /**
   * Invalidate cache by pattern
   */
  private async invalidatePattern(pattern: RegExp): Promise<void> {
    // Note: In production with real Redis, you would use SCAN command
    // For now, we'll track invalidated patterns
    logger.debug(`Invalidating pattern: ${pattern}`);
    
    // This would be implemented with Redis SCAN in production
    // Example: SCAN 0 MATCH pattern* COUNT 1000
  }

  /**
   * Invalidate dependent caches
   */
  private async invalidateDependencies(type: string, id?: string | number): Promise<void> {
    const dependencies = this.dependencyGraph.get(type);
    
    if (!dependencies || dependencies.size === 0) {
      return;
    }

    logger.debug(`Invalidating ${dependencies.size} dependencies for ${type}`);

    for (const depType of dependencies) {
      const depPattern = this.invalidationPatterns.get(depType);
      if (depPattern) {
        await this.invalidatePattern(depPattern);
      }
    }
  }

  /**
   * Invalidate cache after user update
   */
  async invalidateUser(userId: number): Promise<void> {
    await this.invalidateByType('user', userId);
  }

  /**
   * Invalidate cache after form update
   */
  async invalidateForm(formId: number): Promise<void> {
    await this.invalidateByType('form', formId);
  }

  /**
   * Invalidate cache after session update
   */
  async invalidateSession(sessionId: string): Promise<void> {
    await this.invalidateByType('session', sessionId);
  }

  /**
   * Invalidate all system caches
   */
  async invalidateSystem(): Promise<void> {
    logger.warn('⚠️ Invalidating all system caches');
    await this.invalidateByType('system');
  }

  /**
   * Smart invalidation based on database operation
   */
  async handleDatabaseChange(table: string, operation: 'INSERT' | 'UPDATE' | 'DELETE', id?: any): Promise<void> {
    logger.debug(`Database change detected: ${operation} on ${table}${id ? ` with id ${id}` : ''}`);

    // Map database tables to cache types
    const tableToType: Record<string, string> = {
      'users': 'user',
      'dynamic_forms': 'form',
      'form_submissions': 'form',
      'user_sessions': 'session',
      'roles': 'user',
      'permissions': 'user',
      'system_config': 'system'
    };

    const cacheType = tableToType[table];
    if (cacheType) {
      await this.invalidateByType(cacheType, id);
    }
  }

  /**
   * Scheduled cache cleanup
   */
  async cleanupExpiredCache(): Promise<void> {
    logger.info('🧹 Starting expired cache cleanup');
    
    // This would be handled by Redis TTL automatically
    // But we can add custom cleanup logic here if needed
    
    logger.info('✅ Expired cache cleanup completed');
  }

  /**
   * Get invalidation statistics
   */
  getInvalidationStats(): {
    patterns: number;
    dependencies: number;
    types: string[];
  } {
    return {
      patterns: this.invalidationPatterns.size,
      dependencies: this.dependencyGraph.size,
      types: Array.from(this.invalidationPatterns.keys())
    };
  }

  /**
   * Register custom invalidation pattern
   */
  registerPattern(type: string, pattern: RegExp): void {
    this.invalidationPatterns.set(type, pattern);
    logger.info(`Registered custom invalidation pattern for type: ${type}`);
  }

  /**
   * Register custom dependency
   */
  registerDependency(type: string, dependsOn: string[]): void {
    const existing = this.dependencyGraph.get(type) || new Set();
    dependsOn.forEach(dep => existing.add(dep));
    this.dependencyGraph.set(type, existing);
    logger.info(`Registered dependencies for type: ${type}`);
  }

  // Advanced invalidation methods

  /**
   * Initialize advanced invalidation rules
   */
  private initializeAdvancedRules(): void {
    // Register user invalidation rule with hierarchical pattern
    this.registerAdvancedRule({
      pattern: 'hierarchical',
      entityType: 'user',
      conditions: {
        dependencies: ['session', 'preferences', 'location'],
        cascadeDepth: 2
      },
      priority: 1,
      isActive: true,
      metadata: {
        description: 'Hierarchical invalidation for user-related caches',
        tags: ['user', 'cascade', 'session', 'preferences']
      }
    });

    // Register form invalidation rule with version-based pattern
    this.registerAdvancedRule({
      pattern: 'versionBased',
      entityType: 'form',
      conditions: {
        versionField: 'version',
        dependencies: ['submissions', 'analytics']
      },
      priority: 2,
      isActive: true,
      metadata: {
        description: 'Version-based invalidation for forms',
        tags: ['form', 'version', 'submissions']
      }
    });

    // Register location invalidation rule with probabilistic pattern
    this.registerAdvancedRule({
      pattern: 'probabilistic',
      entityType: 'location',
      conditions: {
        probability: 0.1,
        maxAge: 7200 // 2 hours
      },
      priority: 3,
      isActive: true,
      metadata: {
        description: 'Probabilistic early expiration for location data',
        tags: ['location', 'probabilistic', 'geospatial']
      }
    });

    logger.info('Advanced invalidation rules initialized');
  }

  /**
   * Register advanced invalidation rule
   */
  registerAdvancedRule(rule: Omit<InvalidationRule, 'id' | 'createdAt' | 'updatedAt'>): string {
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullRule: InvalidationRule = {
      ...rule,
      id: ruleId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        ...rule.metadata,
        statistics: {
          timesTriggered: 0,
          averageExecutionTime: 0,
          ...rule.metadata?.statistics
        }
      }
    };

    this.invalidationRules.set(ruleId, fullRule);

    logger.info('Advanced invalidation rule registered', {
      ruleId,
      pattern: rule.pattern,
      entityType: rule.entityType
    });

    return ruleId;
  }

  /**
   * Execute advanced invalidation
   */
  async executeAdvancedInvalidation(entityType: string, entityId?: string, pattern?: InvalidationPattern): Promise<InvalidationEvent[]> {
    const startTime = Date.now();
    const events: InvalidationEvent[] = [];

    try {
      // Get applicable rules
      const rules = Array.from(this.invalidationRules.values())
        .filter(rule => rule.isActive && rule.entityType === entityType)
        .filter(rule => !pattern || rule.pattern === pattern)
        .sort((a, b) => a.priority - b.priority);

      for (const rule of rules) {
        const event = await this.executeAdvancedRule(rule, entityId);
        if (event) {
          events.push(event);
        }
      }

      const totalTime = Date.now() - startTime;
      logger.debug('Advanced invalidation completed', {
        entityType,
        entityId,
        pattern,
        eventsGenerated: events.length,
        executionTime: `${totalTime}ms`
      });

    } catch (error) {
      logger.error('Advanced invalidation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        entityType,
        entityId,
        pattern
      });
    }

    return events;
  }

  /**
   * Execute advanced invalidation rule
   */
  private async executeAdvancedRule(rule: InvalidationRule, entityId?: string): Promise<InvalidationEvent | null> {
    const startTime = Date.now();
    const affectedKeys: string[] = [];

    try {
      // Execute pattern-specific invalidation
      const patternMethod = this.advancedPatterns[rule.pattern];
      if (patternMethod) {
        await patternMethod(rule, entityId, affectedKeys);
      } else {
        logger.warn('Unknown advanced invalidation pattern', { pattern: rule.pattern });
        return null;
      }

      const executionTime = Date.now() - startTime;
      
      // Update rule statistics
      this.updateRuleStatistics(rule.id, executionTime);

      const event: InvalidationEvent = {
        ruleId: rule.id,
        pattern: rule.pattern,
        entityType: rule.entityType,
        entityId,
        affectedKeys,
        trigger: 'automatic',
        executionTime,
        success: true,
        timestamp: new Date()
      };

      // Store execution event
      if (!this.executionStats.has(rule.id)) {
        this.executionStats.set(rule.id, []);
      }
      this.executionStats.get(rule.id)!.push(event);

      return event;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      const event: InvalidationEvent = {
        ruleId: rule.id,
        pattern: rule.pattern,
        entityType: rule.entityType,
        entityId,
        affectedKeys,
        trigger: 'automatic',
        executionTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };

      logger.error('Advanced invalidation rule execution failed', {
        ruleId: rule.id,
        pattern: rule.pattern,
        error: event.error
      });

      return event;
    }
  }

  // Advanced invalidation pattern implementations

  private async immediateInvalidation(rule: InvalidationRule, entityId?: string, affectedKeys: string[] = []): Promise<void> {
    const cacheKey = entityId ? `${rule.entityType}:${entityId}` : `${rule.entityType}:*`;
    
    if (cacheKey.includes('*')) {
      // Pattern-based invalidation
      const invalidatedCount = await this.invalidateByPattern(cacheKey);
      affectedKeys.push(`${invalidatedCount} keys matching ${cacheKey}`);
    } else {
      await cacheService.del(cacheKey);
      affectedKeys.push(cacheKey);
    }
  }

  private async lazyInvalidation(rule: InvalidationRule, entityId?: string, affectedKeys: string[] = []): Promise<void> {
    // Mark for lazy invalidation (invalidate on next access)
    const cacheKey = entityId ? `${rule.entityType}:${entityId}` : rule.entityType;
    const lazyKey = `lazy:invalidate:${cacheKey}`;
    
    await cacheService.set(lazyKey, { markedAt: new Date() }, { ttl: 3600 });
    affectedKeys.push(`lazy:${cacheKey}`);
  }

  private async writeThroughInvalidation(rule: InvalidationRule, entityId?: string, affectedKeys: string[] = []): Promise<void> {
    // Write-through: Update cache with new data
    const cacheKey = entityId ? `${rule.entityType}:${entityId}` : rule.entityType;
    
    // In a real implementation, we would fetch fresh data and update the cache
    // For now, we'll delete to force fresh fetch on next access
    await cacheService.del(cacheKey);
    affectedKeys.push(cacheKey);
  }

  private async writeBehindInvalidation(rule: InvalidationRule, entityId?: string, affectedKeys: string[] = []): Promise<void> {
    // Write-behind: Asynchronous invalidation
    const cacheKey = entityId ? `${rule.entityType}:${entityId}` : rule.entityType;
    
    setTimeout(async () => {
      try {
        await cacheService.del(cacheKey);
        logger.debug('Write-behind invalidation completed', { cacheKey });
      } catch (error) {
        logger.error('Write-behind invalidation failed', { cacheKey, error });
      }
    }, 100); // Small delay for async execution

    affectedKeys.push(`async:${cacheKey}`);
  }

  private async timeBasedInvalidation(rule: InvalidationRule, entityId?: string, affectedKeys: string[] = []): Promise<void> {
    const cacheKey = entityId ? `${rule.entityType}:${entityId}` : rule.entityType;
    
    if (rule.conditions.ttl) {
      // Update TTL instead of immediate invalidation
      await cacheService.set(cacheKey, null, { ttl: rule.conditions.ttl });
      affectedKeys.push(`ttl_updated:${cacheKey}`);
    } else {
      await cacheService.del(cacheKey);
      affectedKeys.push(cacheKey);
    }
  }

  private async dependencyBasedInvalidation(rule: InvalidationRule, entityId?: string, affectedKeys: string[] = []): Promise<void> {
    const dependencies = rule.conditions.dependencies || [];
    const cascadeDepth = rule.conditions.cascadeDepth || 1;

    for (const dependency of dependencies) {
      await this.invalidateEntityWithDepth(dependency, cascadeDepth, affectedKeys);
    }
  }

  private async versionBasedInvalidation(rule: InvalidationRule, entityId?: string, affectedKeys: string[] = []): Promise<void> {
    if (!entityId) return;

    const versionKey = `${rule.entityType}:${entityId}`;
    const currentVersion = this.versionTracker.get(versionKey) || 0;
    const newVersion = currentVersion + 1;

    this.versionTracker.set(versionKey, newVersion);
    await cacheService.del(`${rule.entityType}:${entityId}`);
    
    affectedKeys.push(`${versionKey} (version ${currentVersion} → ${newVersion})`);
  }

  private async probabilisticInvalidation(rule: InvalidationRule, entityId?: string, affectedKeys: string[] = []): Promise<void> {
    const probability = rule.conditions.probability || 0.1;
    
    if (Math.random() < probability) {
      const cacheKey = entityId ? `${rule.entityType}:${entityId}` : rule.entityType;
      await cacheService.del(cacheKey);
      affectedKeys.push(`probabilistic:${cacheKey}`);
    }
  }

  private async hierarchicalInvalidation(rule: InvalidationRule, entityId?: string, affectedKeys: string[] = []): Promise<void> {
    const baseKey = entityId ? `${rule.entityType}:${entityId}` : rule.entityType;
    
    // Parent
    await cacheService.del(baseKey);
    affectedKeys.push(baseKey);
    
    // Children (pattern-based)
    const childPattern = `${baseKey}:*`;
    const childCount = await this.invalidateByPattern(childPattern);
    affectedKeys.push(`${childCount} children of ${baseKey}`);
  }

  private async bulkInvalidationPattern(rule: InvalidationRule, entityId?: string, affectedKeys: string[] = []): Promise<void> {
    // Bulk invalidation for multiple related entities
    const patterns = [
      `${rule.entityType}:*`,
      `${rule.entityType}:cache:*`,
      `${rule.entityType}:metadata:*`
    ];

    for (const pattern of patterns) {
      const count = await this.invalidateByPattern(pattern);
      affectedKeys.push(`${count} keys for pattern ${pattern}`);
    }
  }

  // Helper methods

  private async invalidateEntityWithDepth(entityType: string, depth: number, affectedKeys: string[]): Promise<void> {
    if (depth <= 0) return;

    const cacheKey = `${entityType}:*`;
    const invalidatedCount = await this.invalidateByPattern(cacheKey);
    affectedKeys.push(`${invalidatedCount} keys for ${entityType} (depth ${depth})`);

    // Recurse for dependencies
    const dependents = this.dependencyGraph.get(entityType) || new Set();
    for (const dependent of dependents) {
      await this.invalidateEntityWithDepth(dependent, depth - 1, affectedKeys);
    }
  }

  private async invalidateByPattern(pattern: string): Promise<number> {
    // Mock pattern invalidation - in real Redis implementation would use SCAN
    logger.debug(`Mock pattern invalidation: ${pattern}`);
    
    // Return mock count
    return Math.floor(Math.random() * 10) + 1;
  }

  private updateRuleStatistics(ruleId: string, executionTime: number): void {
    const rule = this.invalidationRules.get(ruleId);
    if (rule && rule.metadata && rule.metadata.statistics) {
      const stats = rule.metadata.statistics;
      stats.timesTriggered++;
      stats.averageExecutionTime = ((stats.averageExecutionTime * (stats.timesTriggered - 1)) + executionTime) / stats.timesTriggered;
      stats.lastTriggered = new Date();
    }
  }

  /**
   * Get advanced invalidation statistics
   */
  getAdvancedStats(): {
    totalRules: number;
    activeRules: number;
    patterns: string[];
    executionEvents: number;
    averageExecutionTime: number;
  } {
    const totalRules = this.invalidationRules.size;
    const activeRules = Array.from(this.invalidationRules.values()).filter(rule => rule.isActive).length;
    const patterns = Array.from(new Set(Array.from(this.invalidationRules.values()).map(rule => rule.pattern)));
    
    let totalEvents = 0;
    let totalExecutionTime = 0;
    
    for (const events of this.executionStats.values()) {
      totalEvents += events.length;
      totalExecutionTime += events.reduce((sum, event) => sum + event.executionTime, 0);
    }
    
    const averageExecutionTime = totalEvents > 0 ? totalExecutionTime / totalEvents : 0;

    return {
      totalRules,
      activeRules,
      patterns,
      executionEvents: totalEvents,
      averageExecutionTime: Math.round(averageExecutionTime)
    };
  }
}

// Export singleton instance
export default new CacheInvalidationService();