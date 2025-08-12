/**
 * Search Suggestions Service
 * Provides intelligent search suggestions, autocomplete, and query completion
 */

import { EventEmitter } from 'events';
import * as schedule from 'node-cron';
import { Pool } from 'pg';
import redisClient from '../config/redis';
import logger from '../utils/logger';
import searchService from './searchService';

// Types
export interface Suggestion {
  id: string;
  text: string;
  type: 'query' | 'phrase' | 'entity' | 'facet' | 'user';
  category?: string;
  score: number;
  frequency: number;
  lastUsed: Date;
  metadata?: Record<string, any>;
}

export interface AutocompleteSuggestion {
  text: string;
  highlighted: string;
  type: string;
  category?: string;
  score: number;
  resultCount?: number;
  context?: string;
}

export interface QuerySuggestion {
  query: string;
  corrected?: string;
  suggestions: string[];
  filters?: Array<{
    field: string;
    values: string[];
  }>;
  intent?: QueryIntent;
}

export interface QueryIntent {
  type: 'search' | 'filter' | 'sort' | 'navigate' | 'command';
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  confidence: number;
}

export interface SuggestionConfig {
  maxSuggestions: number;
  minQueryLength: number;
  enableSpellCheck: boolean;
  enableAutoComplete: boolean;
  enableQuerySuggestions: boolean;
  enablePopularQueries: boolean;
  enablePersonalization: boolean;
  cacheTimeout: number;
  updateFrequency: string; // Cron pattern
}

export interface PersonalizationData {
  userId: string;
  queryHistory: string[];
  clickHistory: Array<{
    query: string;
    documentId: string;
    timestamp: Date;
  }>;
  preferences: {
    categories: string[];
    fields: string[];
    filters: Record<string, any>;
  };
  searchPatterns: {
    timeOfDay: number[];
    dayOfWeek: number[];
    queryTypes: string[];
  };
}

export interface SpellCheckResult {
  originalQuery: string;
  correctedQuery?: string;
  corrections: Array<{
    term: string;
    suggestions: string[];
    confidence: number;
  }>;
  confidence: number;
}

export interface PopularQuery {
  query: string;
  count: number;
  uniqueUsers: number;
  avgResultCount: number;
  avgClickThrough: number;
  category?: string;
  trending: boolean;
  lastWeekGrowth: number;
}

class SearchSuggestionsService extends EventEmitter {
  private suggestions: Map<string, Suggestion[]> = new Map();
  private userPersonalization: Map<string, PersonalizationData> = new Map();
  private popularQueries: PopularQuery[] = [];
  private spellCheckDict: Set<string> = new Set();
  private config: SuggestionConfig;
  private pool: Pool;
  private updateJob?: schedule.ScheduledTask;
  private isInitialized: boolean = false;

  constructor() {
    super();
    
    this.config = {
      maxSuggestions: 10,
      minQueryLength: 2,
      enableSpellCheck: true,
      enableAutoComplete: true,
      enableQuerySuggestions: true,
      enablePopularQueries: true,
      enablePersonalization: true,
      cacheTimeout: 3600, // 1 hour
      updateFrequency: '0 */6 * * *' // Every 6 hours
    };

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Initialize the suggestions service
   */
  async initialize(config?: Partial<SuggestionConfig>): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Create tables
      await this.createTables();
      
      // Load existing data
      await this.loadSuggestions();
      await this.loadPopularQueries();
      await this.buildSpellCheckDictionary();
      
      // Setup update job
      this.setupUpdateJob();
      
      this.isInitialized = true;
      logger.info('Search suggestions service initialized');
    } catch (error) {
      logger.error('Failed to initialize search suggestions service:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    const queries = [
      `
        CREATE TABLE IF NOT EXISTS search_suggestions (
          id VARCHAR(255) PRIMARY KEY,
          text TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          category VARCHAR(100),
          score DECIMAL(5, 4) DEFAULT 0,
          frequency INTEGER DEFAULT 0,
          last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_search_suggestions_text ON search_suggestions USING GIN (to_tsvector('english', text));
        CREATE INDEX IF NOT EXISTS idx_search_suggestions_type ON search_suggestions (type);
        CREATE INDEX IF NOT EXISTS idx_search_suggestions_score ON search_suggestions (score DESC);
      `,
      `
        CREATE TABLE IF NOT EXISTS search_queries (
          id BIGSERIAL PRIMARY KEY,
          query TEXT NOT NULL,
          user_id VARCHAR(255),
          index_id VARCHAR(255),
          result_count INTEGER,
          click_through_count INTEGER DEFAULT 0,
          session_id VARCHAR(255),
          ip_address INET,
          user_agent TEXT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_search_queries_query ON search_queries (query);
        CREATE INDEX IF NOT EXISTS idx_search_queries_user ON search_queries (user_id);
        CREATE INDEX IF NOT EXISTS idx_search_queries_timestamp ON search_queries (timestamp);
      `,
      `
        CREATE TABLE IF NOT EXISTS search_clicks (
          id BIGSERIAL PRIMARY KEY,
          query_id BIGINT REFERENCES search_queries(id),
          document_id VARCHAR(255) NOT NULL,
          position INTEGER,
          user_id VARCHAR(255),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS user_search_preferences (
          user_id VARCHAR(255) PRIMARY KEY,
          preferences JSONB,
          search_patterns JSONB,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `,
      `
        CREATE TABLE IF NOT EXISTS popular_queries (
          query TEXT PRIMARY KEY,
          count INTEGER DEFAULT 0,
          unique_users INTEGER DEFAULT 0,
          avg_result_count DECIMAL(10, 2),
          avg_click_through DECIMAL(5, 4),
          category VARCHAR(100),
          trending BOOLEAN DEFAULT false,
          last_week_growth DECIMAL(5, 2),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `
    ];

    for (const query of queries) {
      await this.pool.query(query);
    }
  }

  /**
   * Load suggestions from database
   */
  private async loadSuggestions(): Promise<void> {
    const query = `
      SELECT * FROM search_suggestions
      WHERE frequency > 0
      ORDER BY score DESC, frequency DESC
      LIMIT 10000
    `;

    const result = await this.pool.query(query);
    const suggestionsByType = new Map<string, Suggestion[]>();

    for (const row of result.rows) {
      const suggestion: Suggestion = {
        id: row.id,
        text: row.text,
        type: row.type,
        category: row.category,
        score: parseFloat(row.score),
        frequency: row.frequency,
        lastUsed: row.last_used,
        metadata: row.metadata
      };

      const key = `${suggestion.type}:${suggestion.category || 'default'}`;
      if (!suggestionsByType.has(key)) {
        suggestionsByType.set(key, []);
      }
      suggestionsByType.get(key)!.push(suggestion);
    }

    this.suggestions = suggestionsByType;
  }

  /**
   * Load popular queries
   */
  private async loadPopularQueries(): Promise<void> {
    const query = `
      SELECT * FROM popular_queries
      ORDER BY count DESC, trending DESC
      LIMIT 1000
    `;

    const result = await this.pool.query(query);
    this.popularQueries = result.rows.map(row => ({
      query: row.query,
      count: row.count,
      uniqueUsers: row.unique_users,
      avgResultCount: parseFloat(row.avg_result_count),
      avgClickThrough: parseFloat(row.avg_click_through),
      category: row.category,
      trending: row.trending,
      lastWeekGrowth: parseFloat(row.last_week_growth)
    }));
  }

  /**
   * Build spell check dictionary
   */
  private async buildSpellCheckDictionary(): Promise<void> {
    // Get common terms from suggestions
    const terms = new Set<string>();
    
    for (const suggestions of this.suggestions.values()) {
      for (const suggestion of suggestions) {
        suggestion.text.toLowerCase().split(/\s+/).forEach(term => {
          if (term.length >= 3) {
            terms.add(term);
          }
        });
      }
    }

    // Add terms from popular queries
    for (const query of this.popularQueries) {
      query.query.toLowerCase().split(/\s+/).forEach(term => {
        if (term.length >= 3) {
          terms.add(term);
        }
      });
    }

    this.spellCheckDict = terms;
  }

  /**
   * Get autocomplete suggestions
   */
  async getAutocompleteSuggestions(
    query: string,
    userId?: string,
    indexId?: string,
    options: {
      maxSuggestions?: number;
      types?: string[];
      categories?: string[];
      includePersonalized?: boolean;
    } = {}
  ): Promise<AutocompleteSuggestion[]> {
    if (query.length < this.config.minQueryLength) {
      return [];
    }

    const cacheKey = `autocomplete:${indexId || 'global'}:${userId || 'anonymous'}:${Buffer.from(query).toString('base64')}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const results: AutocompleteSuggestion[] = [];
    const queryLower = query.toLowerCase();
    const maxSuggestions = options.maxSuggestions || this.config.maxSuggestions;

    // Get spell check suggestions first
    if (this.config.enableSpellCheck) {
      const spellCheck = await this.checkSpelling(query);
      if (spellCheck.correctedQuery && spellCheck.confidence > 0.7) {
        results.push({
          text: spellCheck.correctedQuery,
          highlighted: this.highlightQuery(spellCheck.correctedQuery, query),
          type: 'spell_correction',
          score: spellCheck.confidence,
          context: `Did you mean "${spellCheck.correctedQuery}"?`
        });
      }
    }

    // Get autocomplete from suggestions
    if (this.config.enableAutoComplete) {
      const autocompleteSuggestions = await this.getAutocompleteSuggestionsFromData(
        queryLower,
        options.types,
        options.categories
      );
      results.push(...autocompleteSuggestions);
    }

    // Get popular query suggestions
    if (this.config.enablePopularQueries) {
      const popularSuggestions = this.getPopularQuerySuggestions(queryLower);
      results.push(...popularSuggestions);
    }

    // Get personalized suggestions
    if (this.config.enablePersonalization && options.includePersonalized && userId) {
      const personalizedSuggestions = await this.getPersonalizedSuggestions(
        userId,
        queryLower
      );
      results.push(...personalizedSuggestions);
    }

    // Sort by score and remove duplicates
    const uniqueResults = this.deduplicateAndSort(results, maxSuggestions);

    // Cache results
    await redisClient.setex(
      cacheKey,
      this.config.cacheTimeout,
      JSON.stringify(uniqueResults)
    );

    return uniqueResults;
  }

  /**
   * Get autocomplete suggestions from stored data
   */
  private async getAutocompleteSuggestionsFromData(
    query: string,
    types?: string[],
    categories?: string[]
  ): Promise<AutocompleteSuggestion[]> {
    const results: AutocompleteSuggestion[] = [];

    for (const [key, suggestions] of this.suggestions) {
      const [type, category] = key.split(':');
      
      // Filter by type and category if specified
      if (types && !types.includes(type)) continue;
      if (categories && !categories.includes(category)) continue;

      for (const suggestion of suggestions) {
        const text = suggestion.text.toLowerCase();
        
        // Check if query matches
        if (text.includes(query) || this.fuzzyMatch(text, query)) {
          results.push({
            text: suggestion.text,
            highlighted: this.highlightQuery(suggestion.text, query),
            type: suggestion.type,
            category: suggestion.category,
            score: suggestion.score * (text.startsWith(query) ? 1.2 : 1.0),
            resultCount: suggestion.metadata?.resultCount,
            context: suggestion.metadata?.context
          });
        }
      }
    }

    return results;
  }

  /**
   * Get popular query suggestions
   */
  private getPopularQuerySuggestions(query: string): AutocompleteSuggestion[] {
    return this.popularQueries
      .filter(pq => {
        const queryLower = pq.query.toLowerCase();
        return queryLower.includes(query) || this.fuzzyMatch(queryLower, query);
      })
      .slice(0, 5)
      .map(pq => ({
        text: pq.query,
        highlighted: this.highlightQuery(pq.query, query),
        type: 'popular_query',
        category: pq.category,
        score: Math.min(0.9, pq.count / 1000),
        resultCount: Math.round(pq.avgResultCount),
        context: pq.trending ? 'Trending' : `${pq.count} searches`
      }));
  }

  /**
   * Get personalized suggestions
   */
  private async getPersonalizedSuggestions(
    userId: string,
    query: string
  ): Promise<AutocompleteSuggestion[]> {
    const userData = await this.getUserPersonalizationData(userId);
    if (!userData) return [];

    const results: AutocompleteSuggestion[] = [];

    // Get suggestions from user's query history
    for (const historicalQuery of userData.queryHistory) {
      const queryLower = historicalQuery.toLowerCase();
      if (queryLower.includes(query) && queryLower !== query) {
        results.push({
          text: historicalQuery,
          highlighted: this.highlightQuery(historicalQuery, query),
          type: 'personal_history',
          score: 0.8,
          context: 'From your search history'
        });
      }
    }

    // Get suggestions based on user preferences
    for (const category of userData.preferences.categories) {
      const categoryKey = `query:${category}`;
      const categorySuggestions = this.suggestions.get(categoryKey) || [];
      
      for (const suggestion of categorySuggestions.slice(0, 3)) {
        if (suggestion.text.toLowerCase().includes(query)) {
          results.push({
            text: suggestion.text,
            highlighted: this.highlightQuery(suggestion.text, query),
            type: 'personalized',
            category: suggestion.category,
            score: suggestion.score * 0.9,
            context: `Popular in ${category}`
          });
        }
      }
    }

    return results.slice(0, 5);
  }

  /**
   * Get query suggestions with intent analysis
   */
  async getQuerySuggestions(
    query: string,
    userId?: string,
    indexId?: string
  ): Promise<QuerySuggestion> {
    const intent = await this.analyzeQueryIntent(query);
    const spellCheck = await this.checkSpelling(query);
    
    const suggestions: string[] = [];
    const filters: Array<{ field: string; values: string[] }> = [];

    // Get query expansion suggestions
    const expansions = await this.getQueryExpansions(query, indexId);
    suggestions.push(...expansions);

    // Get filter suggestions based on intent
    if (intent.type === 'filter') {
      const filterSuggestions = await this.getFilterSuggestions(query, indexId);
      filters.push(...filterSuggestions);
    }

    // Get related queries
    const relatedQueries = await this.getRelatedQueries(query, userId);
    suggestions.push(...relatedQueries);

    return {
      query,
      corrected: spellCheck.correctedQuery,
      suggestions: suggestions.slice(0, 10),
      filters: filters.slice(0, 5),
      intent
    };
  }

  /**
   * Analyze query intent
   */
  private async analyzeQueryIntent(query: string): Promise<QueryIntent> {
    const queryLower = query.toLowerCase();
    const tokens = queryLower.split(/\s+/);
    
    let type: QueryIntent['type'] = 'search';
    const entities: QueryIntent['entities'] = [];
    let confidence = 0.5;

    // Check for filter keywords
    const filterKeywords = ['in:', 'category:', 'type:', 'status:', 'date:', 'user:'];
    if (filterKeywords.some(keyword => queryLower.includes(keyword))) {
      type = 'filter';
      confidence = 0.8;
    }

    // Check for sort keywords
    const sortKeywords = ['sort by', 'order by', 'sorted', 'newest', 'oldest', 'popular'];
    if (sortKeywords.some(keyword => queryLower.includes(keyword))) {
      type = 'sort';
      confidence = 0.7;
    }

    // Extract entities (simplified)
    for (const token of tokens) {
      if (token.startsWith('@')) {
        entities.push({
          type: 'user',
          value: token.substring(1),
          confidence: 0.9
        });
      } else if (token.startsWith('#')) {
        entities.push({
          type: 'tag',
          value: token.substring(1),
          confidence: 0.9
        });
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
        entities.push({
          type: 'date',
          value: token,
          confidence: 0.8
        });
      }
    }

    return { type, entities, confidence };
  }

  /**
   * Check spelling and suggest corrections
   */
  async checkSpelling(query: string): Promise<SpellCheckResult> {
    const words = query.toLowerCase().split(/\s+/);
    const corrections: SpellCheckResult['corrections'] = [];
    let hasCorrections = false;

    for (const word of words) {
      if (word.length < 3) continue;

      if (!this.spellCheckDict.has(word)) {
        const suggestions = this.findSimilarWords(word);
        if (suggestions.length > 0) {
          corrections.push({
            term: word,
            suggestions: suggestions.slice(0, 3),
            confidence: 0.8
          });
          hasCorrections = true;
        }
      }
    }

    let correctedQuery: string | undefined;
    let confidence = 0;

    if (hasCorrections) {
      // Build corrected query
      correctedQuery = query;
      for (const correction of corrections) {
        if (correction.suggestions.length > 0) {
          correctedQuery = correctedQuery.replace(
            new RegExp(`\\b${correction.term}\\b`, 'gi'),
            correction.suggestions[0]
          );
        }
      }
      confidence = corrections.reduce((sum, c) => sum + c.confidence, 0) / corrections.length;
    }

    return {
      originalQuery: query,
      correctedQuery,
      corrections,
      confidence
    };
  }

  /**
   * Find similar words using edit distance
   */
  private findSimilarWords(word: string): string[] {
    const suggestions: Array<{ word: string; distance: number }> = [];
    
    for (const dictWord of this.spellCheckDict) {
      const distance = this.editDistance(word, dictWord);
      if (distance <= 2 && distance > 0) {
        suggestions.push({ word: dictWord, distance });
      }
    }

    return suggestions
      .sort((a, b) => a.distance - b.distance)
      .map(s => s.word);
  }

  /**
   * Calculate edit distance between two strings
   */
  private editDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator  // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get query expansions
   */
  private async getQueryExpansions(
    query: string,
    indexId?: string
  ): Promise<string[]> {
    const expansions: string[] = [];
    
    // Add synonyms if available
    const words = query.toLowerCase().split(/\s+/);
    for (const word of words) {
      const synonyms = await this.getSynonyms(word);
      for (const synonym of synonyms.slice(0, 2)) {
        const expandedQuery = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), synonym);
        if (expandedQuery !== query) {
          expansions.push(expandedQuery);
        }
      }
    }

    // Add broader/narrower terms
    const relatedTerms = await this.getRelatedTerms(query);
    expansions.push(...relatedTerms);

    return expansions;
  }

  /**
   * Get synonyms for a word
   */
  private async getSynonyms(word: string): Promise<string[]> {
    // Simple synonym mapping - in production, you might use a thesaurus API
    const synonymMap: Record<string, string[]> = {
      'search': ['find', 'look', 'query'],
      'user': ['person', 'individual', 'account'],
      'document': ['file', 'record', 'item'],
      'create': ['make', 'build', 'generate'],
      'delete': ['remove', 'erase', 'destroy']
    };

    return synonymMap[word.toLowerCase()] || [];
  }

  /**
   * Get related terms
   */
  private async getRelatedTerms(query: string): Promise<string[]> {
    // Use co-occurrence analysis from search logs
    const relatedQuery = `
      SELECT DISTINCT sq2.query
      FROM search_queries sq1
      JOIN search_queries sq2 ON sq1.user_id = sq2.user_id
      WHERE sq1.query ILIKE $1
      AND sq2.query != sq1.query
      AND sq2.timestamp >= sq1.timestamp - INTERVAL '1 hour'
      AND sq2.timestamp <= sq1.timestamp + INTERVAL '1 hour'
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `;

    const result = await this.pool.query(relatedQuery, [`%${query}%`]);
    return result.rows.map(row => row.query);
  }

  /**
   * Get filter suggestions
   */
  private async getFilterSuggestions(
    query: string,
    indexId?: string
  ): Promise<Array<{ field: string; values: string[] }>> {
    if (!indexId) return [];

    const filters: Array<{ field: string; values: string[] }> = [];
    
    // Get popular filter combinations for similar queries
    const filterQuery = `
      SELECT 
        metadata->>'filters' as filters,
        COUNT(*) as frequency
      FROM search_queries
      WHERE query ILIKE $1
      AND metadata->>'filters' IS NOT NULL
      GROUP BY metadata->>'filters'
      ORDER BY frequency DESC
      LIMIT 5
    `;

    const result = await this.pool.query(filterQuery, [`%${query}%`]);
    
    for (const row of result.rows) {
      try {
        const filterData = JSON.parse(row.filters);
        for (const [field, values] of Object.entries(filterData)) {
          if (Array.isArray(values)) {
            filters.push({ field, values });
          }
        }
      } catch (error) {
        // Skip invalid JSON
      }
    }

    return filters;
  }

  /**
   * Get related queries
   */
  private async getRelatedQueries(
    query: string,
    userId?: string
  ): Promise<string[]> {
    const queries: string[] = [];

    // Get queries from same user sessions
    if (userId) {
      const userQuery = `
        SELECT DISTINCT query
        FROM search_queries
        WHERE user_id = $1
        AND query ILIKE $2
        AND query != $3
        ORDER BY timestamp DESC
        LIMIT 5
      `;

      const result = await this.pool.query(userQuery, [userId, `%${query}%`, query]);
      queries.push(...result.rows.map(row => row.query));
    }

    // Get globally popular related queries
    const popularQuery = `
      SELECT query, COUNT(*) as frequency
      FROM search_queries
      WHERE query ILIKE $1
      AND query != $2
      GROUP BY query
      ORDER BY frequency DESC
      LIMIT 5
    `;

    const result = await this.pool.query(popularQuery, [`%${query}%`, query]);
    queries.push(...result.rows.map(row => row.query));

    return Array.from(new Set(queries)); // Remove duplicates
  }

  /**
   * Track search query
   */
  async trackSearchQuery(
    query: string,
    userId?: string,
    indexId?: string,
    resultCount?: number,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<number> {
    const insertQuery = `
      INSERT INTO search_queries (
        query, user_id, index_id, result_count,
        session_id, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const result = await this.pool.query(insertQuery, [
      query,
      userId,
      indexId,
      resultCount,
      sessionId,
      ipAddress,
      userAgent
    ]);

    const queryId = result.rows[0].id;

    // Update suggestions based on query
    await this.updateSuggestionsFromQuery(query);

    // Update user personalization
    if (userId) {
      await this.updateUserPersonalization(userId, query);
    }

    return queryId;
  }

  /**
   * Track click on search result
   */
  async trackSearchClick(
    queryId: number,
    documentId: string,
    position: number,
    userId?: string
  ): Promise<void> {
    const insertQuery = `
      INSERT INTO search_clicks (query_id, document_id, position, user_id)
      VALUES ($1, $2, $3, $4)
    `;

    await this.pool.query(insertQuery, [queryId, documentId, position, userId]);

    // Update click through count
    await this.pool.query(
      `UPDATE search_queries SET click_through_count = click_through_count + 1 WHERE id = $1`,
      [queryId]
    );
  }

  /**
   * Update suggestions from query
   */
  private async updateSuggestionsFromQuery(query: string): Promise<void> {
    const words = query.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (word.length >= 3) {
        await this.upsertSuggestion({
          text: word,
          type: 'query',
          score: 0.5,
          frequency: 1
        });
      }
    }

    // Add full query as phrase suggestion
    await this.upsertSuggestion({
      text: query,
      type: 'phrase',
      score: 0.7,
      frequency: 1
    });
  }

  /**
   * Upsert suggestion
   */
  private async upsertSuggestion(suggestion: Partial<Suggestion>): Promise<void> {
    const query = `
      INSERT INTO search_suggestions (id, text, type, score, frequency)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET
        frequency = search_suggestions.frequency + 1,
        score = GREATEST(search_suggestions.score, EXCLUDED.score),
        last_used = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `;

    const id = `${suggestion.type}_${Buffer.from(suggestion.text!).toString('base64')}`;
    
    await this.pool.query(query, [
      id,
      suggestion.text,
      suggestion.type,
      suggestion.score || 0.5,
      suggestion.frequency || 1
    ]);
  }

  /**
   * Update user personalization data
   */
  private async updateUserPersonalization(
    userId: string,
    query: string
  ): Promise<void> {
    const userData = await this.getUserPersonalizationData(userId) || {
      userId,
      queryHistory: [],
      clickHistory: [],
      preferences: { categories: [], fields: [], filters: {} },
      searchPatterns: { timeOfDay: [], dayOfWeek: [], queryTypes: [] }
    };

    // Add to query history
    userData.queryHistory.unshift(query);
    userData.queryHistory = userData.queryHistory.slice(0, 100); // Keep last 100 queries

    // Update search patterns
    const now = new Date();
    userData.searchPatterns.timeOfDay.push(now.getHours());
    userData.searchPatterns.dayOfWeek.push(now.getDay());
    userData.searchPatterns.queryTypes.push(this.categorizeQuery(query));

    // Keep only recent patterns
    userData.searchPatterns.timeOfDay = userData.searchPatterns.timeOfDay.slice(-100);
    userData.searchPatterns.dayOfWeek = userData.searchPatterns.dayOfWeek.slice(-100);
    userData.searchPatterns.queryTypes = userData.searchPatterns.queryTypes.slice(-100);

    // Save to database
    const upsertQuery = `
      INSERT INTO user_search_preferences (user_id, preferences, search_patterns)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        preferences = EXCLUDED.preferences,
        search_patterns = EXCLUDED.search_patterns,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.pool.query(upsertQuery, [
      userId,
      JSON.stringify(userData.preferences),
      JSON.stringify(userData.searchPatterns)
    ]);

    this.userPersonalization.set(userId, userData);
  }

  /**
   * Get user personalization data
   */
  private async getUserPersonalizationData(
    userId: string
  ): Promise<PersonalizationData | null> {
    // Check cache first
    if (this.userPersonalization.has(userId)) {
      return this.userPersonalization.get(userId)!;
    }

    // Load from database
    const query = `
      SELECT preferences, search_patterns FROM user_search_preferences
      WHERE user_id = $1
    `;

    const result = await this.pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    // Get query history
    const historyQuery = `
      SELECT DISTINCT query FROM search_queries
      WHERE user_id = $1
      ORDER BY timestamp DESC
      LIMIT 100
    `;

    const historyResult = await this.pool.query(historyQuery, [userId]);
    const queryHistory = historyResult.rows.map(r => r.query);

    // Get click history
    const clickQuery = `
      SELECT sq.query, sc.document_id, sc.timestamp
      FROM search_clicks sc
      JOIN search_queries sq ON sc.query_id = sq.id
      WHERE sc.user_id = $1
      ORDER BY sc.timestamp DESC
      LIMIT 100
    `;

    const clickResult = await this.pool.query(clickQuery, [userId]);
    const clickHistory = clickResult.rows.map(r => ({
      query: r.query,
      documentId: r.document_id,
      timestamp: r.timestamp
    }));

    const userData: PersonalizationData = {
      userId,
      queryHistory,
      clickHistory,
      preferences: row.preferences || { categories: [], fields: [], filters: {} },
      searchPatterns: row.search_patterns || { timeOfDay: [], dayOfWeek: [], queryTypes: [] }
    };

    this.userPersonalization.set(userId, userData);
    return userData;
  }

  /**
   * Categorize query type
   */
  private categorizeQuery(query: string): string {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('user') || queryLower.includes('@')) return 'user';
    if (queryLower.includes('file') || queryLower.includes('document')) return 'document';
    if (queryLower.includes('create') || queryLower.includes('new')) return 'creation';
    if (queryLower.includes('update') || queryLower.includes('edit')) return 'modification';
    if (queryLower.includes('delete') || queryLower.includes('remove')) return 'deletion';
    if (queryLower.includes('search') || queryLower.includes('find')) return 'search';
    
    return 'general';
  }

  /**
   * Highlight query in text
   */
  private highlightQuery(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Fuzzy match text with query
   */
  private fuzzyMatch(text: string, query: string): boolean {
    if (query.length === 0) return true;
    if (text.length === 0) return false;

    const distance = this.editDistance(text, query);
    const maxDistance = Math.floor(query.length * 0.3); // Allow 30% differences
    
    return distance <= maxDistance;
  }

  /**
   * Deduplicate and sort suggestions
   */
  private deduplicateAndSort(
    suggestions: AutocompleteSuggestion[],
    maxResults: number
  ): AutocompleteSuggestion[] {
    const seen = new Set<string>();
    const unique: AutocompleteSuggestion[] = [];

    for (const suggestion of suggestions) {
      const key = `${suggestion.text}:${suggestion.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }

    return unique
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Setup periodic update job
   */
  private setupUpdateJob(): void {
    this.updateJob = schedule.schedule(this.config.updateFrequency, async () => {
      try {
        await this.updatePopularQueries();
        await this.updateSuggestionScores();
        await this.cleanupOldData();
      } catch (error) {
        logger.error('Suggestions update job failed:', error);
      }
    });

    this.updateJob.start();
  }

  /**
   * Update popular queries
   */
  private async updatePopularQueries(): Promise<void> {
    const query = `
      WITH query_stats AS (
        SELECT 
          query,
          COUNT(*) as total_count,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(result_count) as avg_result_count,
          AVG(CASE WHEN click_through_count > 0 THEN 1.0 ELSE 0.0 END) as avg_click_through,
          COUNT(*) FILTER (WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days') as recent_count,
          COUNT(*) FILTER (WHERE timestamp >= CURRENT_DATE - INTERVAL '14 days' 
                                 AND timestamp < CURRENT_DATE - INTERVAL '7 days') as prev_week_count
        FROM search_queries
        WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY query
        HAVING COUNT(*) >= 5
      )
      SELECT 
        query,
        total_count,
        unique_users,
        avg_result_count,
        avg_click_through,
        CASE 
          WHEN prev_week_count > 0 THEN ((recent_count - prev_week_count)::decimal / prev_week_count) * 100
          ELSE 0 
        END as growth_rate,
        recent_count > prev_week_count * 1.5 as trending
      FROM query_stats
      ORDER BY total_count DESC
    `;

    const result = await this.pool.query(query);
    
    // Update popular_queries table
    await this.pool.query('DELETE FROM popular_queries');
    
    for (const row of result.rows) {
      await this.pool.query(
        `INSERT INTO popular_queries (
          query, count, unique_users, avg_result_count, 
          avg_click_through, trending, last_week_growth
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          row.query,
          row.total_count,
          row.unique_users,
          row.avg_result_count,
          row.avg_click_through,
          row.trending,
          row.growth_rate
        ]
      );
    }

    // Reload popular queries
    await this.loadPopularQueries();
  }

  /**
   * Update suggestion scores
   */
  private async updateSuggestionScores(): Promise<void> {
    const query = `
      UPDATE search_suggestions
      SET score = LEAST(1.0, 
        (frequency / 1000.0) * 0.5 + 
        (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_used)) / 86400)::decimal * -0.01 + 0.5
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE frequency > 0
    `;

    await this.pool.query(query);
    
    // Reload suggestions
    await this.loadSuggestions();
  }

  /**
   * Cleanup old data
   */
  private async cleanupOldData(): Promise<void> {
    const retentionDays = 90;
    
    // Clean old search queries
    await this.pool.query(
      `DELETE FROM search_queries WHERE timestamp < CURRENT_DATE - INTERVAL '${retentionDays} days'`
    );

    // Clean low-frequency suggestions
    await this.pool.query(
      `DELETE FROM search_suggestions WHERE frequency < 5 AND created_at < CURRENT_DATE - INTERVAL '30 days'`
    );

    // Clean old user personalization data
    await this.pool.query(
      `DELETE FROM user_search_preferences WHERE updated_at < CURRENT_DATE - INTERVAL '180 days'`
    );
  }

  /**
   * Get service statistics
   */
  async getStatistics(): Promise<{
    totalSuggestions: number;
    totalQueries: number;
    totalUsers: number;
    popularQueries: number;
    avgResponseTime: number;
  }> {
    const stats = await Promise.all([
      this.pool.query('SELECT COUNT(*) as count FROM search_suggestions'),
      this.pool.query('SELECT COUNT(*) as count FROM search_queries WHERE timestamp >= CURRENT_DATE - INTERVAL \'30 days\''),
      this.pool.query('SELECT COUNT(DISTINCT user_id) as count FROM search_queries WHERE timestamp >= CURRENT_DATE - INTERVAL \'30 days\''),
      this.pool.query('SELECT COUNT(*) as count FROM popular_queries'),
    ]);

    return {
      totalSuggestions: parseInt(stats[0].rows[0].count),
      totalQueries: parseInt(stats[1].rows[0].count),
      totalUsers: parseInt(stats[2].rows[0].count),
      popularQueries: parseInt(stats[3].rows[0].count),
      avgResponseTime: 0 // Would need performance monitoring
    };
  }
}

// Export singleton instance
const searchSuggestionsService = new SearchSuggestionsService();
export default searchSuggestionsService;