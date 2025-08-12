# Cache System Documentation

## Overview

The XP Project implements a sophisticated dual-mode caching system that automatically switches between Redis (when available) and an in-memory fallback cache. This ensures optimal performance in production while maintaining full functionality in development environments.

## Architecture

### Dual-Mode Operation

```
┌─────────────────┐
│   Application   │
└────────┬────────┘
         │
    ┌────▼────┐
    │  Cache  │
    │ Service │
    └────┬────┘
         │
    ┌────▼────────────┐
    │ Redis Available?│
    └────┬──────┬─────┘
         │      │
      Yes│      │No
         │      │
    ┌────▼──┐ ┌─▼──────┐
    │ Redis │ │ Memory │
    │ Cache │ │ Cache  │
    └───────┘ └────────┘
```

### Components

1. **Cache Service** (`cacheService.ts`)
   - Main interface for all cache operations
   - Automatic mode detection and switching
   - Consistent API regardless of backend

2. **Memory Cache** (`memoryCache.ts`)
   - In-memory fallback implementation
   - Redis-compatible API
   - LRU eviction and TTL support

3. **Cache Warming** (`cacheWarmingService.ts`)
   - Pre-loads frequently accessed data
   - Scheduled warming every 30 minutes
   - User-specific cache warming

4. **Cache Invalidation** (`cacheInvalidationService.ts`)
   - Pattern-based invalidation
   - Dependency tracking
   - Cascade invalidation

5. **Session Cache** (`sessionCacheService.ts`)
   - High-performance session management
   - User data caching
   - Multi-session support

## Installation

### Redis Installation Options

#### Option 1: Docker (Recommended)
```bash
docker-compose -f docker-compose.redis.yml up -d
```

#### Option 2: Native Installation (Linux/WSL)
```bash
sudo apt update
sudo apt install redis-server
sudo service redis-server start
```

#### Option 3: Windows (Memurai)
1. Download from [memurai.com](https://www.memurai.com)
2. Install as Windows service
3. Starts automatically on port 6379

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
ENABLE_CACHE=true

# Cache TTL Settings (seconds)
CACHE_DEFAULT_TTL=300
CACHE_PREFERENCES_TTL=3600
CACHE_SESSION_TTL=1800
CACHE_HISTORY_TTL=86400
CACHE_API_TTL=300
CACHE_USER_TTL=600
CACHE_FORM_TTL=3600
```

### Redis Configuration

The system includes production-ready Redis configuration files:

- `redis.conf` - Main server configuration
- `sentinel-*.conf` - High Availability setup
- Memory limit: 2GB with LRU eviction
- Persistence: RDB + AOF enabled

## API Endpoints

### Cache Status
```http
GET /api/cache/status
```
Returns current cache service status and configuration.

### Cache Statistics
```http
GET /api/cache/stats
```
Returns detailed statistics including hit rates and memory usage.

### Cache Warming
```http
POST /api/cache/warm
```
Triggers manual cache warming (Admin only).

### Cache Invalidation
```http
DELETE /api/cache/invalidate/:type
```
Invalidates cache by type (Admin only).

### Health Check
```http
GET /api/cache/health
```
Returns cache service health status.

## Usage Examples

### Basic Operations

```typescript
import cacheService from './services/cacheService';

// Set value
await cacheService.set('user:123', userData, { ttl: 3600 });

// Get value
const user = await cacheService.get('user:123');

// Check existence
const exists = await cacheService.exists('user:123');

// Delete
await cacheService.del('user:123');
```

### Cache Warming

```typescript
import cacheWarmingService from './services/cacheWarmingService';

// Start automatic warming
await cacheWarmingService.startWarming();

// Warm specific user
await cacheWarmingService.warmUserCache(userId);
```

### Cache Invalidation

```typescript
import cacheInvalidationService from './services/cacheInvalidationService';

// Invalidate by type
await cacheInvalidationService.invalidateByType('user', userId);

// Invalidate form cache
await cacheInvalidationService.invalidateForm(formId);
```

## Performance Metrics

### Without Cache
- API Response: 200-500ms
- Database queries: Direct hits
- Startup time: 25-30 seconds

### With Memory Cache (Fallback)
- API Response: 50-100ms
- Memory limited: ~10MB
- Startup time: 41ms

### With Redis Cache
- API Response: 20-50ms
- Unlimited data (2GB limit)
- Startup time: 41ms
- Persistence enabled

## Cache Strategies

### Cache-Aside Pattern
The system implements cache-aside pattern:
1. Check cache for data
2. If miss, fetch from database
3. Update cache with fetched data
4. Return data to client

### TTL Strategy
Different data types have optimized TTL values:
- User sessions: 30 minutes
- User preferences: 1 hour
- Form data: 1 hour
- API responses: 5 minutes
- Historical data: 24 hours

### Invalidation Strategy
- **User updates**: Invalidate user and session caches
- **Form updates**: Invalidate form and submission caches
- **System changes**: Invalidate all dependent caches

## Monitoring

### Key Metrics
- Cache hit rate
- Memory usage
- Operation latency
- Error rates

### Health Checks
The system provides automatic health checks:
- Redis connectivity
- Memory usage limits
- Operation timeouts
- Fallback activation

## Troubleshooting

### Redis Connection Issues
```bash
# Check Redis status
redis-cli ping

# Check logs
tail -f /var/log/redis/redis-server.log

# Test connection
node test-redis-connection.js
```

### Memory Cache Limitations
- Limited to ~10MB data
- No persistence (lost on restart)
- Single server only

### Performance Issues
1. Check cache hit rate
2. Review TTL settings
3. Monitor memory usage
4. Enable cache warming

## Best Practices

1. **Always use cache for read-heavy operations**
2. **Implement proper invalidation on writes**
3. **Monitor cache hit rates**
4. **Set appropriate TTL values**
5. **Use cache warming for critical data**
6. **Handle cache failures gracefully**

## Migration Guide

### From No Cache to Cache
1. Install Redis or use memory fallback
2. Set environment variables
3. Restart backend
4. Monitor performance improvements

### From Memory to Redis
1. Install Redis server
2. System auto-detects and switches
3. No code changes required
4. Data persistence enabled

## Performance Benchmarks

Run benchmarks to measure cache performance:
```bash
npx tsx run-cache-benchmark.ts
```

Expected improvements:
- User fetch: 90% faster
- Form fetch: 90% faster
- Complex queries: 85% faster
- Session lookup: 90% faster

## Security Considerations

1. **No sensitive data in cache keys**
2. **Encrypted Redis connection in production**
3. **Access control on cache endpoints**
4. **Regular cache invalidation**
5. **Monitoring for cache poisoning**

## Future Enhancements

- [ ] Redis Cluster support
- [ ] Distributed cache synchronization
- [ ] Advanced analytics dashboard
- [ ] Machine learning-based warming
- [ ] GraphQL query caching

---

For implementation details, see:
- [Redis Implementation Roadmap](../../REDIS_CACHE_IMPLEMENTATION_ROADMAP.md)
- [Performance Improvements](../../PERFORMANCE_IMPROVEMENTS.md)
- [Implementation Status](../../REDIS_IMPLEMENTATION_PHASE1_COMPLETE.md)