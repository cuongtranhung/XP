/**
 * Advanced Filtering Service
 * Dynamic filtering system with complex conditions and operators
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: any;
  dataType?: DataType;
  caseSensitive?: boolean;
  negate?: boolean;
}

export type FilterOperator = 
  | 'equals' | 'notEquals'
  | 'contains' | 'notContains'
  | 'startsWith' | 'endsWith'
  | 'in' | 'notIn'
  | 'between' | 'notBetween'
  | 'greaterThan' | 'greaterThanOrEqual'
  | 'lessThan' | 'lessThanOrEqual'
  | 'exists' | 'notExists'
  | 'regex' | 'notRegex'
  | 'isNull' | 'isNotNull'
  | 'isEmpty' | 'isNotEmpty'
  | 'isTrue' | 'isFalse'
  | 'before' | 'after'
  | 'dateRange' | 'notDateRange'
  | 'inRadius' | 'notInRadius'
  | 'intersects' | 'notIntersects';

export type DataType = 
  | 'string' | 'number' | 'boolean' 
  | 'date' | 'array' | 'object'
  | 'geo' | 'json';

export interface FilterGroup {
  operator: 'AND' | 'OR' | 'NOT';
  conditions?: FilterCondition[];
  groups?: FilterGroup[];
}

export interface FilterQuery {
  filter: FilterGroup;
  sort?: SortOptions[];
  pagination?: PaginationOptions;
  projection?: ProjectionOptions;
  options?: FilterOptions;
}

export interface SortOptions {
  field: string;
  order: 'asc' | 'desc';
  nullsFirst?: boolean;
  customOrder?: any[];
}

export interface PaginationOptions {
  page: number;
  limit: number;
  cursor?: string;
  maxLimit?: number;
}

export interface ProjectionOptions {
  include?: string[];
  exclude?: string[];
  rename?: Record<string, string>;
  compute?: ComputedField[];
}

export interface ComputedField {
  name: string;
  expression: string;
  type: DataType;
}

export interface FilterOptions {
  caseInsensitive?: boolean;
  fuzzyMatching?: boolean;
  stemming?: boolean;
  synonyms?: boolean;
  locale?: string;
  timezone?: string;
  validateTypes?: boolean;
  allowPartialMatch?: boolean;
  maxDepth?: number;
}

export interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filter: FilterGroup;
  sort?: SortOptions[];
  projection?: ProjectionOptions;
  category?: string;
  tags?: string[];
  isPublic?: boolean;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

export interface FilterResult<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  cursor?: string;
  aggregations?: Record<string, any>;
  metadata?: FilterMetadata;
}

export interface FilterMetadata {
  executionTime: number;
  matchedCount: number;
  filteredCount: number;
  appliedFilters: number;
  optimizations: string[];
  warnings?: string[];
}

export interface FilterValidation {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions?: FilterSuggestion[];
}

export interface ValidationError {
  field: string;
  operator: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  impact?: 'performance' | 'accuracy' | 'security';
}

export interface FilterSuggestion {
  type: 'optimization' | 'alternative' | 'correction';
  message: string;
  suggestion: FilterCondition | FilterGroup;
}

export interface FilterStatistics {
  totalFilters: number;
  filtersByType: Record<string, number>;
  filtersByOperator: Record<FilterOperator, number>;
  popularFields: Array<{ field: string; count: number }>;
  averageComplexity: number;
  performanceMetrics: {
    averageExecutionTime: number;
    slowestFilters: Array<{ filter: string; time: number }>;
    fastestFilters: Array<{ filter: string; time: number }>;
  };
}

/**
 * Filtering Service Class
 */
class FilteringService extends EventEmitter {
  private presets = new Map<string, FilterPreset>();
  private filterCache = new Map<string, any>();
  private validationCache = new Map<string, FilterValidation>();
  
  private statistics: FilterStatistics = {
    totalFilters: 0,
    filtersByType: {},
    filtersByOperator: {} as any,
    popularFields: [],
    averageComplexity: 0,
    performanceMetrics: {
      averageExecutionTime: 0,
      slowestFilters: [],
      fastestFilters: []
    }
  };
  
  private readonly operatorMappings = new Map<FilterOperator, string>();
  private readonly dataTypeValidators = new Map<DataType, (value: any) => boolean>();
  private readonly cacheTimeout = 300000; // 5 minutes
  private readonly maxFilterDepth = 10;

  constructor() {
    super();
    this.initializeService();
  }

  /**
   * Initialize filtering service
   */
  private async initializeService(): Promise<void> {
    try {
      // Initialize operator mappings
      this.initializeOperatorMappings();
      
      // Initialize data type validators
      this.initializeDataTypeValidators();
      
      // Load presets
      await this.loadPresets();
      
      // Start cache cleanup
      this.startCacheCleanup();
      
      logger.info('✅ Filtering service initialized', {
        presets: this.presets.size
      });
      
    } catch (error) {
      logger.error('❌ Failed to initialize filtering service', { error });
      throw error;
    }
  }

  /**
   * Apply filters to data
   */
  async applyFilter<T = any>(
    data: T[],
    filterQuery: FilterQuery
  ): Promise<FilterResult<T>> {
    const startTime = Date.now();
    
    try {
      // Validate filter
      const validation = await this.validateFilter(filterQuery.filter);
      if (!validation.isValid) {
        throw new Error(`Invalid filter: ${validation.errors[0]?.message}`);
      }
      
      // Check cache
      const cacheKey = this.getCacheKey(filterQuery);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Apply filter
      let filtered = this.filterData(data, filterQuery.filter, filterQuery.options);
      
      // Apply sorting
      if (filterQuery.sort && filterQuery.sort.length > 0) {
        filtered = this.sortData(filtered, filterQuery.sort);
      }
      
      // Apply projection
      if (filterQuery.projection) {
        filtered = this.projectData(filtered, filterQuery.projection);
      }
      
      // Apply pagination
      const pagination = filterQuery.pagination || { page: 1, limit: 20 };
      const total = filtered.length;
      const start = (pagination.page - 1) * pagination.limit;
      const end = start + pagination.limit;
      const paginatedData = filtered.slice(start, end);
      
      const result: FilterResult<T> = {
        data: paginatedData,
        total,
        page: pagination.page,
        limit: pagination.limit,
        hasMore: end < total,
        cursor: pagination.cursor,
        metadata: {
          executionTime: Date.now() - startTime,
          matchedCount: data.length,
          filteredCount: filtered.length,
          appliedFilters: this.countFilters(filterQuery.filter),
          optimizations: []
        }
      };
      
      // Cache result
      this.cacheResult(cacheKey, result);
      
      // Update statistics
      this.updateStatistics(filterQuery, result.metadata!.executionTime);
      
      // Emit event
      this.emit('filterApplied', {
        total: result.total,
        filtered: result.data.length,
        executionTime: result.metadata!.executionTime
      });
      
      return result;
      
    } catch (error) {
      logger.error('Failed to apply filter', { error });
      throw error;
    }
  }

  /**
   * Build SQL WHERE clause from filter
   */
  buildSQLWhereClause(
    filter: FilterGroup,
    parameterIndex: number = 1
  ): { clause: string; parameters: any[] } {
    const parameters: any[] = [];
    
    const buildCondition = (condition: FilterCondition): string => {
      const field = condition.field;
      const paramIndex = parameterIndex + parameters.length;
      
      let clause = '';
      
      switch (condition.operator) {
        case 'equals':
          parameters.push(condition.value);
          clause = `${field} = $${paramIndex}`;
          break;
          
        case 'notEquals':
          parameters.push(condition.value);
          clause = `${field} != $${paramIndex}`;
          break;
          
        case 'contains':
          parameters.push(`%${condition.value}%`);
          clause = condition.caseSensitive 
            ? `${field} LIKE $${paramIndex}`
            : `${field} ILIKE $${paramIndex}`;
          break;
          
        case 'startsWith':
          parameters.push(`${condition.value}%`);
          clause = condition.caseSensitive
            ? `${field} LIKE $${paramIndex}`
            : `${field} ILIKE $${paramIndex}`;
          break;
          
        case 'endsWith':
          parameters.push(`%${condition.value}`);
          clause = condition.caseSensitive
            ? `${field} LIKE $${paramIndex}`
            : `${field} ILIKE $${paramIndex}`;
          break;
          
        case 'in':
          parameters.push(condition.value);
          clause = `${field} = ANY($${paramIndex})`;
          break;
          
        case 'notIn':
          parameters.push(condition.value);
          clause = `${field} != ALL($${paramIndex})`;
          break;
          
        case 'between':
          const [min, max] = condition.value;
          parameters.push(min, max);
          clause = `${field} BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
          break;
          
        case 'greaterThan':
          parameters.push(condition.value);
          clause = `${field} > $${paramIndex}`;
          break;
          
        case 'greaterThanOrEqual':
          parameters.push(condition.value);
          clause = `${field} >= $${paramIndex}`;
          break;
          
        case 'lessThan':
          parameters.push(condition.value);
          clause = `${field} < $${paramIndex}`;
          break;
          
        case 'lessThanOrEqual':
          parameters.push(condition.value);
          clause = `${field} <= $${paramIndex}`;
          break;
          
        case 'isNull':
          clause = `${field} IS NULL`;
          break;
          
        case 'isNotNull':
          clause = `${field} IS NOT NULL`;
          break;
          
        case 'regex':
          parameters.push(condition.value);
          clause = `${field} ~ $${paramIndex}`;
          break;
          
        case 'exists':
          clause = `${field} IS NOT NULL`;
          break;
          
        case 'notExists':
          clause = `${field} IS NULL`;
          break;
          
        default:
          clause = '1=1'; // Default to true
      }
      
      return condition.negate ? `NOT (${clause})` : clause;
    };
    
    const buildGroup = (group: FilterGroup): string => {
      const clauses: string[] = [];
      
      // Process conditions
      if (group.conditions) {
        for (const condition of group.conditions) {
          clauses.push(buildCondition(condition));
        }
      }
      
      // Process nested groups
      if (group.groups) {
        for (const nestedGroup of group.groups) {
          clauses.push(`(${buildGroup(nestedGroup)})`);
        }
      }
      
      if (clauses.length === 0) {
        return '1=1';
      }
      
      const joinOperator = group.operator === 'OR' ? ' OR ' : ' AND ';
      const joined = clauses.join(joinOperator);
      
      return group.operator === 'NOT' ? `NOT (${joined})` : joined;
    };
    
    return {
      clause: buildGroup(filter),
      parameters
    };
  }

  /**
   * Build MongoDB query from filter
   */
  buildMongoQuery(filter: FilterGroup): any {
    const buildCondition = (condition: FilterCondition): any => {
      const field = condition.field;
      let query: any = {};
      
      switch (condition.operator) {
        case 'equals':
          query[field] = condition.value;
          break;
          
        case 'notEquals':
          query[field] = { $ne: condition.value };
          break;
          
        case 'contains':
          query[field] = {
            $regex: condition.value,
            $options: condition.caseSensitive ? '' : 'i'
          };
          break;
          
        case 'startsWith':
          query[field] = {
            $regex: `^${condition.value}`,
            $options: condition.caseSensitive ? '' : 'i'
          };
          break;
          
        case 'endsWith':
          query[field] = {
            $regex: `${condition.value}$`,
            $options: condition.caseSensitive ? '' : 'i'
          };
          break;
          
        case 'in':
          query[field] = { $in: condition.value };
          break;
          
        case 'notIn':
          query[field] = { $nin: condition.value };
          break;
          
        case 'between':
          const [min, max] = condition.value;
          query[field] = { $gte: min, $lte: max };
          break;
          
        case 'greaterThan':
          query[field] = { $gt: condition.value };
          break;
          
        case 'greaterThanOrEqual':
          query[field] = { $gte: condition.value };
          break;
          
        case 'lessThan':
          query[field] = { $lt: condition.value };
          break;
          
        case 'lessThanOrEqual':
          query[field] = { $lte: condition.value };
          break;
          
        case 'exists':
          query[field] = { $exists: true };
          break;
          
        case 'notExists':
          query[field] = { $exists: false };
          break;
          
        case 'isNull':
          query[field] = null;
          break;
          
        case 'isNotNull':
          query[field] = { $ne: null };
          break;
          
        case 'regex':
          query[field] = { $regex: condition.value };
          break;
          
        case 'isEmpty':
          query[field] = { $in: [null, '', []] };
          break;
          
        case 'isNotEmpty':
          query[field] = { $nin: [null, '', []] };
          break;
          
        default:
          query[field] = condition.value;
      }
      
      return condition.negate ? { $not: query } : query;
    };
    
    const buildGroup = (group: FilterGroup): any => {
      const queries: any[] = [];
      
      // Process conditions
      if (group.conditions) {
        for (const condition of group.conditions) {
          queries.push(buildCondition(condition));
        }
      }
      
      // Process nested groups
      if (group.groups) {
        for (const nestedGroup of group.groups) {
          queries.push(buildGroup(nestedGroup));
        }
      }
      
      if (queries.length === 0) {
        return {};
      }
      
      if (group.operator === 'OR') {
        return { $or: queries };
      } else if (group.operator === 'NOT') {
        return { $nor: queries };
      } else {
        return { $and: queries };
      }
    };
    
    return buildGroup(filter);
  }

  /**
   * Create filter preset
   */
  async createPreset(preset: Omit<FilterPreset, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<FilterPreset> {
    try {
      const id = this.generatePresetId();
      
      const fullPreset: FilterPreset = {
        ...preset,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
      };
      
      // Validate filter
      const validation = await this.validateFilter(fullPreset.filter);
      if (!validation.isValid) {
        throw new Error(`Invalid filter preset: ${validation.errors[0]?.message}`);
      }
      
      // Store preset
      this.presets.set(id, fullPreset);
      await this.savePreset(fullPreset);
      
      logger.info('Filter preset created', { id, name: fullPreset.name });
      
      return fullPreset;
      
    } catch (error) {
      logger.error('Failed to create filter preset', { error });
      throw error;
    }
  }

  /**
   * Get filter preset
   */
  async getPreset(id: string): Promise<FilterPreset | null> {
    return this.presets.get(id) || null;
  }

  /**
   * List filter presets
   */
  async listPresets(
    options?: {
      category?: string;
      tags?: string[];
      userId?: string;
      isPublic?: boolean;
      limit?: number;
    }
  ): Promise<FilterPreset[]> {
    let presets = Array.from(this.presets.values());
    
    // Apply filters
    if (options?.category) {
      presets = presets.filter(p => p.category === options.category);
    }
    
    if (options?.tags && options.tags.length > 0) {
      presets = presets.filter(p => 
        p.tags?.some(tag => options.tags!.includes(tag))
      );
    }
    
    if (options?.userId) {
      presets = presets.filter(p => p.userId === options.userId);
    }
    
    if (options?.isPublic !== undefined) {
      presets = presets.filter(p => p.isPublic === options.isPublic);
    }
    
    // Sort by usage count
    presets.sort((a, b) => b.usageCount - a.usageCount);
    
    // Apply limit
    if (options?.limit) {
      presets = presets.slice(0, options.limit);
    }
    
    return presets;
  }

  /**
   * Apply filter preset
   */
  async applyPreset<T = any>(
    data: T[],
    presetId: string,
    overrides?: Partial<FilterQuery>
  ): Promise<FilterResult<T>> {
    const preset = await this.getPreset(presetId);
    
    if (!preset) {
      throw new Error(`Filter preset not found: ${presetId}`);
    }
    
    // Update usage count
    preset.usageCount++;
    preset.updatedAt = new Date();
    await this.savePreset(preset);
    
    // Build filter query
    const filterQuery: FilterQuery = {
      filter: overrides?.filter || preset.filter,
      sort: overrides?.sort || preset.sort,
      projection: overrides?.projection || preset.projection,
      pagination: overrides?.pagination,
      options: overrides?.options
    };
    
    return this.applyFilter(data, filterQuery);
  }

  /**
   * Validate filter
   */
  async validateFilter(
    filter: FilterGroup,
    options?: {
      schema?: any;
      maxDepth?: number;
      allowedFields?: string[];
      allowedOperators?: FilterOperator[];
    }
  ): Promise<FilterValidation> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: FilterSuggestion[] = [];
    
    // Check cache
    const cacheKey = JSON.stringify({ filter, options });
    const cached = this.validationCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Validate structure
    const validateGroup = (group: FilterGroup, depth: number = 0): void => {
      // Check depth
      const maxDepth = options?.maxDepth || this.maxFilterDepth;
      if (depth > maxDepth) {
        errors.push({
          field: '',
          operator: group.operator,
          message: `Filter depth exceeds maximum of ${maxDepth}`,
          code: 'MAX_DEPTH_EXCEEDED'
        });
        return;
      }
      
      // Validate conditions
      if (group.conditions) {
        for (const condition of group.conditions) {
          // Check allowed fields
          if (options?.allowedFields && !options.allowedFields.includes(condition.field)) {
            errors.push({
              field: condition.field,
              operator: condition.operator,
              message: `Field '${condition.field}' is not allowed`,
              code: 'FIELD_NOT_ALLOWED'
            });
          }
          
          // Check allowed operators
          if (options?.allowedOperators && !options.allowedOperators.includes(condition.operator)) {
            errors.push({
              field: condition.field,
              operator: condition.operator,
              message: `Operator '${condition.operator}' is not allowed`,
              code: 'OPERATOR_NOT_ALLOWED'
            });
          }
          
          // Validate data type
          if (condition.dataType) {
            const validator = this.dataTypeValidators.get(condition.dataType);
            if (validator && !validator(condition.value)) {
              errors.push({
                field: condition.field,
                operator: condition.operator,
                message: `Invalid value type for field '${condition.field}'`,
                code: 'INVALID_VALUE_TYPE'
              });
            }
          }
          
          // Check for performance issues
          if (condition.operator === 'regex') {
            warnings.push({
              field: condition.field,
              message: 'Regex operations can be slow on large datasets',
              impact: 'performance'
            });
          }
          
          if (condition.operator === 'contains' && !condition.field.includes('_indexed')) {
            warnings.push({
              field: condition.field,
              message: `Consider indexing field '${condition.field}' for better performance`,
              impact: 'performance'
            });
          }
        }
      }
      
      // Validate nested groups
      if (group.groups) {
        for (const nestedGroup of group.groups) {
          validateGroup(nestedGroup, depth + 1);
        }
      }
      
      // Check for empty groups
      if (!group.conditions?.length && !group.groups?.length) {
        warnings.push({
          field: '',
          message: 'Empty filter group detected',
          impact: 'accuracy'
        });
      }
    };
    
    validateGroup(filter);
    
    // Generate suggestions
    if (errors.length === 0) {
      // Suggest optimizations
      const complexity = this.calculateComplexity(filter);
      if (complexity > 10) {
        suggestions.push({
          type: 'optimization',
          message: 'Consider simplifying the filter for better performance',
          suggestion: filter // Would provide simplified version
        });
      }
    }
    
    const validation: FilterValidation = {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
    
    // Cache validation result
    this.validationCache.set(cacheKey, validation);
    
    return validation;
  }

  /**
   * Get filter statistics
   */
  getStatistics(): FilterStatistics {
    // Calculate popular fields
    const fieldCount = new Map<string, number>();
    
    for (const preset of this.presets.values()) {
      this.extractFields(preset.filter, fieldCount);
    }
    
    this.statistics.popularFields = Array.from(fieldCount.entries())
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return this.statistics;
  }

  /**
   * Optimize filter
   */
  optimizeFilter(filter: FilterGroup): FilterGroup {
    // Remove redundant conditions
    const optimized = this.removeRedundantConditions(filter);
    
    // Merge similar conditions
    const merged = this.mergeSimilarConditions(optimized);
    
    // Reorder for performance
    const reordered = this.reorderForPerformance(merged);
    
    return reordered;
  }

  // Private helper methods

  private initializeOperatorMappings(): void {
    this.operatorMappings.set('equals', '=');
    this.operatorMappings.set('notEquals', '!=');
    this.operatorMappings.set('greaterThan', '>');
    this.operatorMappings.set('greaterThanOrEqual', '>=');
    this.operatorMappings.set('lessThan', '<');
    this.operatorMappings.set('lessThanOrEqual', '<=');
    this.operatorMappings.set('contains', 'LIKE');
    this.operatorMappings.set('in', 'IN');
    this.operatorMappings.set('notIn', 'NOT IN');
    this.operatorMappings.set('between', 'BETWEEN');
    this.operatorMappings.set('isNull', 'IS NULL');
    this.operatorMappings.set('isNotNull', 'IS NOT NULL');
  }

  private initializeDataTypeValidators(): void {
    this.dataTypeValidators.set('string', (value) => typeof value === 'string');
    this.dataTypeValidators.set('number', (value) => typeof value === 'number');
    this.dataTypeValidators.set('boolean', (value) => typeof value === 'boolean');
    this.dataTypeValidators.set('date', (value) => value instanceof Date || !isNaN(Date.parse(value)));
    this.dataTypeValidators.set('array', (value) => Array.isArray(value));
    this.dataTypeValidators.set('object', (value) => typeof value === 'object' && !Array.isArray(value));
  }

  private filterData<T>(
    data: T[],
    filter: FilterGroup,
    options?: FilterOptions
  ): T[] {
    const evaluateCondition = (item: any, condition: FilterCondition): boolean => {
      const value = this.getNestedValue(item, condition.field);
      const conditionValue = condition.value;
      
      let result = false;
      
      switch (condition.operator) {
        case 'equals':
          result = value === conditionValue;
          break;
          
        case 'notEquals':
          result = value !== conditionValue;
          break;
          
        case 'contains':
          if (typeof value === 'string') {
            result = options?.caseInsensitive 
              ? value.toLowerCase().includes(String(conditionValue).toLowerCase())
              : value.includes(String(conditionValue));
          }
          break;
          
        case 'startsWith':
          if (typeof value === 'string') {
            result = options?.caseInsensitive
              ? value.toLowerCase().startsWith(String(conditionValue).toLowerCase())
              : value.startsWith(String(conditionValue));
          }
          break;
          
        case 'endsWith':
          if (typeof value === 'string') {
            result = options?.caseInsensitive
              ? value.toLowerCase().endsWith(String(conditionValue).toLowerCase())
              : value.endsWith(String(conditionValue));
          }
          break;
          
        case 'in':
          result = Array.isArray(conditionValue) && conditionValue.includes(value);
          break;
          
        case 'notIn':
          result = Array.isArray(conditionValue) && !conditionValue.includes(value);
          break;
          
        case 'between':
          if (Array.isArray(conditionValue) && conditionValue.length === 2) {
            const [min, max] = conditionValue;
            result = value >= min && value <= max;
          }
          break;
          
        case 'greaterThan':
          result = value > conditionValue;
          break;
          
        case 'greaterThanOrEqual':
          result = value >= conditionValue;
          break;
          
        case 'lessThan':
          result = value < conditionValue;
          break;
          
        case 'lessThanOrEqual':
          result = value <= conditionValue;
          break;
          
        case 'isNull':
          result = value === null || value === undefined;
          break;
          
        case 'isNotNull':
          result = value !== null && value !== undefined;
          break;
          
        case 'isEmpty':
          result = !value || (Array.isArray(value) && value.length === 0) || value === '';
          break;
          
        case 'isNotEmpty':
          result = !!value && (!Array.isArray(value) || value.length > 0) && value !== '';
          break;
          
        case 'regex':
          if (typeof value === 'string') {
            const regex = new RegExp(String(conditionValue));
            result = regex.test(value);
          }
          break;
          
        case 'exists':
          result = value !== undefined;
          break;
          
        case 'notExists':
          result = value === undefined;
          break;
          
        default:
          result = false;
      }
      
      return condition.negate ? !result : result;
    };
    
    const evaluateGroup = (item: any, group: FilterGroup): boolean => {
      const results: boolean[] = [];
      
      // Evaluate conditions
      if (group.conditions) {
        for (const condition of group.conditions) {
          results.push(evaluateCondition(item, condition));
        }
      }
      
      // Evaluate nested groups
      if (group.groups) {
        for (const nestedGroup of group.groups) {
          results.push(evaluateGroup(item, nestedGroup));
        }
      }
      
      if (results.length === 0) {
        return true;
      }
      
      if (group.operator === 'OR') {
        return results.some(r => r);
      } else if (group.operator === 'NOT') {
        return !results.every(r => r);
      } else {
        return results.every(r => r);
      }
    };
    
    return data.filter(item => evaluateGroup(item, filter));
  }

  private sortData<T>(data: T[], sortOptions: SortOptions[]): T[] {
    return data.sort((a, b) => {
      for (const sort of sortOptions) {
        const aValue = this.getNestedValue(a, sort.field);
        const bValue = this.getNestedValue(b, sort.field);
        
        // Handle null values
        if (aValue === null || aValue === undefined) {
          return sort.nullsFirst ? -1 : 1;
        }
        if (bValue === null || bValue === undefined) {
          return sort.nullsFirst ? 1 : -1;
        }
        
        // Handle custom order
        if (sort.customOrder) {
          const aIndex = sort.customOrder.indexOf(aValue);
          const bIndex = sort.customOrder.indexOf(bValue);
          
          if (aIndex !== -1 && bIndex !== -1) {
            const diff = aIndex - bIndex;
            if (diff !== 0) {
              return sort.order === 'asc' ? diff : -diff;
            }
          }
        }
        
        // Compare values
        let comparison = 0;
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
        
        if (comparison !== 0) {
          return sort.order === 'asc' ? comparison : -comparison;
        }
      }
      
      return 0;
    });
  }

  private projectData<T>(data: T[], projection: ProjectionOptions): T[] {
    return data.map(item => {
      const projected: any = {};
      
      // Handle includes
      if (projection.include) {
        for (const field of projection.include) {
          const value = this.getNestedValue(item, field);
          this.setNestedValue(projected, field, value);
        }
      } else {
        // Include all fields by default
        Object.assign(projected, item);
      }
      
      // Handle excludes
      if (projection.exclude) {
        for (const field of projection.exclude) {
          this.deleteNestedValue(projected, field);
        }
      }
      
      // Handle renames
      if (projection.rename) {
        for (const [oldField, newField] of Object.entries(projection.rename)) {
          const value = this.getNestedValue(projected, oldField);
          this.deleteNestedValue(projected, oldField);
          this.setNestedValue(projected, newField, value);
        }
      }
      
      // Handle computed fields
      if (projection.compute) {
        for (const computed of projection.compute) {
          // Simple expression evaluation (would need proper expression parser)
          const value = this.evaluateExpression(item, computed.expression);
          this.setNestedValue(projected, computed.name, value);
        }
      }
      
      return projected as T;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  private deleteNestedValue(obj: any, path: string): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        return;
      }
      current = current[part];
    }
    
    delete current[parts[parts.length - 1]];
  }

  private evaluateExpression(context: any, expression: string): any {
    // Simple expression evaluation
    // In production, use a proper expression parser
    try {
      const func = new Function('context', `return ${expression}`);
      return func(context);
    } catch (error) {
      return null;
    }
  }

  private countFilters(filter: FilterGroup): number {
    let count = 0;
    
    if (filter.conditions) {
      count += filter.conditions.length;
    }
    
    if (filter.groups) {
      for (const group of filter.groups) {
        count += this.countFilters(group);
      }
    }
    
    return count;
  }

  private calculateComplexity(filter: FilterGroup, depth: number = 0): number {
    let complexity = depth;
    
    if (filter.conditions) {
      complexity += filter.conditions.length;
      
      // Add extra complexity for expensive operators
      for (const condition of filter.conditions) {
        if (['regex', 'contains', 'notContains'].includes(condition.operator)) {
          complexity += 2;
        }
      }
    }
    
    if (filter.groups) {
      for (const group of filter.groups) {
        complexity += this.calculateComplexity(group, depth + 1);
      }
    }
    
    return complexity;
  }

  private extractFields(filter: FilterGroup, fieldCount: Map<string, number>): void {
    if (filter.conditions) {
      for (const condition of filter.conditions) {
        const count = fieldCount.get(condition.field) || 0;
        fieldCount.set(condition.field, count + 1);
      }
    }
    
    if (filter.groups) {
      for (const group of filter.groups) {
        this.extractFields(group, fieldCount);
      }
    }
  }

  private removeRedundantConditions(filter: FilterGroup): FilterGroup {
    // Remove duplicate conditions
    const seen = new Set<string>();
    const uniqueConditions: FilterCondition[] = [];
    
    if (filter.conditions) {
      for (const condition of filter.conditions) {
        const key = `${condition.field}:${condition.operator}:${JSON.stringify(condition.value)}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueConditions.push(condition);
        }
      }
    }
    
    return {
      ...filter,
      conditions: uniqueConditions,
      groups: filter.groups?.map(g => this.removeRedundantConditions(g))
    };
  }

  private mergeSimilarConditions(filter: FilterGroup): FilterGroup {
    // Merge conditions on the same field
    const merged: FilterCondition[] = [];
    const fieldGroups = new Map<string, FilterCondition[]>();
    
    if (filter.conditions) {
      for (const condition of filter.conditions) {
        const existing = fieldGroups.get(condition.field) || [];
        existing.push(condition);
        fieldGroups.set(condition.field, existing);
      }
      
      for (const [field, conditions] of fieldGroups) {
        if (conditions.length === 1) {
          merged.push(conditions[0]);
        } else {
          // Try to merge conditions
          // For example, multiple equals can become in
          const equalsConditions = conditions.filter(c => c.operator === 'equals');
          if (equalsConditions.length > 1) {
            merged.push({
              field,
              operator: 'in',
              value: equalsConditions.map(c => c.value),
              dataType: equalsConditions[0].dataType
            });
          } else {
            merged.push(...conditions);
          }
        }
      }
    }
    
    return {
      ...filter,
      conditions: merged,
      groups: filter.groups?.map(g => this.mergeSimilarConditions(g))
    };
  }

  private reorderForPerformance(filter: FilterGroup): FilterGroup {
    // Reorder conditions to put most selective first
    const reordered: FilterCondition[] = [];
    
    if (filter.conditions) {
      // Sort by estimated selectivity
      const sorted = [...filter.conditions].sort((a, b) => {
        const selectivityA = this.estimateSelectivity(a);
        const selectivityB = this.estimateSelectivity(b);
        return selectivityA - selectivityB;
      });
      
      reordered.push(...sorted);
    }
    
    return {
      ...filter,
      conditions: reordered,
      groups: filter.groups?.map(g => this.reorderForPerformance(g))
    };
  }

  private estimateSelectivity(condition: FilterCondition): number {
    // Estimate how selective a condition is (lower is more selective)
    const selectivityScores: Record<FilterOperator, number> = {
      equals: 1,
      notEquals: 9,
      in: 2,
      notIn: 8,
      between: 3,
      notBetween: 7,
      greaterThan: 5,
      greaterThanOrEqual: 5,
      lessThan: 5,
      lessThanOrEqual: 5,
      contains: 6,
      notContains: 4,
      startsWith: 4,
      endsWith: 4,
      regex: 7,
      notRegex: 3,
      exists: 8,
      notExists: 2,
      isNull: 2,
      isNotNull: 8,
      isEmpty: 3,
      isNotEmpty: 7,
      isTrue: 5,
      isFalse: 5,
      before: 5,
      after: 5,
      dateRange: 3,
      notDateRange: 7,
      inRadius: 4,
      notInRadius: 6,
      intersects: 5,
      notIntersects: 5
    };
    
    return selectivityScores[condition.operator] || 5;
  }

  private getCacheKey(query: FilterQuery): string {
    return `filter:${JSON.stringify(query)}`;
  }

  private getFromCache(key: string): any {
    const cached = this.filterCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    return null;
  }

  private cacheResult(key: string, result: any): void {
    this.filterCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      
      // Clean filter cache
      for (const [key, cached] of this.filterCache.entries()) {
        if (now - cached.timestamp > this.cacheTimeout) {
          this.filterCache.delete(key);
        }
      }
      
      // Clean validation cache
      if (this.validationCache.size > 1000) {
        this.validationCache.clear();
      }
    }, 60000); // Every minute
  }

  private updateStatistics(query: FilterQuery, executionTime: number): void {
    this.statistics.totalFilters++;
    
    // Update average execution time
    const totalTime = this.statistics.performanceMetrics.averageExecutionTime * (this.statistics.totalFilters - 1);
    this.statistics.performanceMetrics.averageExecutionTime = (totalTime + executionTime) / this.statistics.totalFilters;
    
    // Track slowest filters
    const filterString = JSON.stringify(query.filter);
    const slowest = this.statistics.performanceMetrics.slowestFilters;
    
    if (slowest.length < 10 || executionTime > slowest[slowest.length - 1].time) {
      slowest.push({ filter: filterString, time: executionTime });
      slowest.sort((a, b) => b.time - a.time);
      this.statistics.performanceMetrics.slowestFilters = slowest.slice(0, 10);
    }
    
    // Track fastest filters
    const fastest = this.statistics.performanceMetrics.fastestFilters;
    
    if (fastest.length < 10 || executionTime < fastest[fastest.length - 1].time) {
      fastest.push({ filter: filterString, time: executionTime });
      fastest.sort((a, b) => a.time - b.time);
      this.statistics.performanceMetrics.fastestFilters = fastest.slice(0, 10);
    }
    
    // Update complexity
    const complexity = this.calculateComplexity(query.filter);
    const totalComplexity = this.statistics.averageComplexity * (this.statistics.totalFilters - 1);
    this.statistics.averageComplexity = (totalComplexity + complexity) / this.statistics.totalFilters;
  }

  private async loadPresets(): Promise<void> {
    try {
      const data = await redisClient.hgetall('filter_presets');
      
      for (const [id, presetData] of Object.entries(data)) {
        const preset = JSON.parse(presetData);
        this.presets.set(id, preset);
      }
      
      logger.info('Filter presets loaded', { count: this.presets.size });
      
    } catch (error) {
      logger.error('Failed to load filter presets', { error });
    }
  }

  private async savePreset(preset: FilterPreset): Promise<void> {
    await redisClient.hset(
      'filter_presets',
      preset.id,
      JSON.stringify(preset)
    );
  }

  private generatePresetId(): string {
    return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const filteringService = new FilteringService();
export default filteringService;