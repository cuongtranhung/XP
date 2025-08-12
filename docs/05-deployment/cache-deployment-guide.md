# Cache System Deployment Guide

This guide covers deployment scenarios for the XP Project's caching system across different environments.

## Quick Start

### Development Environment

The system works out-of-the-box with Memory Cache fallback:

```bash
# 1. Start backend (cache auto-enables with memory fallback)
npm run dev

# 2. Verify cache status
curl http://localhost:5000/api/cache/health
# Returns: {"healthy": true, "type": "memory"}
```

**No Redis required** - the system automatically falls back to memory caching.

### Production with Redis

```bash
# 1. Install Redis
sudo apt install redis-server

# 2. Start Redis
sudo service redis-server start

# 3. Start backend (auto-detects Redis)
npm start

# 4. Verify Redis cache
curl http://localhost:5000/api/cache/health
# Returns: {"healthy": true, "type": "redis"}
```

## Installation Options

### Option 1: Docker Deployment (Recommended)

#### 1. Single Redis Instance
```bash
# Start Redis with persistence
docker run -d \
  --name xp-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7.2-alpine redis-server --appendonly yes
```

#### 2. High Availability Setup
```bash
# Use provided Docker Compose
docker-compose -f docker-compose.redis.yml up -d

# Includes:
# - Redis master + 2 replicas
# - 3 Sentinel instances for HA
# - Redis Commander UI (port 8081)
# - Persistent volumes
```

#### 3. Full Application Stack
```bash
# Start entire application with cache
docker-compose up -d

# Services:
# - Backend with optimized startup
# - Frontend
# - PostgreSQL database
# - Redis with HA
# - Monitoring tools
```

### Option 2: Native Installation

#### Ubuntu/Debian (WSL)
```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Configure
sudo cp ./redis/redis.conf /etc/redis/redis.conf

# Start service
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify
redis-cli ping  # Should return PONG
```

#### CentOS/RHEL
```bash
# Install Redis
sudo dnf install redis

# Configure and start
sudo systemctl enable redis
sudo systemctl start redis
```

### Option 3: Windows

#### Memurai (Recommended for Windows)
1. Download from [memurai.com](https://www.memurai.com)
2. Install as Windows service
3. Starts automatically on port 6379
4. Compatible with Redis clients

#### Redis Windows Port (Legacy)
1. Download from [GitHub releases](https://github.com/microsoftarchive/redis/releases)
2. Extract to `C:\Redis`
3. Run `redis-server.exe`

## Environment Configuration

### Environment Variables

Create or update `.env` file:

```env
# Cache Configuration
REDIS_ENABLED=true
ENABLE_CACHE=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Cache TTL Settings (seconds)
CACHE_DEFAULT_TTL=300
CACHE_PREFERENCES_TTL=3600
CACHE_SESSION_TTL=1800
CACHE_HISTORY_TTL=86400
CACHE_API_TTL=300
CACHE_USER_TTL=600
CACHE_FORM_TTL=3600

# Performance Settings
NODE_ENV=production
LOG_LEVEL=info
```

### Production Environment Variables

```env
# Production Redis Configuration
REDIS_ENABLED=true
REDIS_HOST=your-redis-server
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0

# Connection Pool Settings
REDIS_MAX_RETRIES=3
REDIS_CONNECT_TIMEOUT=5000
REDIS_COMMAND_TIMEOUT=2000

# Security
REDIS_TLS=true  # If using TLS
REDIS_KEY_PREFIX=xp:prod:

# Performance
REDIS_MAX_MEMORY=2gb
REDIS_EVICTION_POLICY=allkeys-lru
```

## Deployment Scenarios

### Scenario 1: Development

**Requirements**: Memory cache only
**Setup**: Zero configuration needed

```bash
git clone <repo>
cd backend
npm install
npm run dev
```

**Characteristics**:
- ✅ Instant setup
- ✅ No external dependencies  
- ⚠️ Data lost on restart
- ⚠️ Limited to ~10MB

### Scenario 2: Staging

**Requirements**: Redis for realistic testing
**Setup**: Single Redis instance

```bash
# Install Redis
docker run -d -p 6379:6379 redis:7.2-alpine

# Start application
REDIS_ENABLED=true npm start
```

**Characteristics**:
- ✅ Full Redis features
- ✅ Data persistence
- ✅ Realistic performance
- ⚠️ Single point of failure

### Scenario 3: Production

**Requirements**: High availability Redis
**Setup**: Redis Sentinel cluster

```bash
# Deploy Redis HA cluster
docker-compose -f docker-compose.redis.yml up -d

# Verify sentinel
redis-cli -p 26379 sentinel masters

# Start application with HA config
NODE_ENV=production npm start
```

**Characteristics**:
- ✅ High availability
- ✅ Automatic failover
- ✅ Data persistence
- ✅ Monitoring included

### Scenario 4: Cloud Deployment

**Requirements**: Managed Redis service

#### AWS ElastiCache
```env
REDIS_HOST=your-elasticache-cluster.cache.amazonaws.com
REDIS_PORT=6379
REDIS_TLS=true
```

#### Azure Cache for Redis
```env
REDIS_HOST=your-cache.redis.cache.windows.net
REDIS_PORT=6380
REDIS_PASSWORD=your-access-key
REDIS_TLS=true
```

#### Google Cloud Memorystore
```env
REDIS_HOST=your-memorystore-ip
REDIS_PORT=6379
REDIS_AUTH_TOKEN=your-auth-token
```

## Performance Optimization

### Redis Configuration

#### Memory Optimization
```bash
# redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# Persistence (choose one)
save 900 1    # RDB snapshots
appendonly yes # AOF logging
```

#### Network Optimization
```bash
# redis.conf
tcp-keepalive 300
timeout 0
tcp-backlog 511
```

#### Performance Tuning
```bash
# Linux kernel optimizations
echo 'vm.overcommit_memory = 1' >> /etc/sysctl.conf
echo 'net.core.somaxconn = 65535' >> /etc/sysctl.conf
sysctl -p
```

### Application Configuration

#### Connection Pool Settings
```typescript
// cacheService.ts configuration
const redisConfig = {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  connectTimeout: 5000,
  commandTimeout: 2000,
  lazyConnect: false,
  keepAlive: 30000,
};
```

#### Memory Cache Settings
```typescript
// memoryCache.ts configuration
const memoryConfig = {
  maxEntries: 10000,
  cleanupInterval: 60000, // 1 minute
  defaultTTL: 300, // 5 minutes
  maxSize: '50MB'
};
```

## Monitoring Setup

### Health Check Endpoints

```bash
# Cache service health
curl http://localhost:5000/api/cache/health

# Detailed statistics  
curl http://localhost:5000/api/cache/stats

# Cache status
curl http://localhost:5000/api/cache/status
```

### Redis Monitoring

#### Redis Commander (Web UI)
```bash
# Included in Docker setup
# Access: http://localhost:8081
# Login with Redis credentials
```

#### Command Line Monitoring
```bash
# Real-time monitoring
redis-cli monitor

# Statistics
redis-cli info stats

# Memory usage
redis-cli info memory

# Connected clients
redis-cli info clients
```

### Application Metrics

```typescript
// Custom metrics endpoint
app.get('/api/metrics', async (req, res) => {
  const metrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cache: await cacheService.getCacheStats(),
    performance: await getPerformanceMetrics()
  };
  res.json(metrics);
});
```

## Troubleshooting

### Common Issues

#### 1. Redis Connection Failed
```bash
# Check Redis is running
redis-cli ping

# Check network connectivity
telnet localhost 6379

# Check logs
tail -f /var/log/redis/redis-server.log
```

**Solution**: Verify Redis service is running and network is accessible.

#### 2. Cache Not Working
```bash
# Check environment variables
echo $REDIS_ENABLED
echo $ENABLE_CACHE

# Test cache endpoints
curl http://localhost:5000/api/cache/test
```

**Solution**: Ensure environment variables are set correctly.

#### 3. Memory Cache Performance
```bash
# Check memory usage
curl http://localhost:5000/api/cache/stats
```

**Solution**: Install Redis for better performance and unlimited capacity.

#### 4. High Memory Usage
```bash
# Check Redis memory
redis-cli info memory

# Check cache hit rate
curl http://localhost:5000/api/cache/stats
```

**Solution**: Adjust TTL values or implement better cache invalidation.

### Performance Issues

#### Slow Cache Operations
1. **Check Redis latency**: `redis-cli --latency`
2. **Monitor network**: Check network latency between app and Redis
3. **Optimize queries**: Review cache key patterns
4. **Scale Redis**: Consider Redis Cluster for high load

#### Low Hit Rate
1. **Review TTL settings**: Increase TTL for stable data
2. **Implement warming**: Use cache warming for frequently accessed data
3. **Check invalidation**: Ensure invalidation isn't too aggressive
4. **Monitor patterns**: Analyze access patterns

### Debug Mode

Enable detailed logging:

```env
NODE_ENV=development
LOG_LEVEL=debug
REDIS_LOG_LEVEL=verbose
```

## Backup and Recovery

### Redis Backup

#### Automatic Backups (RDB)
```bash
# redis.conf
save 900 1
save 300 10
save 60 10000

# Manual backup
redis-cli bgsave
```

#### Manual Backup
```bash
# Backup Redis data
cp /var/lib/redis/dump.rdb /backup/dump-$(date +%Y%m%d).rdb

# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
redis-cli bgsave
cp /var/lib/redis/dump.rdb "/backup/redis-backup-$DATE.rdb"
```

### Recovery

#### From RDB Backup
```bash
# Stop Redis
sudo service redis-server stop

# Restore backup
cp /backup/dump-20250111.rdb /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb

# Start Redis
sudo service redis-server start
```

#### Cache Warming After Recovery
```bash
# Warm cache after recovery
curl -X POST http://localhost:5000/api/cache/warm
```

## Scaling Strategies

### Vertical Scaling

#### Single Instance Optimization
- Increase Redis memory (up to 25GB recommended)
- Use faster storage (SSD/NVMe)
- Optimize network (10Gbps+)
- Tune kernel parameters

### Horizontal Scaling

#### Redis Cluster
```bash
# Create 6-node cluster (3 masters + 3 replicas)
docker run -d --name redis-cluster \
  -p 7000-7005:7000-7005 \
  grokzen/redis-cluster:7.0.0
```

#### Application Instances
```bash
# Scale application instances
docker-compose up --scale app=3

# Load balancer configuration
upstream backend {
    server app1:5000;
    server app2:5000;
    server app3:5000;
}
```

## Security Hardening

### Redis Security

```bash
# redis.conf security settings
requirepass your-strong-password
protected-mode yes
bind 127.0.0.1
port 0  # Disable default port
unixsocket /var/run/redis/redis.sock
unixsocketperm 700

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

### Network Security

```bash
# Firewall rules (iptables)
sudo iptables -A INPUT -p tcp --dport 6379 -s 10.0.0.0/8 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 6379 -j DROP

# TLS encryption
tls-port 6380
tls-cert-file /path/to/redis.crt
tls-key-file /path/to/redis.key
```

### Application Security

```typescript
// Secure cache keys
const sanitizeKey = (key: string): string => {
  return key.replace(/[^a-zA-Z0-9:_-]/g, '');
};

// Rate limiting for cache endpoints
app.use('/api/cache', rateLimiter({
  windowMs: 60000, // 1 minute
  max: 100 // max requests per window
}));
```

---

This deployment guide provides comprehensive instructions for setting up the cache system in various environments, from development to production scale.