import { Router } from 'express';
import cacheService from '../services/cacheService';
import cacheWarmingService from '../services/cacheWarmingService';
import cacheInvalidationService from '../services/cacheInvalidationService';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * GET /api/cache/status
 * Get cache service status
 */
router.get('/status', async (req, res) => {
  try {
  const stats = await cacheService.getCacheStats();
  const health = await cacheService.healthCheck();
  
  res.json({
    success: true,
    data: {
      ...stats,
      health,
      config: {
        enabled: process.env.REDIS_ENABLED === 'true',
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        ttl: {
          default: process.env.CACHE_DEFAULT_TTL,
          user: process.env.CACHE_USER_TTL,
          form: process.env.CACHE_FORM_TTL,
          session: process.env.CACHE_SESSION_TTL
        }
      }
    }
  });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Cache status check failed' });
  }
});

/**
 * GET /api/cache/stats
 * Get detailed cache statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await cacheService.getCacheStats();
  const warmingStats = await cacheWarmingService.getWarmingStats();
  const invalidationStats = cacheInvalidationService.getInvalidationStats();
  
  res.json({
    success: true,
    data: {
      cache: stats,
      warming: warmingStats,
      invalidation: invalidationStats
    }
  });
}));

/**
 * POST /api/cache/warm
 * Trigger cache warming (Admin only)
 */
router.post('/warm', 
  authenticate,
  asyncHandler(async (req, res) => {
    await cacheWarmingService.startWarming();
    
    res.json({
      success: true,
      message: 'Cache warming initiated'
    });
  })
);

/**
 * POST /api/cache/warm/user/:userId
 * Warm specific user cache
 */
router.post('/warm/user/:userId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    // Users can only warm their own cache, admins can warm any
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to warm this user cache'
      });
    }
    
    await cacheWarmingService.warmUserCache(parseInt(userId));
    
    res.json({
      success: true,
      message: `Cache warmed for user ${userId}`
    });
  })
);

/**
 * DELETE /api/cache/invalidate/:type
 * Invalidate cache by type (Admin only)
 */
router.delete('/invalidate/:type',
  authenticate,
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { id } = req.query;
    
    await cacheInvalidationService.invalidateByType(type, id as string);
    
    res.json({
      success: true,
      message: `Cache invalidated for type: ${type}${id ? ` with id: ${id}` : ''}`
    });
  })
);

/**
 * DELETE /api/cache/invalidate/user/:userId
 * Invalidate user cache
 */
router.delete('/invalidate/user/:userId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    // Users can only invalidate their own cache, admins can invalidate any
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to invalidate this user cache'
      });
    }
    
    await cacheInvalidationService.invalidateUser(parseInt(userId));
    
    res.json({
      success: true,
      message: `Cache invalidated for user ${userId}`
    });
  })
);

/**
 * DELETE /api/cache/invalidate/form/:formId
 * Invalidate form cache
 */
router.delete('/invalidate/form/:formId',
  authenticate,
  asyncHandler(async (req, res) => {
    const { formId } = req.params;
    
    await cacheInvalidationService.invalidateForm(parseInt(formId));
    
    res.json({
      success: true,
      message: `Cache invalidated for form ${formId}`
    });
  })
);

/**
 * POST /api/cache/refresh
 * Clear and refresh cache (Admin only)
 */
router.post('/refresh',
  authenticate,
  asyncHandler(async (req, res) => {
    await cacheWarmingService.refreshCache();
    
    res.json({
      success: true,
      message: 'Cache refreshed successfully'
    });
  })
);

/**
 * GET /api/cache/health
 * Health check endpoint
 */
router.get('/health', asyncHandler(async (req, res) => {
  const health = await cacheService.healthCheck();
  
  res.status(health.healthy ? 200 : 503).json({
    success: health.healthy,
    data: health
  });
}));

/**
 * GET /api/cache/test
 * Test cache operations (Development only)
 */
if (process.env.NODE_ENV === 'development') {
  router.get('/test', asyncHandler(async (req, res) => {
    const testKey = 'test:cache:' + Date.now();
    const testValue = { message: 'Hello Redis!', timestamp: new Date() };
    
    // Test set
    const setResult = await cacheService.set(testKey, testValue, { ttl: 60 });
    
    // Test get
    const getValue = await cacheService.get(testKey);
    
    // Test exists
    const exists = await cacheService.exists(testKey);
    
    // Test delete
    const deleteResult = await cacheService.del(testKey);
    
    res.json({
      success: true,
      tests: {
        set: setResult,
        get: getValue,
        exists: exists,
        delete: deleteResult
      },
      message: 'Cache operations test completed'
    });
  }));
}

export default router;