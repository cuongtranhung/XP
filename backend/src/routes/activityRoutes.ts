// Activity Routes - User Activity Logs API
// Date: 2025-08-04

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getClient } from '../utils/database';
const { MinimalActivityLogger } = require('../services/minimalActivityLogger');

const router = Router();

// GET /api/activity/my-logs - Get current user's activity logs
router.get('/my-logs', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Check if activity logging is enabled
    if (!MinimalActivityLogger.isEnabled()) {
      // Return empty data when UAL is disabled
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      
      return res.json({
        success: true,
        data: {
          logs: [],
          total: 0,
          page,
          limit,
          pages: 0
        }
      });
    }

    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50); // Max 50 per page
    const offset = (page - 1) * limit;
    const actionType = req.query.action_type as string;
    const actionCategory = req.query.action_category as string;
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;

    // Build WHERE clause
    const whereConditions = ['user_id = $1'];
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (actionType) {
      whereConditions.push(`action_type = $${paramIndex}`);
      queryParams.push(actionType);
      paramIndex++;
    }

    if (actionCategory) {
      whereConditions.push(`action_category = $${paramIndex}`);
      queryParams.push(actionCategory);
      paramIndex++;
    }

    if (dateFrom) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get database client and ensure it's released
    let client: any = null;
    try {
      client = await getClient();
      
      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM user_activity_logs WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const dataQuery = `
        SELECT 
          id, user_id, session_id, action_type, action_category,
          endpoint, method, response_status, ip_address, user_agent,
          processing_time_ms, metadata, created_at
        FROM user_activity_logs 
        WHERE ${whereClause}
        ORDER BY created_at DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(limit, offset);
      const dataResult = await client.query(dataQuery, queryParams);

      const pages = Math.ceil(total / limit);

      return res.json({
        success: true,
        data: {
          logs: dataResult.rows,
          total,
          page,
          limit,
          pages
        }
      });
    } finally {
      // CRITICAL: Always release the client back to the pool
      if (client?.release) {
        client.release();
      }
    }

  } catch (error) {
    console.error('Get user activity logs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs'
    });
  }
});

// GET /api/activity/recent - Get recent activity for current user (last 10)
router.get('/recent', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Check if activity logging is enabled
    if (!MinimalActivityLogger.isEnabled()) {
      // Return empty data when UAL is disabled
      return res.json({
        success: true,
        data: {
          logs: [],
          total: 0,
          page: 1,
          limit: 10,
          pages: 1
        }
      });
    }

    const query = `
      SELECT 
        id, user_id, session_id, action_type, action_category,
        endpoint, method, response_status, ip_address, user_agent,
        processing_time_ms, metadata, created_at
      FROM user_activity_logs 
      WHERE user_id = $1
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    
    let client: any = null;
    try {
      client = await getClient();
      const result = await client.query(query, [userId]);

      return res.json({
        success: true,
        data: {
          logs: result.rows,
          total: result.rows.length,
          page: 1,
          limit: 10,
          pages: 1
        }
      });
    } finally {
      // CRITICAL: Always release the client back to the pool
      if (client?.release) {
        client.release();
      }
    }

  } catch (error) {
    console.error('Get recent activity error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity'
    });
  }
});

export default router;