# 📊 Database Connection Information

## 🔌 Connection Details

### Environment Variables (.env)
```env
DATABASE_HOST=172.26.240.1
DATABASE_PORT=5432
DATABASE_NAME=postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=@abcd1234

# Alternative DB_ prefix also supported
DB_HOST=172.26.240.1
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=@abcd1234
```

### Connection Pool Configuration
- **Max connections**: 50 (can be configured via `DB_POOL_MAX`)
- **Min connections**: 10 (keeps connections warm)
- **Idle timeout**: 30 seconds
- **Connection timeout**: 5 seconds
- **Query timeout**: 30 seconds

## 📁 Database Utilities Location

**File**: `/backend/src/utils/database.ts`

### Available Functions:
```typescript
// Basic query execution with retry logic
query(text: string, params?: any[], retries = 3): Promise<any>

// Get client for manual transaction control
getClient(timeoutMs?: number): Promise<PoolClient>

// Execute query with custom timeout
queryWithTimeout(text: string, params?: any[], timeoutMs?: number): Promise<any>

// Transaction wrapper with automatic rollback
withTransaction<T>(callback: (client: PoolClient) => Promise<T>, timeoutMs?: number): Promise<T>

// Test database connection
testConnection(): Promise<void>

// Get pool metrics for monitoring
getPoolMetrics(): Object

// Close pool on shutdown
closePool(): Promise<void>
```

## 🎯 Usage in Comment Module

The Comment Service uses the shared database pool from `utils/database.ts`:

```typescript
import { pool, query, withTransaction, getClient } from '../../utils/database';

// Simple query
const result = await query('SELECT * FROM comments WHERE id = $1', [id]);

// Transaction
const comment = await withTransaction(async (client) => {
  await client.query('INSERT INTO comments ...', values);
  const result = await client.query('SELECT * FROM comments ...');
  return result.rows[0];
});
```

## 🚀 Features

### Performance Optimizations:
- **Connection pooling** with automatic management
- **Retry logic** for transient failures (3 attempts by default)
- **Slow query detection** (logs queries >1 second)
- **Connection health monitoring** with metrics
- **Automatic pool utilization warnings** (>70% and >85%)

### Error Handling:
- **Smart retry logic** - doesn't retry on logical errors (constraints, etc.)
- **Exponential backoff** for retries
- **Transaction rollback** on errors
- **Timeout protection** for long-running queries

### Monitoring:
- Real-time pool metrics
- Connection leak detection
- Slow query logging
- Pool utilization alerts

## 🔒 Security

- All queries use **parameterized statements** to prevent SQL injection
- Database password is stored in environment variables
- SSL connection in production mode
- Connection string supports both individual params and DATABASE_URL

## 📊 Comment Module Database Schema

The comments table is created in:
`/backend/src/migrations/20240115_create_comments_table.sql`

Key features:
- UUID primary keys
- Soft delete support (deleted_at)
- Nested comments with parent_id
- Max depth of 3 levels
- Automatic timestamp updates
- Foreign keys to users and submissions tables

## 🧪 Testing Connection

To test the database connection:
```bash
npm run db:test
```

Or in code:
```typescript
import { testConnection } from './utils/database';
await testConnection();
// ✅ Database connected successfully
```