/**
 * Analytics Service
 * Handles form analytics and reporting
 */

import { Pool } from 'pg';
import { logger } from '../../../utils/logger';
import { getDb, querySchema, withSchemaTransaction } from '../database';
import {
  FormAnalytics,
  AnalyticsSummary,
  FieldAnalytics,
  CompletionFunnelStep,
  DynamicFormBuilderError
} from '../types';

export class AnalyticsService {
  private db: Pool;

  constructor() {
    this.db = getDb();
  }

  /**
   * Get analytics summary for a form
   */
  async getFormAnalyticsSummary(
    formId: string,
    period: string = '30d',
    timezone: string = 'UTC'
  ): Promise<AnalyticsSummary> {
    try {
      const dateRange = this.calculateDateRange(period);

      // Get overview metrics
      const overview = await this.getOverviewMetrics(formId, dateRange);
      
      // Get trend data
      const trends = await this.getTrendData(formId, dateRange);
      
      // Get traffic sources
      const topTrafficSources = await this.getTopTrafficSources(formId, dateRange);
      
      // Get device breakdown
      const deviceBreakdown = await this.getDeviceBreakdown(formId, dateRange);
      
      // Get field analytics
      const fieldAnalytics = await this.getFieldAnalytics(formId, dateRange);
      
      // Get completion funnel
      const completionFunnel = await this.getCompletionFunnel(formId, dateRange);

      return {
        overview,
        trends,
        topTrafficSources,
        deviceBreakdown,
        fieldAnalytics,
        completionFunnel
      };
    } catch (error) {
      logger.error('Failed to get form analytics summary', { error, formId, period });
      throw new DynamicFormBuilderError('Failed to retrieve analytics', 'ANALYTICS_FETCH_FAILED', 500);
    }
  }

  /**
   * Record form view
   */
  async recordFormView(
    formId: string,
    metadata: {
      sessionId?: string;
      userId?: string;
      ip?: string;
      userAgent?: string;
      referrer?: string;
      utmParams?: Record<string, string>;
    }
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Parse user agent for device info
      const deviceInfo = this.parseUserAgent(metadata.userAgent);
      
      // Extract traffic source
      const trafficSource = this.extractTrafficSource(metadata.referrer, metadata.utmParams);

      // Update daily analytics
      await this.db.query(`
        INSERT INTO form_analytics (form_id, date, views, unique_visitors)
        VALUES ($1, $2, 1, 1)
        ON CONFLICT (form_id, date)
        DO UPDATE SET 
          views = form_analytics.views + 1,
          unique_visitors = form_analytics.unique_visitors + CASE 
            WHEN $3 IS NOT NULL THEN 0 
            ELSE 1 
          END,
          device_breakdown = jsonb_set(
            COALESCE(form_analytics.device_breakdown, '{}'),
            ARRAY[$4],
            COALESCE(form_analytics.device_breakdown->>$4, '0')::int + 1,
            true
          ),
          traffic_sources = jsonb_set(
            COALESCE(form_analytics.traffic_sources, '{}'),
            ARRAY[$5],
            COALESCE(form_analytics.traffic_sources->>$5, '0')::int + 1,
            true
          ),
          updated_at = CURRENT_TIMESTAMP
      `, [
        formId,
        today,
        metadata.userId, // If user is logged in, don't increment unique visitors
        deviceInfo.type,
        trafficSource
      ]);

      logger.debug('Form view recorded', { formId, deviceInfo, trafficSource });
    } catch (error) {
      logger.error('Failed to record form view', { error, formId });
      // Don't throw error - analytics shouldn't break form functionality
    }
  }

  /**
   * Record form abandonment
   */
  async recordFormAbandonment(
    formId: string,
    step: number,
    timeSpent: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Update abandonment analytics
      await this.db.query(`
        UPDATE form_analytics 
        SET 
          abandonment_rate = CASE 
            WHEN views > 0 THEN (abandonment_rate * views + 1) / (views + 1)
            ELSE 1
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE form_id = $1 AND date = $2
      `, [formId, today]);

      logger.debug('Form abandonment recorded', { formId, step, timeSpent });
    } catch (error) {
      logger.error('Failed to record form abandonment', { error, formId });
    }
  }

  /**
   * Get field interaction analytics
   */
  async getFieldAnalytics(formId: string, dateRange: { start: Date; end: Date }): Promise<FieldAnalytics[]> {
    try {
      // This is a placeholder implementation
      // In a real implementation, you'd track field interactions separately
      const fieldsResult = await this.db.query(`
        SELECT 
          ff.id,
          ff.field_key,
          ff.label,
          ff.field_type,
          COUNT(DISTINCT fs.id) as interactions,
          AVG(EXTRACT(EPOCH FROM (fs.updated_at - fs.created_at))) as avg_time_spent
        FROM form_fields ff
        LEFT JOIN form_submissions fs ON ff.form_id = fs.form_id 
          AND fs.data ? ff.field_key
          AND fs.created_at BETWEEN $2 AND $3
        WHERE ff.form_id = $1
        GROUP BY ff.id, ff.field_key, ff.label, ff.field_type
        ORDER BY ff.position
      `, [formId, dateRange.start, dateRange.end]);

      return fieldsResult.rows.map(row => ({
        fieldId: row.id,
        fieldName: row.field_key,
        interactions: parseInt(row.interactions) || 0,
        avgTimeSpent: parseFloat(row.avg_time_spent) || 0,
        errorRate: 0, // Placeholder - would need separate error tracking
        abandonmentRate: 0, // Placeholder - would need separate abandonment tracking
        mostCommonErrors: [] // Placeholder - would need error logging
      }));
    } catch (error) {
      logger.error('Failed to get field analytics', { error, formId });
      return [];
    }
  }

  /**
   * Get completion funnel data
   */
  async getCompletionFunnel(formId: string, dateRange: { start: Date; end: Date }): Promise<CompletionFunnelStep[]> {
    try {
      // Get form steps
      const stepsResult = await this.db.query(`
        SELECT position, COUNT(*) as step_count
        FROM form_steps
        WHERE form_id = $1
        GROUP BY position
        ORDER BY position
      `, [formId]);

      if (stepsResult.rows.length === 0) {
        return [];
      }

      const maxStep = Math.max(...stepsResult.rows.map(row => row.position));
      const funnel: CompletionFunnelStep[] = [];

      // Calculate funnel for each step
      for (let step = 1; step <= maxStep; step++) {
        const enteredResult = await this.db.query(`
          SELECT COUNT(DISTINCT id) as count
          FROM form_submissions
          WHERE form_id = $1 
            AND current_step >= $2
            AND created_at BETWEEN $3 AND $4
        `, [formId, step, dateRange.start, dateRange.end]);

        const completedResult = await this.db.query(`
          SELECT COUNT(DISTINCT id) as count
          FROM form_submissions
          WHERE form_id = $1 
            AND $2 = ANY(completed_steps)
            AND created_at BETWEEN $3 AND $4
        `, [formId, step, dateRange.start, dateRange.end]);

        const entered = parseInt(enteredResult.rows[0].count) || 0;
        const completed = parseInt(completedResult.rows[0].count) || 0;
        const dropRate = entered > 0 ? ((entered - completed) / entered) * 100 : 0;

        funnel.push({
          step,
          entered,
          completed,
          dropRate: parseFloat(dropRate.toFixed(2))
        });
      }

      return funnel;
    } catch (error) {
      logger.error('Failed to get completion funnel', { error, formId });
      return [];
    }
  }

  /**
   * Get overview metrics
   */
  private async getOverviewMetrics(formId: string, dateRange: { start: Date; end: Date }) {
    const result = await this.db.query(`
      SELECT 
        COALESCE(SUM(views), 0) as total_views,
        COALESCE(SUM(unique_visitors), 0) as unique_visitors,
        COALESCE(SUM(submissions), 0) as total_submissions,
        COALESCE(SUM(completed_submissions), 0) as completed_submissions,
        COALESCE(AVG(avg_completion_time), 0) as avg_completion_time,
        COALESCE(AVG(abandonment_rate), 0) as bounce_rate
      FROM form_analytics
      WHERE form_id = $1 AND date BETWEEN $2 AND $3
    `, [formId, dateRange.start.toISOString().split('T')[0], dateRange.end.toISOString().split('T')[0]]);

    const row = result.rows[0];
    const totalViews = parseInt(row.total_views) || 0;
    const totalSubmissions = parseInt(row.total_submissions) || 0;
    
    return {
      totalViews,
      uniqueVisitors: parseInt(row.unique_visitors) || 0,
      totalSubmissions,
      completedSubmissions: parseInt(row.completed_submissions) || 0,
      conversionRate: totalViews > 0 ? parseFloat(((totalSubmissions / totalViews) * 100).toFixed(2)) : 0,
      avgCompletionTime: parseFloat(row.avg_completion_time) || 0,
      bounceRate: parseFloat(row.bounce_rate) || 0
    };
  }

  /**
   * Get trend data
   */
  private async getTrendData(formId: string, dateRange: { start: Date; end: Date }) {
    const result = await this.db.query(`
      SELECT 
        date,
        COALESCE(views, 0) as views,
        COALESCE(submissions, 0) as submissions
      FROM form_analytics
      WHERE form_id = $1 AND date BETWEEN $2 AND $3
      ORDER BY date
    `, [formId, dateRange.start.toISOString().split('T')[0], dateRange.end.toISOString().split('T')[0]]);

    return {
      views: result.rows.map(row => ({
        date: row.date,
        value: parseInt(row.views)
      })),
      submissions: result.rows.map(row => ({
        date: row.date,
        value: parseInt(row.submissions)
      }))
    };
  }

  /**
   * Get top traffic sources
   */
  private async getTopTrafficSources(formId: string, dateRange: { start: Date; end: Date }) {
    const result = await this.db.query(`
      SELECT 
        jsonb_each_text(traffic_sources) as source_data
      FROM form_analytics
      WHERE form_id = $1 AND date BETWEEN $2 AND $3
        AND traffic_sources IS NOT NULL
    `, [formId, dateRange.start.toISOString().split('T')[0], dateRange.end.toISOString().split('T')[0]]);

    const sources: Record<string, number> = {};
    
    result.rows.forEach(row => {
      const [source, count] = row.source_data.replace('(', '').replace(')', '').split(',');
      sources[source] = (sources[source] || 0) + parseInt(count);
    });

    return Object.entries(sources)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([source, visits]) => ({
        source,
        visits,
        conversions: 0 // Placeholder - would need additional tracking
      }));
  }

  /**
   * Get device breakdown
   */
  private async getDeviceBreakdown(formId: string, dateRange: { start: Date; end: Date }) {
    const result = await this.db.query(`
      SELECT 
        jsonb_each_text(device_breakdown) as device_data,
        submissions
      FROM form_analytics
      WHERE form_id = $1 AND date BETWEEN $2 AND $3
        AND device_breakdown IS NOT NULL
    `, [formId, dateRange.start.toISOString().split('T')[0], dateRange.end.toISOString().split('T')[0]]);

    const devices: Record<string, { views: number; submissions: number }> = {};
    let totalViews = 0;
    
    result.rows.forEach(row => {
      const [device, views] = row.device_data.replace('(', '').replace(')', '').split(',');
      const viewCount = parseInt(views);
      const submissionCount = parseInt(row.submissions) || 0;
      
      if (!devices[device]) {
        devices[device] = { views: 0, submissions: 0 };
      }
      
      devices[device].views += viewCount;
      devices[device].submissions += submissionCount;
      totalViews += viewCount;
    });

    const breakdown: Record<string, { percentage: number; submissions: number }> = {};
    
    Object.entries(devices).forEach(([device, data]) => {
      breakdown[device] = {
        percentage: totalViews > 0 ? parseFloat(((data.views / totalViews) * 100).toFixed(1)) : 0,
        submissions: data.submissions
      };
    });

    return breakdown;
  }

  /**
   * Calculate date range based on period
   */
  private calculateDateRange(period: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case '24h':
        start.setDate(start.getDate() - 1);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'all':
        start.setFullYear(2020); // Arbitrary far past date
        break;
      default:
        start.setDate(start.getDate() - 30);
    }

    return { start, end };
  }

  /**
   * Parse user agent for device information
   */
  private parseUserAgent(userAgent?: string): { type: string; browser?: string; os?: string } {
    if (!userAgent) {
      return { type: 'unknown' };
    }

    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
    const isTablet = /iPad|Android.*Tablet/.test(userAgent);
    
    let deviceType = 'desktop';
    if (isTablet) deviceType = 'tablet';
    else if (isMobile) deviceType = 'mobile';

    // Simple browser detection
    let browser = 'unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    // Simple OS detection
    let os = 'unknown';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    return { type: deviceType, browser, os };
  }

  /**
   * Extract traffic source from referrer and UTM parameters
   */
  private extractTrafficSource(referrer?: string, utmParams?: Record<string, string>): string {
    // Check UTM parameters first
    if (utmParams?.utm_source) {
      return utmParams.utm_source;
    }

    // Extract from referrer
    if (!referrer || referrer === '') {
      return 'direct';
    }

    try {
      const url = new URL(referrer);
      const domain = url.hostname.toLowerCase();

      if (domain.includes('google')) return 'google';
      if (domain.includes('facebook')) return 'facebook';
      if (domain.includes('twitter')) return 'twitter';
      if (domain.includes('linkedin')) return 'linkedin';
      if (domain.includes('youtube')) return 'youtube';
      
      return 'referral';
    } catch {
      return 'unknown';
    }
  }
}