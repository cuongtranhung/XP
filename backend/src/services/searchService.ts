/**
 * Search Service
 * Full-text search and advanced filtering with PostgreSQL
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';

export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  pagination?: {
    page: number;
    limit: number;
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  options?: SearchOptions;
}

export interface SearchFilters {
  type?: string | string[];
  category?: string | string[];
  status?: string | string[];
  dateRange?: {
    from?: Date;
    to?: Date;
    field?: string;
  };
  numeric?: {
    field: string;
    min?: number;
    max?: number;
    operator?: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between';
  }[];
  text?: {
    field: string;
    value: string;
    operator?: 'contains' | 'startsWith' | 'endsWith' | 'exact' | 'regex';
  }[];
  tags?: string[];
  location?: {
    lat: number;
    lng: number;
    radius: number; // in meters
  };
  custom?: Record<string, any>;
}

export interface SearchOptions {
  fuzzy?: boolean;
  typoTolerance?: number; // 0-2
  synonyms?: boolean;
  stemming?: boolean;
  highlighting?: boolean;
  facets?: string[];
  aggregations?: AggregationOptions[];
  boost?: BoostOptions[];
  explain?: boolean;
  timeout?: number;
}

export interface AggregationOptions {
  field: string;
  type: 'terms' | 'range' | 'date_histogram' | 'stats' | 'cardinality';
  options?: {
    size?: number;
    interval?: string;
    ranges?: Array<{ from?: number; to?: number; label?: string }>;
  };
}

export interface BoostOptions {
  field: string;
  value?: string;
  boost: number;
  type?: 'term' | 'phrase' | 'prefix' | 'fuzzy';
}

export interface SearchResult<T = any> {
  hits: SearchHit<T>[];
  total: number;
  page: number;
  limit: number;
  took: number; // milliseconds
  facets?: Record<string, FacetResult>;
  aggregations?: Record<string, any>;
  suggestions?: SearchSuggestion[];
  highlights?: Record<string, string[]>;
}

export interface SearchHit<T = any> {
  id: string;
  score: number;
  source: T;
  highlights?: Record<string, string[]>;
  explanation?: any;
}

export interface FacetResult {
  field: string;
  values: Array<{
    value: string;
    count: number;
    selected?: boolean;
  }>;
}

export interface SearchSuggestion {
  text: string;
  score: number;
  type: 'term' | 'phrase' | 'completion';
  payload?: any;
}

export interface SearchIndex {
  name: string;
  table: string;
  fields: IndexField[];
  settings: IndexSettings;
  mappings: IndexMappings;
  status: 'active' | 'building' | 'error';
  documentsCount: number;
  sizeInBytes: number;
  lastUpdated: Date;
}

export interface IndexField {
  name: string;
  type: 'text' | 'keyword' | 'numeric' | 'date' | 'boolean' | 'geo_point' | 'json';
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  facetable?: boolean;
  boost?: number;
  analyzer?: string;
  normalizer?: string;
}

export interface IndexSettings {
  numberOfShards?: number;
  numberOfReplicas?: number;
  refreshInterval?: string;
  maxResultWindow?: number;
  analysis?: {
    analyzers?: Record<string, any>;
    tokenizers?: Record<string, any>;
    filters?: Record<string, any>;
    normalizers?: Record<string, any>;
  };
}

export interface IndexMappings {
  properties: Record<string, any>;
  dynamic?: boolean | 'strict';
  dynamicTemplates?: any[];
}

export interface SearchMetrics {
  totalSearches: number;
  averageResponseTime: number;
  searchesPerSecond: number;
  cacheHitRate: number;
  slowQueries: number;
  failedQueries: number;
  popularQueries: Array<{
    query: string;
    count: number;
    averageTime: number;
  }>;
  indexStats: Record<string, {
    documentsCount: number;
    sizeInBytes: number;
    searchCount: number;
    indexingRate: number;
  }>;
}

/**
 * Search Service Class
 */
class SearchService extends EventEmitter {
  private pool: Pool;
  private indices = new Map<string, SearchIndex>();
  private searchCache = new Map<string, { result: any; timestamp: number }>();
  private queryHistory: Array<{ query: string; timestamp: Date; took: number }> = [];
  
  private metrics: SearchMetrics = {
    totalSearches: 0,
    averageResponseTime: 0,
    searchesPerSecond: 0,
    cacheHitRate: 0,
    slowQueries: 0,
    failedQueries: 0,
    popularQueries: [],
    indexStats: {}
  };
  
  private readonly cacheTimeout = 300000; // 5 minutes
  private readonly slowQueryThreshold = 1000; // 1 second
  private readonly maxQueryHistory = 1000;

  constructor(pool: Pool) {
    super();
    this.pool = pool;
    this.initializeService();
  }

  /**
   * Initialize search service
   */
  private async initializeService(): Promise<void> {
    try {
      // Create search extensions if not exists
      await this.createSearchExtensions();
      
      // Load existing indices
      await this.loadIndices();
      
      // Start metrics collection
      this.startMetricsCollection();
      
      // Setup cache cleanup
      this.setupCacheCleanup();
      
      logger.info('✅ Search service initialized', {
        indices: this.indices.size
      });
      
    } catch (error) {
      logger.error('❌ Failed to initialize search service', { error });
      throw error;
    }
  }

  /**
   * Perform search
   */
  async search<T = any>(
    indexName: string,
    searchQuery: SearchQuery
  ): Promise<SearchResult<T>> {
    const startTime = Date.now();
    
    try {
      // Check cache
      const cacheKey = this.getCacheKey(indexName, searchQuery);
      const cached = this.getFromCache(cacheKey);
      
      if (cached) {
        this.metrics.cacheHitRate++;
        return cached;
      }
      
      // Validate index
      const index = this.indices.get(indexName);
      if (!index) {
        throw new Error(`Index not found: ${indexName}`);
      }
      
      // Build PostgreSQL query
      const sqlQuery = this.buildSearchQuery(index, searchQuery);
      
      // Execute search
      const result = await this.pool.query(sqlQuery.text, sqlQuery.values);
      
      // Process results
      const searchResult = this.processSearchResults<T>(
        result.rows,
        searchQuery,
        startTime
      );
      
      // Get facets if requested
      if (searchQuery.options?.facets) {
        searchResult.facets = await this.getFacets(
          index,
          searchQuery.options.facets,
          searchQuery.filters
        );
      }
      
      // Get aggregations if requested
      if (searchQuery.options?.aggregations) {
        searchResult.aggregations = await this.getAggregations(
          index,
          searchQuery.options.aggregations,
          searchQuery.filters
        );
      }
      
      // Get suggestions if search returned few results
      if (searchResult.total < 5 && searchQuery.query) {
        searchResult.suggestions = await this.getSuggestions(
          indexName,
          searchQuery.query
        );
      }
      
      // Cache result
      this.cacheResult(cacheKey, searchResult);
      
      // Update metrics
      this.updateMetrics(searchQuery.query, Date.now() - startTime);
      
      // Emit search event
      this.emit('search', {
        index: indexName,
        query: searchQuery.query,
        total: searchResult.total,
        took: searchResult.took
      });
      
      return searchResult;
      
    } catch (error) {
      this.metrics.failedQueries++;
      logger.error('Search failed', { error, indexName, query: searchQuery });
      throw error;
    }
  }

  /**
   * Create or update search index
   */
  async createIndex(
    name: string,
    config: {
      table: string;
      fields: IndexField[];
      settings?: IndexSettings;
      mappings?: IndexMappings;
    }
  ): Promise<SearchIndex> {
    try {
      // Create GIN index for full-text search
      const textFields = config.fields.filter(f => f.type === 'text' && f.searchable);
      
      for (const field of textFields) {
        const indexName = `idx_${config.table}_${field.name}_fts`;
        const analyzer = field.analyzer || 'english';
        
        await this.pool.query(`
          CREATE INDEX IF NOT EXISTS ${indexName}
          ON ${config.table}
          USING gin(to_tsvector('${analyzer}', ${field.name}))
        `);
      }
      
      // Create B-tree indices for filtering and sorting
      const filterFields = config.fields.filter(f => f.filterable || f.sortable);
      
      for (const field of filterFields) {
        const indexName = `idx_${config.table}_${field.name}`;
        
        await this.pool.query(`
          CREATE INDEX IF NOT EXISTS ${indexName}
          ON ${config.table}(${field.name})
        `);
      }
      
      // Create composite indices for common filter combinations
      if (config.settings?.analysis?.analyzers) {
        await this.createCompositeIndices(config.table, config.fields);
      }
      
      // Get document count
      const countResult = await this.pool.query(`
        SELECT COUNT(*) as count FROM ${config.table}
      `);
      
      const index: SearchIndex = {
        name,
        table: config.table,
        fields: config.fields,
        settings: config.settings || {},
        mappings: config.mappings || { properties: {} },
        status: 'active',
        documentsCount: parseInt(countResult.rows[0].count),
        sizeInBytes: 0, // Would need to calculate actual size
        lastUpdated: new Date()
      };
      
      // Store index
      this.indices.set(name, index);
      await this.saveIndex(index);
      
      logger.info('Search index created', { name, table: config.table });
      
      return index;
      
    } catch (error) {
      logger.error('Failed to create index', { error, name });
      throw error;
    }
  }

  /**
   * Update document in index
   */
  async indexDocument(
    indexName: string,
    documentId: string,
    document: any
  ): Promise<void> {
    try {
      const index = this.indices.get(indexName);
      if (!index) {
        throw new Error(`Index not found: ${indexName}`);
      }
      
      // Build update query
      const fields = index.fields.filter(f => f.searchable);
      const values: any[] = [documentId];
      const setClause: string[] = [];
      
      for (const field of fields) {
        if (document[field.name] !== undefined) {
          values.push(document[field.name]);
          setClause.push(`${field.name} = $${values.length}`);
        }
      }
      
      if (setClause.length > 0) {
        await this.pool.query(`
          UPDATE ${index.table}
          SET ${setClause.join(', ')}, updated_at = NOW()
          WHERE id = $1
        `, values);
        
        // Clear cache for this index
        this.clearIndexCache(indexName);
        
        logger.debug('Document indexed', { indexName, documentId });
      }
      
    } catch (error) {
      logger.error('Failed to index document', { error, indexName, documentId });
      throw error;
    }
  }

  /**
   * Delete document from index
   */
  async deleteDocument(
    indexName: string,
    documentId: string
  ): Promise<void> {
    try {
      const index = this.indices.get(indexName);
      if (!index) {
        throw new Error(`Index not found: ${indexName}`);
      }
      
      await this.pool.query(`
        DELETE FROM ${index.table}
        WHERE id = $1
      `, [documentId]);
      
      // Clear cache
      this.clearIndexCache(indexName);
      
      logger.debug('Document deleted from index', { indexName, documentId });
      
    } catch (error) {
      logger.error('Failed to delete document', { error, indexName, documentId });
      throw error;
    }
  }

  /**
   * Bulk index documents
   */
  async bulkIndex(
    indexName: string,
    documents: Array<{ id: string; data: any }>
  ): Promise<{ indexed: number; failed: number }> {
    try {
      const index = this.indices.get(indexName);
      if (!index) {
        throw new Error(`Index not found: ${indexName}`);
      }
      
      let indexed = 0;
      let failed = 0;
      
      // Process in batches
      const batchSize = 100;
      
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        try {
          await this.pool.query('BEGIN');
          
          for (const doc of batch) {
            await this.indexDocument(indexName, doc.id, doc.data);
            indexed++;
          }
          
          await this.pool.query('COMMIT');
          
        } catch (error) {
          await this.pool.query('ROLLBACK');
          failed += batch.length;
          logger.error('Batch indexing failed', { error, batchIndex: i / batchSize });
        }
      }
      
      // Clear cache
      this.clearIndexCache(indexName);
      
      logger.info('Bulk indexing completed', { indexName, indexed, failed });
      
      return { indexed, failed };
      
    } catch (error) {
      logger.error('Bulk indexing failed', { error, indexName });
      throw error;
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(
    indexName: string,
    query: string,
    options?: {
      limit?: number;
      fuzzy?: boolean;
      fields?: string[];
    }
  ): Promise<SearchSuggestion[]> {
    try {
      const index = this.indices.get(indexName);
      if (!index) {
        throw new Error(`Index not found: ${indexName}`);
      }
      
      const limit = options?.limit || 5;
      const suggestions: SearchSuggestion[] = [];
      
      // Get term suggestions using trigram similarity
      const termSuggestions = await this.pool.query(`
        SELECT DISTINCT
          ${options?.fields?.join(', ') || '*'} as suggestion,
          similarity(${options?.fields?.[0] || 'name'}, $1) as score
        FROM ${index.table}
        WHERE similarity(${options?.fields?.[0] || 'name'}, $1) > 0.3
        ORDER BY score DESC
        LIMIT $2
      `, [query, limit]);
      
      for (const row of termSuggestions.rows) {
        suggestions.push({
          text: row.suggestion,
          score: row.score,
          type: 'term'
        });
      }
      
      // Get phrase suggestions
      const phraseSuggestions = await this.pool.query(`
        SELECT DISTINCT
          ${options?.fields?.[0] || 'name'} as suggestion,
          ts_rank(
            to_tsvector('english', ${options?.fields?.[0] || 'name'}),
            plainto_tsquery('english', $1)
          ) as score
        FROM ${index.table}
        WHERE to_tsvector('english', ${options?.fields?.[0] || 'name'}) @@ plainto_tsquery('english', $1)
        ORDER BY score DESC
        LIMIT $2
      `, [query, limit]);
      
      for (const row of phraseSuggestions.rows) {
        if (!suggestions.find(s => s.text === row.suggestion)) {
          suggestions.push({
            text: row.suggestion,
            score: row.score,
            type: 'phrase'
          });
        }
      }
      
      // Sort by score and limit
      suggestions.sort((a, b) => b.score - a.score);
      
      return suggestions.slice(0, limit);
      
    } catch (error) {
      logger.error('Failed to get suggestions', { error, indexName, query });
      return [];
    }
  }

  /**
   * Get autocomplete suggestions
   */
  async autocomplete(
    indexName: string,
    prefix: string,
    options?: {
      field?: string;
      limit?: number;
      filters?: SearchFilters;
    }
  ): Promise<string[]> {
    try {
      const index = this.indices.get(indexName);
      if (!index) {
        throw new Error(`Index not found: ${indexName}`);
      }
      
      const field = options?.field || 'name';
      const limit = options?.limit || 10;
      
      // Build filter clause
      const { whereClause, values } = this.buildFilterClause(options?.filters || {}, 2);
      
      const result = await this.pool.query(`
        SELECT DISTINCT ${field}
        FROM ${index.table}
        WHERE ${field} ILIKE $1
        ${whereClause ? `AND ${whereClause}` : ''}
        ORDER BY ${field}
        LIMIT ${limit}
      `, [prefix + '%', ...values]);
      
      return result.rows.map(row => row[field]);
      
    } catch (error) {
      logger.error('Autocomplete failed', { error, indexName, prefix });
      return [];
    }
  }

  /**
   * Reindex all documents
   */
  async reindex(indexName: string): Promise<void> {
    try {
      const index = this.indices.get(indexName);
      if (!index) {
        throw new Error(`Index not found: ${indexName}`);
      }
      
      // Update index status
      index.status = 'building';
      index.lastUpdated = new Date();
      
      // Rebuild all indices
      await this.createIndex(indexName, {
        table: index.table,
        fields: index.fields,
        settings: index.settings,
        mappings: index.mappings
      });
      
      // Update document count
      const countResult = await this.pool.query(`
        SELECT COUNT(*) as count FROM ${index.table}
      `);
      
      index.documentsCount = parseInt(countResult.rows[0].count);
      index.status = 'active';
      
      // Clear cache
      this.clearIndexCache(indexName);
      
      logger.info('Index rebuilt', { indexName, documents: index.documentsCount });
      
    } catch (error) {
      const index = this.indices.get(indexName);
      if (index) {
        index.status = 'error';
      }
      
      logger.error('Reindex failed', { error, indexName });
      throw error;
    }
  }

  /**
   * Get search metrics
   */
  getMetrics(): SearchMetrics {
    // Calculate searches per second
    const recentSearches = this.queryHistory.filter(
      q => Date.now() - q.timestamp.getTime() < 1000
    );
    
    this.metrics.searchesPerSecond = recentSearches.length;
    
    // Calculate popular queries
    const queryCount = new Map<string, { count: number; totalTime: number }>();
    
    for (const query of this.queryHistory) {
      const key = query.query;
      const existing = queryCount.get(key) || { count: 0, totalTime: 0 };
      existing.count++;
      existing.totalTime += query.took;
      queryCount.set(key, existing);
    }
    
    this.metrics.popularQueries = Array.from(queryCount.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        averageTime: stats.totalTime / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Update index stats
    for (const [name, index] of this.indices) {
      this.metrics.indexStats[name] = {
        documentsCount: index.documentsCount,
        sizeInBytes: index.sizeInBytes,
        searchCount: this.queryHistory.filter(q => q.query.includes(name)).length,
        indexingRate: 0 // Would need to track this separately
      };
    }
    
    return this.metrics;
  }

  // Private helper methods

  private async createSearchExtensions(): Promise<void> {
    try {
      // Enable required extensions
      await this.pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await this.pool.query('CREATE EXTENSION IF NOT EXISTS unaccent');
      await this.pool.query('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch');
      
      logger.debug('Search extensions created');
      
    } catch (error) {
      logger.error('Failed to create search extensions', { error });
    }
  }

  private buildSearchQuery(
    index: SearchIndex,
    searchQuery: SearchQuery
  ): { text: string; values: any[] } {
    const values: any[] = [];
    const whereClauses: string[] = [];
    
    // Add full-text search
    if (searchQuery.query) {
      values.push(searchQuery.query);
      
      const searchFields = index.fields
        .filter(f => f.type === 'text' && f.searchable)
        .map(f => `to_tsvector('english', ${f.name})`)
        .join(' || ');
      
      if (searchFields) {
        whereClauses.push(
          `(${searchFields}) @@ plainto_tsquery('english', $${values.length})`
        );
      }
    }
    
    // Add filters
    if (searchQuery.filters) {
      const { whereClause, values: filterValues } = this.buildFilterClause(
        searchQuery.filters,
        values.length + 1
      );
      
      if (whereClause) {
        whereClauses.push(whereClause);
        values.push(...filterValues);
      }
    }
    
    // Build final query
    const pagination = searchQuery.pagination || { page: 1, limit: 20 };
    const offset = (pagination.page - 1) * pagination.limit;
    
    let orderBy = '';
    if (searchQuery.sort) {
      orderBy = `ORDER BY ${searchQuery.sort.field} ${searchQuery.sort.order.toUpperCase()}`;
    } else if (searchQuery.query) {
      // Order by relevance
      orderBy = 'ORDER BY score DESC';
    }
    
    const text = `
      SELECT 
        *,
        ${searchQuery.query ? `ts_rank(to_tsvector('english', name), plainto_tsquery('english', $1)) as score` : '1 as score'}
      FROM ${index.table}
      ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
      ${orderBy}
      LIMIT ${pagination.limit}
      OFFSET ${offset}
    `;
    
    return { text, values };
  }

  private buildFilterClause(
    filters: SearchFilters,
    startIndex: number
  ): { whereClause: string; values: any[] } {
    const clauses: string[] = [];
    const values: any[] = [];
    let currentIndex = startIndex;
    
    // Type filter
    if (filters.type) {
      if (Array.isArray(filters.type)) {
        values.push(filters.type);
        clauses.push(`type = ANY($${currentIndex++})`);
      } else {
        values.push(filters.type);
        clauses.push(`type = $${currentIndex++}`);
      }
    }
    
    // Date range filter
    if (filters.dateRange) {
      const field = filters.dateRange.field || 'created_at';
      
      if (filters.dateRange.from) {
        values.push(filters.dateRange.from);
        clauses.push(`${field} >= $${currentIndex++}`);
      }
      
      if (filters.dateRange.to) {
        values.push(filters.dateRange.to);
        clauses.push(`${field} <= $${currentIndex++}`);
      }
    }
    
    // Numeric filters
    if (filters.numeric) {
      for (const numFilter of filters.numeric) {
        switch (numFilter.operator) {
          case 'between':
            if (numFilter.min !== undefined && numFilter.max !== undefined) {
              values.push(numFilter.min, numFilter.max);
              clauses.push(`${numFilter.field} BETWEEN $${currentIndex++} AND $${currentIndex++}`);
            }
            break;
          case 'gt':
            values.push(numFilter.min);
            clauses.push(`${numFilter.field} > $${currentIndex++}`);
            break;
          case 'gte':
            values.push(numFilter.min);
            clauses.push(`${numFilter.field} >= $${currentIndex++}`);
            break;
          case 'lt':
            values.push(numFilter.max);
            clauses.push(`${numFilter.field} < $${currentIndex++}`);
            break;
          case 'lte':
            values.push(numFilter.max);
            clauses.push(`${numFilter.field} <= $${currentIndex++}`);
            break;
          case 'eq':
          default:
            values.push(numFilter.min || numFilter.max);
            clauses.push(`${numFilter.field} = $${currentIndex++}`);
        }
      }
    }
    
    // Text filters
    if (filters.text) {
      for (const textFilter of filters.text) {
        switch (textFilter.operator) {
          case 'contains':
            values.push(`%${textFilter.value}%`);
            clauses.push(`${textFilter.field} ILIKE $${currentIndex++}`);
            break;
          case 'startsWith':
            values.push(`${textFilter.value}%`);
            clauses.push(`${textFilter.field} ILIKE $${currentIndex++}`);
            break;
          case 'endsWith':
            values.push(`%${textFilter.value}`);
            clauses.push(`${textFilter.field} ILIKE $${currentIndex++}`);
            break;
          case 'exact':
            values.push(textFilter.value);
            clauses.push(`${textFilter.field} = $${currentIndex++}`);
            break;
          case 'regex':
            values.push(textFilter.value);
            clauses.push(`${textFilter.field} ~ $${currentIndex++}`);
            break;
        }
      }
    }
    
    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      values.push(filters.tags);
      clauses.push(`tags && $${currentIndex++}`);
    }
    
    // Location filter
    if (filters.location) {
      values.push(filters.location.lat, filters.location.lng, filters.location.radius);
      clauses.push(`
        ST_DWithin(
          location::geography,
          ST_MakePoint($${currentIndex++}, $${currentIndex++})::geography,
          $${currentIndex++}
        )
      `);
    }
    
    return {
      whereClause: clauses.join(' AND '),
      values
    };
  }

  private processSearchResults<T>(
    rows: any[],
    searchQuery: SearchQuery,
    startTime: number
  ): SearchResult<T> {
    const pagination = searchQuery.pagination || { page: 1, limit: 20 };
    
    const hits: SearchHit<T>[] = rows.map(row => {
      const hit: SearchHit<T> = {
        id: row.id,
        score: row.score || 1,
        source: row as T
      };
      
      // Add highlights if requested
      if (searchQuery.options?.highlighting && searchQuery.query) {
        hit.highlights = this.generateHighlights(row, searchQuery.query);
      }
      
      return hit;
    });
    
    return {
      hits,
      total: rows.length, // Would need separate count query for accurate total
      page: pagination.page,
      limit: pagination.limit,
      took: Date.now() - startTime
    };
  }

  private generateHighlights(
    document: any,
    query: string
  ): Record<string, string[]> {
    const highlights: Record<string, string[]> = {};
    const terms = query.toLowerCase().split(/\s+/);
    
    for (const [field, value] of Object.entries(document)) {
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        const matches: string[] = [];
        
        for (const term of terms) {
          const index = lowerValue.indexOf(term);
          if (index !== -1) {
            const start = Math.max(0, index - 50);
            const end = Math.min(value.length, index + term.length + 50);
            const highlight = value.substring(start, end);
            matches.push(highlight);
          }
        }
        
        if (matches.length > 0) {
          highlights[field] = matches;
        }
      }
    }
    
    return highlights;
  }

  private async getFacets(
    index: SearchIndex,
    facetFields: string[],
    filters?: SearchFilters
  ): Promise<Record<string, FacetResult>> {
    const facets: Record<string, FacetResult> = {};
    
    for (const field of facetFields) {
      const indexField = index.fields.find(f => f.name === field);
      if (!indexField?.facetable) continue;
      
      // Build filter clause without the current facet field
      const facetFilters = { ...filters };
      delete (facetFilters as any)[field];
      
      const { whereClause, values } = this.buildFilterClause(facetFilters, 1);
      
      const result = await this.pool.query(`
        SELECT ${field} as value, COUNT(*) as count
        FROM ${index.table}
        ${whereClause ? `WHERE ${whereClause}` : ''}
        GROUP BY ${field}
        ORDER BY count DESC
        LIMIT 20
      `, values);
      
      facets[field] = {
        field,
        values: result.rows.map(row => ({
          value: row.value,
          count: parseInt(row.count),
          selected: filters?.[field as keyof SearchFilters] === row.value
        }))
      };
    }
    
    return facets;
  }

  private async getAggregations(
    index: SearchIndex,
    aggregations: AggregationOptions[],
    filters?: SearchFilters
  ): Promise<Record<string, any>> {
    const results: Record<string, any> = {};
    const { whereClause, values } = this.buildFilterClause(filters || {}, 1);
    
    for (const agg of aggregations) {
      switch (agg.type) {
        case 'terms':
          const termsResult = await this.pool.query(`
            SELECT ${agg.field} as value, COUNT(*) as count
            FROM ${index.table}
            ${whereClause ? `WHERE ${whereClause}` : ''}
            GROUP BY ${agg.field}
            ORDER BY count DESC
            LIMIT ${agg.options?.size || 10}
          `, values);
          
          results[agg.field] = {
            buckets: termsResult.rows.map(row => ({
              key: row.value,
              doc_count: parseInt(row.count)
            }))
          };
          break;
          
        case 'stats':
          const statsResult = await this.pool.query(`
            SELECT 
              COUNT(*) as count,
              MIN(${agg.field}) as min,
              MAX(${agg.field}) as max,
              AVG(${agg.field}) as avg,
              SUM(${agg.field}) as sum
            FROM ${index.table}
            ${whereClause ? `WHERE ${whereClause}` : ''}
          `, values);
          
          results[agg.field] = statsResult.rows[0];
          break;
          
        case 'date_histogram':
          const interval = agg.options?.interval || 'day';
          const dateResult = await this.pool.query(`
            SELECT 
              DATE_TRUNC('${interval}', ${agg.field}) as date,
              COUNT(*) as count
            FROM ${index.table}
            ${whereClause ? `WHERE ${whereClause}` : ''}
            GROUP BY date
            ORDER BY date
          `, values);
          
          results[agg.field] = {
            buckets: dateResult.rows.map(row => ({
              key_as_string: row.date,
              key: new Date(row.date).getTime(),
              doc_count: parseInt(row.count)
            }))
          };
          break;
      }
    }
    
    return results;
  }

  private async createCompositeIndices(
    table: string,
    fields: IndexField[]
  ): Promise<void> {
    // Create composite indices for common filter combinations
    const filterableFields = fields.filter(f => f.filterable);
    
    if (filterableFields.length >= 2) {
      // Create index for first two filterable fields
      const field1 = filterableFields[0].name;
      const field2 = filterableFields[1].name;
      
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_${table}_${field1}_${field2}
        ON ${table}(${field1}, ${field2})
      `);
    }
    
    // Create index for commonly queried fields
    const commonFields = ['status', 'type', 'created_at'];
    const existingCommonFields = commonFields.filter(
      cf => fields.some(f => f.name === cf)
    );
    
    if (existingCommonFields.length >= 2) {
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_${table}_common
        ON ${table}(${existingCommonFields.join(', ')})
      `);
    }
  }

  private async loadIndices(): Promise<void> {
    try {
      // Load indices from database or Redis
      const data = await redisClient.hgetall('search_indices');
      
      for (const [name, indexData] of Object.entries(data)) {
        const index = JSON.parse(indexData);
        this.indices.set(name, index);
      }
      
      logger.info('Search indices loaded', { count: this.indices.size });
      
    } catch (error) {
      logger.error('Failed to load indices', { error });
    }
  }

  private async saveIndex(index: SearchIndex): Promise<void> {
    await redisClient.hset(
      'search_indices',
      index.name,
      JSON.stringify(index)
    );
  }

  private getCacheKey(indexName: string, query: SearchQuery): string {
    return `search:${indexName}:${JSON.stringify(query)}`;
  }

  private getFromCache(key: string): any {
    const cached = this.searchCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    
    return null;
  }

  private cacheResult(key: string, result: any): void {
    this.searchCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  private clearIndexCache(indexName: string): void {
    for (const key of this.searchCache.keys()) {
      if (key.startsWith(`search:${indexName}:`)) {
        this.searchCache.delete(key);
      }
    }
  }

  private setupCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      
      for (const [key, cached] of this.searchCache.entries()) {
        if (now - cached.timestamp > this.cacheTimeout) {
          this.searchCache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      // Clean old query history
      const cutoff = Date.now() - 3600000; // 1 hour
      
      this.queryHistory = this.queryHistory.filter(
        q => q.timestamp.getTime() > cutoff
      );
      
      // Persist metrics
      this.persistMetrics();
      
    }, 60000); // Every minute
  }

  private updateMetrics(query: string, took: number): void {
    this.metrics.totalSearches++;
    
    // Update average response time
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalSearches - 1);
    this.metrics.averageResponseTime = (totalTime + took) / this.metrics.totalSearches;
    
    // Track slow queries
    if (took > this.slowQueryThreshold) {
      this.metrics.slowQueries++;
    }
    
    // Add to query history
    this.queryHistory.push({
      query,
      timestamp: new Date(),
      took
    });
    
    // Limit history size
    if (this.queryHistory.length > this.maxQueryHistory) {
      this.queryHistory.shift();
    }
  }

  private async persistMetrics(): Promise<void> {
    await redisClient.hset(
      'search_metrics',
      'current',
      JSON.stringify(this.metrics)
    );
  }
}

// Export singleton instance
let searchService: SearchService | null = null;

export const initializeSearchService = (pool: Pool): SearchService => {
  if (!searchService) {
    searchService = new SearchService(pool);
  }
  return searchService;
};

export default searchService;