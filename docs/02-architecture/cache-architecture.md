# Cache Architecture - XP Project

## Overview

The XP Project implements a sophisticated multi-layer caching architecture designed for high performance, reliability, and seamless fallback capabilities. The system automatically adapts between Redis and in-memory caching based on availability.

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    Client[Client Application] --> LB[Load Balancer]
    LB --> App1[App Instance 1]
    LB --> App2[App Instance 2]
    LB --> App3[App Instance N]
    
    App1 --> Cache[Cache Service Layer]
    App2 --> Cache
    App3 --> Cache
    
    Cache --> Redis{Redis Available?}
    Redis -->|Yes| RedisCluster[Redis Cluster]
    Redis -->|No| MemCache[Memory Cache]
    
    RedisCluster --> RedisMaster[Redis Master]
    RedisCluster --> RedisSentinel1[Sentinel 1]
    RedisCluster --> RedisSentinel2[Sentinel 2]
    RedisCluster --> RedisSentinel3[Sentinel 3]
    
    App1 --> DB[(PostgreSQL)]
    App2 --> DB
    App3 --> DB
```

### Cache Service Layer

```mermaid
graph LR
    subgraph "Cache Service Layer"
        CS[Cache Service] --> WS[Warming Service]
        CS --> IS[Invalidation Service]
        CS --> SC[Session Cache]
        CS --> MC[Memory Cache]
        
        CS --> RedisClient[Redis Client]
        RedisClient --> RedisServer[Redis Server]
    end
    
    subgraph "Application Layer"
        API[API Endpoints] --> CS
        Auth[Authentication] --> SC
        Forms[Form Builder] --> CS
        Users[User Management] --> CS
    end
```

## Component Architecture

### 1. Cache Service (`cacheService.ts`)

**Responsibilities:**
- Primary cache interface
- Mode detection (Redis vs Memory)
- Automatic fallback management
- Consistent API abstraction

**Key Features:**
- Dual-mode operation
- Graceful degradation
- Connection retry logic
- Health monitoring

```typescript
interface CacheService {
  get<T>(key: string, options?: CacheOptions): Promise<T | null>
  set(key: string, value: any, options?: CacheOptions): Promise<boolean>
  del(key: string | string[]): Promise<boolean>
  exists(key: string): Promise<boolean>
  healthCheck(): Promise<HealthStatus>
}
```

### 2. Memory Cache (`memoryCache.ts`)

**Responsibilities:**
- In-memory storage fallback
- Redis-compatible API
- TTL management
- LRU eviction

**Characteristics:**
- RAM-based storage (10K entries max)
- Automatic cleanup (1-minute intervals)
- Hit rate tracking
- Memory usage monitoring

### 3. Cache Warming Service (`cacheWarmingService.ts`)

**Responsibilities:**
- Pre-loading frequently accessed data
- Scheduled warming operations
- Performance optimization

**Warming Strategies:**
- Active users (last 24h)
- Popular forms (top 50)
- System configurations
- Recent sessions

### 4. Cache Invalidation Service (`cacheInvalidationService.ts`)

**Responsibilities:**
- Pattern-based invalidation
- Dependency tracking
- Cascade operations

**Invalidation Patterns:**
- By entity type (user, form, session)
- By pattern matching (wildcards)
- Dependency-based (cascading)
- Time-based (TTL expiration)

### 5. Session Cache Service (`sessionCacheService.ts`)

**Responsibilities:**
- High-performance session management
- User authentication caching
- Multi-session tracking

**Session Features:**
- Token-based caching
- User data pre-loading
- Activity tracking
- Expired session cleanup

## Performance Architecture

### Caching Layers

```
┌─────────────────────┐
│   Application       │ ← Business Logic
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│   L1 Cache          │ ← Memory Cache (100ms)
│   (In-Memory)       │
└──────────┬──────────┘
           │ (Cache Miss)
┌──────────▼──────────┐
│   L2 Cache          │ ← Redis Cache (5-10ms)
│   (Redis)           │
└──────────┬──────────┘
           │ (Cache Miss)
┌──────────▼──────────┐
│   Database          │ ← PostgreSQL (50-200ms)
│   (PostgreSQL)      │
└─────────────────────┘
```

### Performance Metrics

| Operation | Memory Cache | Redis Cache | Database |
|-----------|-------------|-------------|----------|
| GET | <1ms | 5-10ms | 50-200ms |
| SET | <1ms | 5-10ms | 100-500ms |
| Capacity | ~10MB | 2GB | Unlimited |
| Persistence | No | Yes | Yes |
| Distribution | No | Yes | Yes |

## High Availability Architecture

### Redis Sentinel Configuration

```mermaid
graph TB
    subgraph "Redis Cluster"
        Master[Redis Master<br/>Port 6379]
        Replica1[Redis Replica 1<br/>Port 6380]
        Replica2[Redis Replica 2<br/>Port 6381]
    end
    
    subgraph "Sentinel Cluster"
        S1[Sentinel 1<br/>Port 26379]
        S2[Sentinel 2<br/>Port 26380]
        S3[Sentinel 3<br/>Port 26381]
    end
    
    Master -.-> Replica1
    Master -.-> Replica2
    
    S1 -.-> Master
    S2 -.-> Master
    S3 -.-> Master
    
    App[Application] --> S1
    App --> S2
    App --> S3
```

**Failover Process:**
1. Sentinel detects master failure
2. Quorum reached (2/3 sentinels)
3. Leader election among replicas
4. Automatic failover to new master
5. Applications reconnect automatically

### Memory Cache Fallback

```mermaid
sequenceDiagram
    participant App as Application
    participant CS as Cache Service
    participant Redis as Redis Server
    participant MC as Memory Cache
    participant DB as Database
    
    App->>CS: get('user:123')
    CS->>Redis: GET user:123
    Redis-->>CS: Connection Error
    CS->>MC: get('user:123')
    alt Cache Hit
        MC-->>CS: User Data
        CS-->>App: User Data
    else Cache Miss
        CS->>DB: SELECT * FROM users WHERE id=123
        DB-->>CS: User Data
        CS->>MC: set('user:123', userData)
        CS-->>App: User Data
    end
```

## Deployment Architecture

### Docker Compose Setup

```yaml
version: '3.8'
services:
  app:
    build: ./backend
    environment:
      - REDIS_ENABLED=true
      - REDIS_HOST=redis-master
    depends_on:
      - redis-master
      - postgres
  
  redis-master:
    image: redis:7.2-alpine
    command: redis-server --appendonly yes
  
  redis-sentinel-1:
    image: redis:7.2-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
  
  postgres:
    image: postgres:15
```

### Production Architecture

```mermaid
graph TB
    subgraph "Load Balancer"
        LB[HAProxy/Nginx]
    end
    
    subgraph "Application Tier"
        App1[Node.js App 1]
        App2[Node.js App 2]
        App3[Node.js App 3]
    end
    
    subgraph "Cache Tier"
        RedisM[Redis Master]
        RedisR1[Redis Replica 1]
        RedisR2[Redis Replica 2]
        
        S1[Sentinel 1]
        S2[Sentinel 2]
        S3[Sentinel 3]
    end
    
    subgraph "Database Tier"
        PGM[PostgreSQL Master]
        PGR[PostgreSQL Replica]
    end
    
    subgraph "Monitoring"
        RC[Redis Commander]
        Metrics[Prometheus/Grafana]
    end
    
    LB --> App1
    LB --> App2
    LB --> App3
    
    App1 --> RedisM
    App2 --> RedisM
    App3 --> RedisM
    
    App1 --> PGM
    App2 --> PGM
    App3 --> PGM
    
    RedisM --> RedisR1
    RedisM --> RedisR2
    
    PGM --> PGR
```

## Data Flow Architecture

### Cache-First Strategy

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Cache
    participant Database
    
    Client->>API: Request Data
    API->>Cache: Check Cache
    
    alt Cache Hit
        Cache-->>API: Return Cached Data
        API-->>Client: Response (Fast)
    else Cache Miss
        API->>Database: Query Database
        Database-->>API: Return Data
        API->>Cache: Store in Cache
        API-->>Client: Response (Slower)
    end
```

### Write-Through Strategy

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Cache
    participant Database
    
    Client->>API: Update Request
    API->>Database: Write to Database
    Database-->>API: Write Confirmed
    API->>Cache: Invalidate/Update Cache
    Cache-->>API: Cache Updated
    API-->>Client: Response
```

## Security Architecture

### Cache Security Layers

1. **Network Security**
   - Redis AUTH password
   - TLS encryption in production
   - VPC/network isolation

2. **Access Control**
   - Role-based cache access
   - API authentication
   - Admin-only management endpoints

3. **Data Protection**
   - No sensitive data in cache keys
   - TTL-based data expiration
   - Secure invalidation patterns

## Monitoring Architecture

### Key Metrics

```mermaid
graph LR
    subgraph "Application Metrics"
        HitRate[Hit Rate %]
        Latency[Response Latency]
        ErrorRate[Error Rate %]
    end
    
    subgraph "System Metrics"
        Memory[Memory Usage]
        CPU[CPU Usage]
        Network[Network I/O]
    end
    
    subgraph "Cache Metrics"
        Operations[Operations/sec]
        Connections[Active Connections]
        KeyCount[Total Keys]
    end
    
    subgraph "Alerts"
        HitRate --> LowHitRate[Hit Rate < 70%]
        Latency --> HighLatency[Latency > 100ms]
        Memory --> HighMemory[Memory > 80%]
    end
```

### Health Check Flow

```mermaid
graph TB
    HealthCheck[Health Check Endpoint]
    
    HealthCheck --> CacheHealth{Cache Healthy?}
    CacheHealth -->|Yes| RedisCheck[Redis Ping Test]
    CacheHealth -->|No| MemoryCheck[Memory Cache Check]
    
    RedisCheck --> Latency[Measure Latency]
    MemoryCheck --> MemStats[Check Memory Stats]
    
    Latency --> Status[Return Status]
    MemStats --> Status
```

## Scalability Architecture

### Horizontal Scaling

```mermaid
graph TB
    subgraph "Auto Scaling Group"
        App1[App Instance 1]
        App2[App Instance 2]
        App3[App Instance 3]
        AppN[App Instance N]
    end
    
    subgraph "Cache Layer"
        RedisCluster[Redis Cluster]
        RedisShards[Multiple Shards]
    end
    
    App1 --> RedisCluster
    App2 --> RedisCluster
    App3 --> RedisCluster
    AppN --> RedisCluster
    
    RedisCluster --> RedisShards
```

### Performance Scaling

| Concurrent Users | Cache Strategy | Expected Performance |
|------------------|----------------|---------------------|
| 1-100 | Memory Cache | <50ms response |
| 100-1,000 | Single Redis | <100ms response |
| 1,000-10,000 | Redis Cluster | <150ms response |
| 10,000+ | Multi-tier + CDN | <200ms response |

## Future Architecture

### Planned Enhancements

1. **Redis Cluster** for horizontal scaling
2. **CDN Integration** for static content
3. **GraphQL Caching** for query optimization
4. **ML-based Cache Warming** for predictive loading
5. **Multi-region Replication** for global deployment

---

This architecture provides a robust, scalable, and maintainable caching solution that adapts to various deployment scenarios while maintaining high performance and reliability.