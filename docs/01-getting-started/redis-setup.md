# Redis Setup Guide for XP System

**Version**: 1.0.0  
**Last Updated**: 2025-01-11  
**Difficulty**: Intermediate

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- Basic understanding of caching concepts
- Access to project repository

## Quick Start

### 1. Using Docker (Recommended)

Create a `docker-compose.redis.yml` file in the project root:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7.2-alpine
    container_name: xp-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    restart: unless-stopped
    networks:
      - xp-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: xp-redis-ui
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis
    networks:
      - xp-network

volumes:
  redis-data:
    driver: local

networks:
  xp-network:
    external: true
```

Start Redis:
```bash
# Create network if not exists
docker network create xp-network

# Start Redis containers
docker-compose -f docker-compose.redis.yml up -d

# Verify Redis is running
docker exec xp-redis redis-cli ping
# Should return: PONG
```

### 2. Redis Configuration

Create `redis/redis.conf`:

```conf
# Basic Configuration
bind 0.0.0.0
protected-mode no
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /data

# Limits
maxclients 10000
maxmemory 2gb
maxmemory-policy allkeys-lru

# Append Only File
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no

# Logging
loglevel notice
logfile ""

# Slow Log
slowlog-log-slower-than 10000
slowlog-max-len 128
```

### 3. Environment Configuration

Update `backend/.env`:

```env
# Redis Configuration
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Cache Settings
ENABLE_CACHE=true
CACHE_MAX_MEMORY=2GB

# TTL Settings (seconds)
CACHE_DEFAULT_TTL=300
CACHE_PREFERENCES_TTL=3600
CACHE_SESSION_TTL=1800
CACHE_HISTORY_TTL=86400
```

### 4. Enable Cache in Application

Edit `backend/src/services/cacheService.ts`:

```typescript
// Remove the hardcoded disable (around line 35)
// Change from:
logger.info('Redis cache disabled - running without cache');
this.isEnabled = false;
this.redis = null;
return;

// To:
if (process.env.REDIS_ENABLED !== 'true') {
  logger.info('Redis cache disabled by configuration');
  this.isEnabled = false;
  return;
}
// Continue with Redis initialization...
```

### 5. Test Redis Connection

Create `test-redis.js`:

```javascript
const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379
});

async function testRedis() {
  try {
    // Test connection
    await redis.ping();
    console.log('✅ Redis connected successfully');

    // Test set/get
    await redis.set('test:key', 'Hello Redis');
    const value = await redis.get('test:key');
    console.log('✅ Set/Get test passed:', value);

    // Test TTL
    await redis.setex('test:ttl', 5, 'Expires in 5 seconds');
    const ttl = await redis.ttl('test:ttl');
    console.log('✅ TTL test passed, expires in:', ttl, 'seconds');

    // Cleanup
    await redis.del('test:key', 'test:ttl');
    
    // Get stats
    const info = await redis.info('memory');
    console.log('✅ Redis memory info:', info.split('\n')[1]);

    process.exit(0);
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
    process.exit(1);
  }
}

testRedis();
```

Run test:
```bash
node test-redis.js
```

## Production Setup

### 1. Redis Sentinel (High Availability)

Create `redis/sentinel.conf`:

```conf
port 26379
sentinel monitor mymaster redis 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel parallel-syncs mymaster 1
sentinel failover-timeout mymaster 10000
```

Add to docker-compose:

```yaml
redis-sentinel:
  image: redis:7.2-alpine
  container_name: xp-redis-sentinel
  ports:
    - "26379:26379"
  volumes:
    - ./redis/sentinel.conf:/etc/redis/sentinel.conf
  command: redis-sentinel /etc/redis/sentinel.conf
  depends_on:
    - redis
  networks:
    - xp-network
```

### 2. Security Configuration

#### Enable Password Authentication

In `redis.conf`:
```conf
requirepass your_secure_password_here
```

Update `.env`:
```env
REDIS_PASSWORD=your_secure_password_here
```

#### Configure ACL Users

Create `redis/users.acl`:
```acl
# Read-only user for monitoring
user monitor on +ping +info +client +config|get ~* &* -@dangerous

# Application user with limited commands
user app on ~* &* +@all -@dangerous -flushdb -flushall -shutdown >app_password

# Admin user
user admin on ~* &* +@all >admin_password
```

### 3. Performance Tuning

#### Memory Optimization

```conf
# redis.conf
maxmemory-policy allkeys-lru
maxmemory-samples 5
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
```

#### Connection Pooling

In application code:
```typescript
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  
  // Connection pool settings
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  
  // Performance settings
  enableOfflineQueue: true,
  connectTimeout: 10000,
  lazyConnect: true
});
```

## Monitoring

### 1. Redis Commander UI

Access at: http://localhost:8081

### 2. Command Line Monitoring

```bash
# Monitor commands in real-time
docker exec xp-redis redis-cli monitor

# Get statistics
docker exec xp-redis redis-cli info stats

# Check memory usage
docker exec xp-redis redis-cli info memory

# View slow queries
docker exec xp-redis redis-cli slowlog get 10
```

### 3. Health Check Endpoint

The application provides cache health at:
```
GET http://localhost:5000/api/admin/cache/stats
```

## Troubleshooting

### Common Issues

#### 1. Connection Refused

```bash
# Check if Redis is running
docker ps | grep redis

# Check logs
docker logs xp-redis

# Test connection
docker exec xp-redis redis-cli ping
```

#### 2. Memory Issues

```bash
# Check memory usage
docker exec xp-redis redis-cli info memory

# Clear all cache (careful!)
docker exec xp-redis redis-cli FLUSHDB

# Set memory limit
docker exec xp-redis redis-cli CONFIG SET maxmemory 2gb
```

#### 3. Performance Issues

```bash
# Check slow log
docker exec xp-redis redis-cli SLOWLOG GET 10

# Monitor commands
docker exec xp-redis redis-cli --latency

# Check connected clients
docker exec xp-redis redis-cli CLIENT LIST
```

## Backup and Restore

### Backup

```bash
# Manual backup
docker exec xp-redis redis-cli BGSAVE

# Copy backup file
docker cp xp-redis:/data/dump.rdb ./backups/dump-$(date +%Y%m%d).rdb
```

### Restore

```bash
# Stop Redis
docker-compose -f docker-compose.redis.yml down

# Replace dump file
docker cp ./backups/dump-20250111.rdb xp-redis:/data/dump.rdb

# Start Redis
docker-compose -f docker-compose.redis.yml up -d
```

## Next Steps

1. ✅ Redis is now ready for development
2. 📖 Read the [Redis Cache API Documentation](../04-api/redis-cache-api.md)
3. 🚀 Check the [Implementation Roadmap](../REDIS_CACHE_IMPLEMENTATION_ROADMAP.md)
4. 🧪 Run performance tests to validate improvements

## Support

For issues or questions:
- Check logs: `docker logs xp-redis`
- Review documentation: [Redis Official Docs](https://redis.io/documentation)
- Contact: DevOps team

---

*This guide is part of the XP System Redis Cache Implementation.*