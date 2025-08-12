/**
 * Location Cache Service with Geospatial Indexing
 * Provides location-based caching with Redis geospatial commands
 */

import cacheService from './cacheService';
import { logger } from '../utils/logger';
import { createCachedRepository } from './cachedRepositoryService';

// Location types
export interface LocationData {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  country?: string;
  metadata?: {
    accuracy?: number;
    provider?: string;
    timestamp?: Date;
    source?: 'user' | 'gps' | 'ip' | 'manual';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface GeospatialQuery {
  latitude: number;
  longitude: number;
  radius: number; // in kilometers
  unit?: 'km' | 'mi' | 'm';
  limit?: number;
  includeDistance?: boolean;
}

export interface LocationHistory {
  userId: string;
  locations: LocationData[];
  timeRange: {
    start: Date;
    end: Date;
  };
  totalDistance?: number;
  averageAccuracy?: number;
}

export interface LocationCluster {
  id: string;
  centerLat: number;
  centerLng: number;
  radius: number;
  locationCount: number;
  frequentAddresses: string[];
  lastVisited: Date;
}

/**
 * Location Cache Service with Geospatial Capabilities
 */
class LocationCacheService {
  private locationCache = createCachedRepository<LocationData>('locations', {
    ttl: 7200, // 2 hours for location data
    keyPrefix: 'geo:location',
    enableCache: true
  });

  private historyCache = createCachedRepository<LocationHistory>('location_history', {
    ttl: 86400, // 24 hours for history
    keyPrefix: 'geo:history',
    enableCache: true
  });

  private clusterCache = createCachedRepository<LocationCluster>('location_clusters', {
    ttl: 14400, // 4 hours for clusters
    keyPrefix: 'geo:cluster',
    enableCache: true
  });

  // Geospatial cache keys
  private static readonly GEO_KEYS = {
    USER_LOCATIONS: (userId: string) => `geo:user:${userId}`,
    RECENT_LOCATIONS: (userId: string) => `geo:recent:${userId}`,
    LOCATION_CLUSTERS: (userId: string) => `geo:clusters:${userId}`,
    POPULAR_PLACES: 'geo:popular:places',
    CITY_INDEX: (city: string) => `geo:city:${city.toLowerCase()}`,
    COUNTRY_INDEX: (country: string) => `geo:country:${country.toLowerCase()}`
  };

  /**
   * Add location with geospatial indexing
   */
  async addLocation(location: LocationData): Promise<void> {
    try {
      // Cache individual location
      await this.locationCache.getById(
        location.id,
        async () => location
      );

      // Add to user's geospatial set for proximity queries
      const userGeoKey = LocationCacheService.GEO_KEYS.USER_LOCATIONS(location.userId);
      await this.addGeospatialPoint(userGeoKey, location);

      // Add to recent locations (with time-based expiry)
      await this.addToRecentLocations(location);

      // Add to city and country indexes
      if (location.city) {
        const cityKey = LocationCacheService.GEO_KEYS.CITY_INDEX(location.city);
        await this.addGeospatialPoint(cityKey, location);
      }

      if (location.country) {
        const countryKey = LocationCacheService.GEO_KEYS.COUNTRY_INDEX(location.country);
        await this.addGeospatialPoint(countryKey, location);
      }

      // Update popular places if high accuracy
      if (location.metadata?.accuracy && location.metadata.accuracy < 50) {
        await this.updatePopularPlaces(location);
      }

      logger.debug('Location added to geospatial cache', {
        locationId: location.id,
        userId: location.userId,
        coordinates: [location.latitude, location.longitude],
        address: location.address
      });
    } catch (error) {
      logger.error('Failed to add location to cache', { error, location });
    }
  }

  /**
   * Find locations within radius using geospatial queries
   */
  async findNearbyLocations(query: GeospatialQuery, userId?: string): Promise<LocationData[]> {
    try {
      const cacheKey = await this.generateQueryKey(query, userId);
      
      return await this.locationCache.cacheQuery(
        'nearby',
        { query, userId },
        async () => {
          const geoKey = userId 
            ? LocationCacheService.GEO_KEYS.USER_LOCATIONS(userId)
            : LocationCacheService.GEO_KEYS.POPULAR_PLACES;

          const nearbyIds = await this.performGeospatialQuery(geoKey, query);
          
          // Fetch full location data for each ID
          const locations: LocationData[] = [];
          for (const locationId of nearbyIds) {
            const location = await this.locationCache.getById(locationId, async () => {
              // In real implementation, this would fetch from database
              return this.mockLocationData(locationId, userId);
            });
            
            if (location) {
              locations.push(location);
            }
          }

          return locations.slice(0, query.limit || 50);
        },
        1800 // 30 minutes cache for nearby queries
      );
    } catch (error) {
      logger.error('Failed to find nearby locations', { error, query });
      return [];
    }
  }

  /**
   * Get user's location history with caching
   */
  async getUserLocationHistory(userId: string, timeRange?: { start: Date; end: Date }): Promise<LocationHistory> {
    const historyKey = `${userId}:${timeRange?.start.getTime() || 'all'}:${timeRange?.end.getTime() || 'now'}`;
    
    return await this.historyCache.getById(
      historyKey,
      async () => {
        // Mock implementation - would query database in real scenario
        const locations = await this.mockUserLocationHistory(userId, timeRange);
        
        const history: LocationHistory = {
          userId,
          locations,
          timeRange: timeRange || {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
            end: new Date()
          },
          totalDistance: this.calculateTotalDistance(locations),
          averageAccuracy: this.calculateAverageAccuracy(locations)
        };

        return history;
      }
    );
  }

  /**
   * Generate location clusters for user
   */
  async generateLocationClusters(userId: string, options: {
    minPoints?: number;
    maxDistance?: number; // in meters
  } = {}): Promise<LocationCluster[]> {
    const clusterKey = `${userId}:${options.minPoints || 3}:${options.maxDistance || 200}`;
    
    return await this.clusterCache.cacheQuery(
      'clusters',
      { userId, options },
      async () => {
        const history = await this.getUserLocationHistory(userId);
        const clusters = this.performLocationClustering(history.locations, options);
        
        // Cache individual clusters
        for (const cluster of clusters) {
          await this.clusterCache.getById(cluster.id, async () => cluster);
        }

        logger.debug('Generated location clusters', {
          userId,
          clusterCount: clusters.length,
          locationCount: history.locations.length
        });

        return clusters;
      },
      3600 // 1 hour cache for clusters
    );
  }

  /**
   * Get popular places in area
   */
  async getPopularPlaces(query: GeospatialQuery): Promise<LocationData[]> {
    return await this.findNearbyLocations(query);
  }

  /**
   * Invalidate location cache for user
   */
  async invalidateUserLocationCache(userId: string): Promise<void> {
    const patterns = [
      LocationCacheService.GEO_KEYS.USER_LOCATIONS(userId),
      LocationCacheService.GEO_KEYS.RECENT_LOCATIONS(userId),
      LocationCacheService.GEO_KEYS.LOCATION_CLUSTERS(userId)
    ];

    await Promise.all([
      this.locationCache.invalidatePattern(`${userId}:*`),
      this.historyCache.invalidatePattern(`${userId}:*`),
      this.clusterCache.invalidatePattern(`${userId}:*`),
      ...patterns.map(pattern => cacheService.del(pattern))
    ]);

    logger.info('Invalidated location cache for user', { userId });
  }

  /**
   * Get location cache statistics
   */
  async getCacheStats(): Promise<{
    locations: any;
    history: any;
    clusters: any;
    geospatialKeys: number;
  }> {
    const [locationStats, historyStats, clusterStats] = await Promise.all([
      this.locationCache.getCacheStats(),
      this.historyCache.getCacheStats(),
      this.clusterCache.getCacheStats()
    ]);

    // Mock geospatial key count
    const geospatialKeys = 150; // Would count actual Redis GEO keys

    return {
      locations: locationStats,
      history: historyStats,
      clusters: clusterStats,
      geospatialKeys
    };
  }

  // Private helper methods

  private async addGeospatialPoint(geoKey: string, location: LocationData): Promise<void> {
    // In real Redis implementation, would use GEOADD command
    // await redis.geoadd(geoKey, location.longitude, location.latitude, location.id);
    
    // Mock implementation using regular cache
    const pointData = {
      id: location.id,
      lat: location.latitude,
      lng: location.longitude,
      timestamp: new Date()
    };

    await cacheService.set(`${geoKey}:${location.id}`, pointData, { ttl: 7200 });
  }

  private async addToRecentLocations(location: LocationData): Promise<void> {
    const recentKey = LocationCacheService.GEO_KEYS.RECENT_LOCATIONS(location.userId);
    
    // Get existing recent locations
    const recent = await cacheService.get<LocationData[]>(recentKey) || [];
    
    // Add new location at the beginning
    recent.unshift(location);
    
    // Keep only last 50 locations
    const trimmed = recent.slice(0, 50);
    
    await cacheService.set(recentKey, trimmed, { ttl: 86400 }); // 24 hours
  }

  private async updatePopularPlaces(location: LocationData): Promise<void> {
    const popularKey = LocationCacheService.GEO_KEYS.POPULAR_PLACES;
    await this.addGeospatialPoint(popularKey, location);
  }

  private async performGeospatialQuery(geoKey: string, query: GeospatialQuery): Promise<string[]> {
    // Mock implementation - in Redis would use GEORADIUS or GEORADIUSBYMEMBER
    const { latitude, longitude, radius } = query;
    
    // For demonstration, return mock location IDs
    const mockResults = [
      `location_${Date.now()}_1`,
      `location_${Date.now()}_2`,
      `location_${Date.now()}_3`
    ];

    logger.debug('Performed geospatial query', {
      geoKey,
      center: [latitude, longitude],
      radius,
      resultCount: mockResults.length
    });

    return mockResults;
  }

  private async generateQueryKey(query: GeospatialQuery, userId?: string): Promise<string> {
    const queryData = { ...query, userId };
    const queryString = JSON.stringify(queryData);
    
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < queryString.length; i++) {
      const char = queryString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `query_${Math.abs(hash)}`;
  }

  private performLocationClustering(locations: LocationData[], options: {
    minPoints?: number;
    maxDistance?: number;
  }): LocationCluster[] {
    // Simple clustering algorithm mock
    const { minPoints = 3, maxDistance = 200 } = options;
    const clusters: LocationCluster[] = [];

    // Group nearby locations (simplified implementation)
    const processed = new Set<string>();
    
    for (const location of locations) {
      if (processed.has(location.id)) continue;

      const cluster: LocationCluster = {
        id: `cluster_${Date.now()}_${location.id}`,
        centerLat: location.latitude,
        centerLng: location.longitude,
        radius: maxDistance,
        locationCount: 1,
        frequentAddresses: location.address ? [location.address] : [],
        lastVisited: location.createdAt
      };

      processed.add(location.id);
      
      // Find nearby locations for this cluster
      for (const other of locations) {
        if (processed.has(other.id)) continue;
        
        const distance = this.calculateDistance(
          location.latitude, location.longitude,
          other.latitude, other.longitude
        );

        if (distance <= maxDistance) {
          cluster.locationCount++;
          if (other.address && !cluster.frequentAddresses.includes(other.address)) {
            cluster.frequentAddresses.push(other.address);
          }
          if (other.createdAt > cluster.lastVisited) {
            cluster.lastVisited = other.createdAt;
          }
          processed.add(other.id);
        }
      }

      if (cluster.locationCount >= minPoints) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private calculateTotalDistance(locations: LocationData[]): number {
    if (locations.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
      totalDistance += this.calculateDistance(
        locations[i-1].latitude, locations[i-1].longitude,
        locations[i].latitude, locations[i].longitude
      );
    }

    return totalDistance;
  }

  private calculateAverageAccuracy(locations: LocationData[]): number {
    const accuracies = locations
      .map(l => l.metadata?.accuracy)
      .filter((acc): acc is number => acc !== undefined);
    
    if (accuracies.length === 0) return 0;
    
    return accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
  }

  private async mockLocationData(locationId: string, userId?: string): Promise<LocationData> {
    // Mock location data for demonstration
    const baseCoords = { lat: 10.8231, lng: 106.6297 }; // Ho Chi Minh City
    const randomOffset = () => (Math.random() - 0.5) * 0.1;

    return {
      id: locationId,
      userId: userId || `user_${Math.floor(Math.random() * 1000)}`,
      latitude: baseCoords.lat + randomOffset(),
      longitude: baseCoords.lng + randomOffset(),
      address: `${Math.floor(Math.random() * 500)} Nguyen Hue Street, District 1`,
      city: 'Ho Chi Minh City',
      country: 'Vietnam',
      metadata: {
        accuracy: Math.floor(Math.random() * 100) + 10,
        provider: 'gps',
        timestamp: new Date(),
        source: 'user'
      },
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    };
  }

  private async mockUserLocationHistory(userId: string, timeRange?: { start: Date; end: Date }): Promise<LocationData[]> {
    // Generate mock location history
    const locations: LocationData[] = [];
    const count = Math.floor(Math.random() * 20) + 10; // 10-30 locations

    for (let i = 0; i < count; i++) {
      const location = await this.mockLocationData(`${userId}_location_${i}`, userId);
      locations.push(location);
    }

    return locations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

// Export singleton instance
export const locationCacheService = new LocationCacheService();
export default locationCacheService;