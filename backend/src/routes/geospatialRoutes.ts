/**
 * Geospatial Cache Routes
 * RESTful API endpoints for geospatial location caching with Redis GEO commands
 */

import { Router } from 'express';
import { Request, Response } from 'express';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import locationCacheService, { GeospatialQuery } from '../services/locationCacheService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/geo/locations
 * Add a new location with geospatial indexing
 */
router.post('/locations', auth, asyncHandler(async (req: Request, res: Response) => {
  const { latitude, longitude, address, city, country, metadata } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // Validate coordinates
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({
      success: false,
      error: 'Valid latitude and longitude coordinates are required'
    });
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({
      success: false,
      error: 'Invalid coordinate values'
    });
  }

  const locationData = {
    id: `geo_location_${userId}_${Date.now()}`,
    userId,
    latitude,
    longitude,
    address,
    city,
    country,
    metadata: {
      ...metadata,
      timestamp: new Date(),
      source: metadata?.source || 'user'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await locationCacheService.addLocation(locationData);

  logger.info('Geospatial location added successfully', {
    locationId: locationData.id,
    userId,
    coordinates: [latitude, longitude]
  });

  res.status(201).json({
    success: true,
    data: {
      location: locationData,
      message: 'Location added to geospatial index successfully'
    }
  });
}));

/**
 * GET /api/geo/nearby
 * Find nearby locations using geospatial queries
 */
router.get('/nearby', auth, asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng, radius, unit = 'km', limit = 50, includeDistance } = req.query;
  const userId = req.user?.id;

  // Validate required parameters
  if (!lat || !lng || !radius) {
    return res.status(400).json({
      success: false,
      error: 'latitude (lat), longitude (lng), and radius parameters are required'
    });
  }

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lng as string);
  const radiusNum = parseFloat(radius as string);

  if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusNum)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid numeric values for coordinates or radius'
    });
  }

  const query: GeospatialQuery = {
    latitude,
    longitude,
    radius: radiusNum,
    unit: unit as 'km' | 'mi' | 'm',
    limit: parseInt(limit as string) || 50,
    includeDistance: includeDistance === 'true'
  };

  const locations = await locationCacheService.findNearbyLocations(query, userId);

  logger.info('Geospatial nearby locations query executed', {
    userId,
    query,
    resultCount: locations.length
  });

  res.json({
    success: true,
    data: {
      locations,
      query: {
        center: [latitude, longitude],
        radius: radiusNum,
        unit,
        resultsFound: locations.length
      }
    }
  });
}));

/**
 * GET /api/geo/history
 * Get user's location history with geospatial analysis
 */
router.get('/history', auth, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id!;
  const { start, end } = req.query;

  let timeRange: { start: Date; end: Date } | undefined;

  if (start && end) {
    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format for start or end parameters'
      });
    }

    timeRange = { start: startDate, end: endDate };
  }

  const history = await locationCacheService.getUserLocationHistory(userId, timeRange);

  logger.info('Geospatial location history retrieved', {
    userId,
    locationCount: history.locations.length,
    timeRange
  });

  res.json({
    success: true,
    data: {
      history,
      statistics: {
        totalLocations: history.locations.length,
        timeRange: history.timeRange,
        totalDistance: `${(history.totalDistance || 0 / 1000).toFixed(2)} km`,
        averageAccuracy: `${(history.averageAccuracy || 0).toFixed(1)}m`
      }
    }
  });
}));

/**
 * GET /api/geo/clusters
 * Generate and retrieve location clusters using geospatial algorithms
 */
router.get('/clusters', auth, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id!;
  const { minPoints = '3', maxDistance = '200' } = req.query;

  const options = {
    minPoints: parseInt(minPoints as string),
    maxDistance: parseInt(maxDistance as string)
  };

  // Validate options
  if (options.minPoints < 2 || options.minPoints > 50) {
    return res.status(400).json({
      success: false,
      error: 'minPoints must be between 2 and 50'
    });
  }

  if (options.maxDistance < 10 || options.maxDistance > 10000) {
    return res.status(400).json({
      success: false,
      error: 'maxDistance must be between 10 and 10000 meters'
    });
  }

  const clusters = await locationCacheService.generateLocationClusters(userId, options);

  logger.info('Geospatial location clusters generated', {
    userId,
    clusterCount: clusters.length,
    options
  });

  res.json({
    success: true,
    data: {
      clusters,
      statistics: {
        totalClusters: clusters.length,
        options,
        generatedAt: new Date().toISOString()
      }
    }
  });
}));

/**
 * GET /api/geo/popular
 * Get popular places in specified area using geospatial data
 */
router.get('/popular', asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng, radius = '5', limit = '20' } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      error: 'latitude (lat) and longitude (lng) parameters are required'
    });
  }

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lng as string);
  const radiusNum = parseFloat(radius as string);

  if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusNum)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid numeric values for coordinates or radius'
    });
  }

  const query: GeospatialQuery = {
    latitude,
    longitude,
    radius: radiusNum,
    limit: parseInt(limit as string),
    includeDistance: true
  };

  const popularPlaces = await locationCacheService.getPopularPlaces(query);

  res.json({
    success: true,
    data: {
      popularPlaces,
      query: {
        center: [latitude, longitude],
        radius: radiusNum,
        resultsFound: popularPlaces.length
      }
    }
  });
}));

/**
 * DELETE /api/geo/cache
 * Clear geospatial cache for authenticated user
 */
router.delete('/cache', auth, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id!;

  await locationCacheService.invalidateUserLocationCache(userId);

  logger.info('Geospatial cache invalidated', { userId });

  res.json({
    success: true,
    data: {
      message: 'Geospatial cache cleared successfully',
      userId,
      clearedAt: new Date().toISOString()
    }
  });
}));

/**
 * GET /api/geo/cache/stats
 * Get geospatial cache statistics
 */
router.get('/cache/stats', auth, asyncHandler(async (req: Request, res: Response) => {
  const stats = await locationCacheService.getCacheStats();

  res.json({
    success: true,
    data: {
      cacheStats: stats,
      cacheType: 'geospatial',
      capabilities: [
        'Proximity searches',
        'Location clustering',
        'Distance calculations',
        'Geospatial indexing',
        'Popular places discovery'
      ],
      timestamp: new Date().toISOString()
    }
  });
}));

export default router;