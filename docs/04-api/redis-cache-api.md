# Redis Cache API Documentation

**Version**: 1.0.0  
**Last Updated**: 2025-01-11  
**Status**: Implementation Pending

## Overview

This document describes the Redis Cache API endpoints and integration points for the XP system.

## Cache Management API

### Get Cache Statistics

```http
GET /api/admin/cache/stats
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "redis": {
      "isEnabled": true,
      "connected": true,
      "keyCount": 1234,
      "memoryUsed": "45.2MB",
      "uptime": "5d 3h 21m"
    },
    "performance": {
      "hits": 45678,
      "misses": 5432,
      "hitRate": "89.37%",
      "l1HitRate": "65.23%",
      "l2HitRate": "24.14%"
    },
    "memory": {
      "used": "1.2GB",
      "peak": "1.8GB",
      "fragmentation": 1.23
    }
  }
}
```

### Clear Cache

```http
POST /api/admin/cache/clear
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "pattern": "user:*",  // Optional: specific pattern to clear
  "confirm": true       // Required for safety
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared successfully",
  "keysDeleted": 234
}
```

### Warm Cache

```http
POST /api/admin/cache/warm
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "targets": ["forms", "users", "sessions"],
  "limit": 100  // Max items per target
}
```

**Response:**
```json
{
  "success": true,
  "warmed": {
    "forms": 20,
    "users": 100,
    "sessions": 45
  }
}
```

## Cache Headers

All cached API responses include these headers:

| Header | Values | Description |
|--------|--------|-------------|
| X-Cache | HIT/MISS | Cache status |
| X-Cache-TTL | seconds | Time to live |
| X-Cache-Key | string | Cache key used |
| Cache-Control | directives | Standard cache control |

## Cached Endpoints

### Forms API

| Endpoint | TTL | Cache Key Pattern |
|----------|-----|-------------------|
| GET /api/forms | 600s | `api:/api/forms:{userId}` |
| GET /api/forms/:id | 3600s | `form:{formId}` |
| GET /api/forms/:id/submissions | 300s | `form:{formId}:submissions:{page}` |

### User API

| Endpoint | TTL | Cache Key Pattern |
|----------|-----|-------------------|
| GET /api/users/:id | 300s | `user:{userId}` |
| GET /api/users/:id/preferences | 3600s | `user:{userId}:preferences` |
| GET /api/users/:id/sessions | 1800s | `user:{userId}:sessions` |

### Location API

| Endpoint | TTL | Cache Key Pattern |
|----------|-----|-------------------|
| GET /api/locations/recent | 300s | `location:recent:{userId}` |
| GET /api/locations/history | 1800s | `location:history:{userId}:{hash}` |

## Cache Invalidation Events

### Automatic Invalidation

These events trigger automatic cache invalidation:

```javascript
// Form Updates
onFormUpdate(formId) → Invalidates:
  - form:{formId}
  - api:/api/forms*
  - user:*:forms

// User Updates  
onUserUpdate(userId) → Invalidates:
  - user:{userId}
  - user:{userId}:*
  - session:*:{userId}

// Submission Changes
onSubmissionChange(formId) → Invalidates:
  - form:{formId}:submissions:*
  - form:{formId}:stats
```

### Manual Invalidation

```javascript
// JavaScript SDK
await cache.invalidate('user:123');
await cache.invalidatePattern('form:*');

// REST API
POST /api/cache/invalidate
{
  "keys": ["user:123", "form:456"]
}
```

## Configuration

### Environment Variables

```env
# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0

# Cache Settings
ENABLE_CACHE=true
CACHE_MAX_MEMORY=2GB
CACHE_DEFAULT_TTL=300

# TTL Settings (seconds)
CACHE_API_TTL=300
CACHE_USER_TTL=600
CACHE_FORM_TTL=3600
CACHE_SESSION_TTL=1800
```

### Cache Middleware Usage

```typescript
// Apply cache to route
app.get('/api/forms', 
  authenticate,
  cacheMiddleware(600), // 10 minutes TTL
  formController.getForms
);

// Custom cache key
app.get('/api/data',
  cacheMiddleware({
    ttl: 300,
    keyGenerator: (req) => `custom:${req.user.id}:${req.query.filter}`
  }),
  controller.getData
);
```

## Performance Metrics

### Expected Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API Response (p95) | 500ms | 50ms | 90% |
| Database Queries | 1000/min | 300/min | 70% |
| Concurrent Users | 100 | 1000+ | 10x |
| Cache Hit Rate | 0% | 85%+ | - |

### Monitoring Endpoints

```http
# Prometheus metrics
GET /metrics

# Health check including cache
GET /health/cache
```

## Error Handling

### Cache Failures

When Redis is unavailable, the system falls back to direct database queries:

```json
{
  "success": true,
  "data": {...},
  "warning": "Cache unavailable, using fallback",
  "headers": {
    "X-Cache": "BYPASS",
    "X-Cache-Status": "degraded"
  }
}
```

### Common Error Codes

| Code | Message | Description |
|------|---------|-------------|
| CACHE_001 | Cache connection failed | Redis not available |
| CACHE_002 | Cache key too long | Key exceeds 512 chars |
| CACHE_003 | Cache memory full | Eviction in progress |
| CACHE_004 | Invalid cache pattern | Pattern syntax error |

## Security Considerations

1. **ACL Users**: Separate Redis users for read/write operations
2. **Key Namespacing**: Prevent key collisions with prefixes
3. **TTL Limits**: Maximum TTL of 24 hours for sensitive data
4. **PII Handling**: Location data cached with 5-minute TTL only
5. **Encryption**: At-rest encryption for production Redis

## Best Practices

1. **Key Naming**: Use consistent patterns like `{type}:{id}:{attribute}`
2. **TTL Strategy**: Shorter TTL for frequently changing data
3. **Batch Operations**: Use pipeline for multiple cache operations
4. **Monitoring**: Track hit rates and adjust TTL accordingly
5. **Warming**: Pre-populate cache during low-traffic periods

---

## Related Documentation

- [Redis Implementation Roadmap](../REDIS_CACHE_IMPLEMENTATION_ROADMAP.md)
- [System Architecture](../02-architecture/system-architecture.md)
- [Performance Guide](../09-reports/performance/)