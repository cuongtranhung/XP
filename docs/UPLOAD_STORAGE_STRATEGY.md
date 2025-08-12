# Upload Module Storage Strategy

## Overview
Chiến lược lưu trữ file đa tầng, từ miễn phí đến enterprise, phù hợp với mọi quy mô.

## Storage Options

### 1. Local File System (Miễn Phí - Development/Small Scale)

#### Configuration
```javascript
// Storage path structure
/var/app/storage/
├── uploads/
│   ├── 2024/
│   │   ├── 01/
│   │   │   ├── 15/
│   │   │   │   ├── file1.pdf
│   │   │   │   ├── file2.jpg
│   │   │   │   └── thumb_file2.jpg
│   │   │   └── 16/
│   │   └── 02/
│   └── temp/
│       └── chunks/
```

#### Implementation
```typescript
// backend/src/config/storage.ts
export const storageConfig = {
  type: 'local',
  basePath: process.env.STORAGE_PATH || '/var/app/storage',
  publicPath: '/uploads',
  
  // Organize by date for better management
  getStoragePath: (filename: string): string => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return path.join(
      storageConfig.basePath,
      'uploads',
      year.toString(),
      month,
      day,
      filename
    );
  },
  
  // Separate path for temporary files
  getTempPath: (filename: string): string => {
    return path.join(storageConfig.basePath, 'temp', filename);
  }
};
```

#### Pros & Cons
✅ **Advantages:**
- Hoàn toàn miễn phí
- Đơn giản, dễ setup
- Full control over files
- No network latency
- Easy backup với rsync

❌ **Disadvantages:**
- Limited to single server
- Manual backup required
- No CDN
- Storage limit = server disk
- No redundancy

#### Best For:
- Development environment
- Small projects (<1000 users)
- Internal tools
- Budget-conscious startups

---

### 2. Docker Volume (Container Deployment)

#### Docker Compose Configuration
```yaml
version: '3.8'

services:
  app:
    build: .
    volumes:
      - upload-data:/app/storage
      - ./uploads-backup:/backup
    environment:
      - STORAGE_PATH=/app/storage

volumes:
  upload-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /mnt/storage/uploads

  # Optional: NFS volume for shared storage
  upload-data-nfs:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server.local,rw
      device: ":/exports/uploads"
```

#### Kubernetes Persistent Volume
```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: upload-storage
spec:
  capacity:
    storage: 100Gi
  accessModes:
    - ReadWriteMany
  nfs:
    server: nfs-server.local
    path: /exports/uploads
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: upload-storage-claim
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 100Gi
```

---

### 3. MinIO (Self-Hosted S3 - Miễn Phí)

#### Setup MinIO
```bash
# Docker deployment
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -v /mnt/data:/data \
  -e MINIO_ROOT_USER=admin \
  -e MINIO_ROOT_PASSWORD=secretpassword \
  minio/minio server /data --console-address ":9001"
```

#### Integration Code
```typescript
// backend/src/services/minioStorage.ts
import * as Minio from 'minio';

export class MinioStorage {
  private client: Minio.Client;
  private bucketName = 'uploads';

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!
    });
    
    this.initBucket();
  }

  private async initBucket() {
    const exists = await this.client.bucketExists(this.bucketName);
    if (!exists) {
      await this.client.makeBucket(this.bucketName, 'us-east-1');
      
      // Set bucket policy for public read
      const policy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucketName}/public/*`]
        }]
      };
      
      await this.client.setBucketPolicy(
        this.bucketName, 
        JSON.stringify(policy)
      );
    }
  }

  async uploadFile(
    file: Buffer | Stream, 
    filename: string, 
    metadata?: Record<string, string>
  ): Promise<string> {
    const objectName = `${Date.now()}_${filename}`;
    
    await this.client.putObject(
      this.bucketName,
      objectName,
      file,
      metadata
    );
    
    return objectName;
  }

  async getFileUrl(objectName: string): Promise<string> {
    // Generate presigned URL (7 days expiry)
    return await this.client.presignedGetObject(
      this.bucketName,
      objectName,
      7 * 24 * 60 * 60
    );
  }

  async deleteFile(objectName: string): Promise<void> {
    await this.client.removeObject(this.bucketName, objectName);
  }
}
```

#### MinIO Features
- 🔥 S3-compatible API
- 🔄 Automatic replication
- 🔒 Encryption at rest
- 📊 Built-in monitoring
- 🌐 Multi-site replication
- 💾 Erasure coding for redundancy

---

### 4. Cloud Storage Options (Freemium/Paid)

#### 4.1 Cloudflare R2 (Best Value)
```typescript
// Cloudflare R2 - No egress fees!
const r2Config = {
  accountId: process.env.CF_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  
  // Pricing (as of 2024)
  storage: '$0.015/GB/month',
  operations: {
    classA: '$4.50/million requests', // PUT, POST
    classB: '$0.36/million requests'  // GET
  },
  egress: 'FREE!', // This is huge!
  freeQuota: {
    storage: '10 GB/month',
    classA: '1 million requests',
    classB: '10 million requests'
  }
};
```

#### 4.2 Backblaze B2 (Cheapest)
```typescript
const b2Config = {
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APP_KEY,
  
  // Pricing
  storage: '$0.005/GB/month', // Cheapest!
  download: '$0.01/GB',
  apiCalls: 'Free up to 2,500/day',
  freeQuota: {
    storage: '10 GB',
    download: '1 GB/day'
  }
};
```

#### 4.3 AWS S3 (Most Features)
```typescript
const s3Config = {
  // Pricing varies by storage class
  standardStorage: '$0.023/GB/month',
  intelligentTiering: '$0.0125/GB/month',
  glacierInstant: '$0.004/GB/month',
  
  // Free tier (12 months)
  freeTier: {
    storage: '5 GB',
    requests: '20,000 GET, 2,000 PUT'
  }
};
```

#### 4.4 Google Cloud Storage
```typescript
const gcsConfig = {
  standardStorage: '$0.020/GB/month',
  nearline: '$0.010/GB/month',
  coldline: '$0.004/GB/month',
  
  // Free tier
  freeTier: {
    storage: '5 GB',
    classA: '5,000 operations',
    classB: '50,000 operations',
    egress: '1 GB North America'
  }
};
```

---

### 5. Hybrid Storage Strategy (Recommended)

```typescript
// backend/src/services/hybridStorage.ts
export class HybridStorage {
  private localStorage: LocalStorage;
  private cloudStorage: CloudStorage;
  private cacheStorage: RedisCache;

  constructor() {
    this.localStorage = new LocalStorage();
    this.cloudStorage = this.initCloudStorage();
    this.cacheStorage = new RedisCache();
  }

  async storeFile(file: File, options: StorageOptions) {
    const strategy = this.determineStrategy(file, options);
    
    switch (strategy) {
      case 'local':
        // Small files, temporary files
        return await this.localStorage.store(file);
        
      case 'cloud':
        // Large files, permanent storage
        return await this.cloudStorage.store(file);
        
      case 'hybrid':
        // Store locally first, then migrate to cloud
        const localPath = await this.localStorage.store(file);
        this.scheduleCloudMigration(localPath, file);
        return localPath;
        
      case 'cache':
        // Frequently accessed files
        await this.cacheStorage.store(file);
        return await this.cloudStorage.store(file);
    }
  }

  private determineStrategy(file: File, options: StorageOptions): string {
    // Temporary files -> Local
    if (options.temporary) return 'local';
    
    // Large files > 10MB -> Cloud
    if (file.size > 10 * 1024 * 1024) return 'cloud';
    
    // Frequently accessed -> Cache
    if (options.highTraffic) return 'cache';
    
    // Default -> Hybrid
    return 'hybrid';
  }

  private scheduleCloudMigration(localPath: string, file: File) {
    // Migrate to cloud after 24 hours if file is still being used
    setTimeout(async () => {
      const isActive = await this.checkFileActivity(localPath);
      if (isActive) {
        await this.migrateToCloud(localPath, file);
      }
    }, 24 * 60 * 60 * 1000);
  }
}
```

---

## Storage Decision Matrix

| Criteria | Local FS | MinIO | Cloudflare R2 | Backblaze B2 | AWS S3 |
|----------|----------|-------|---------------|--------------|--------|
| **Cost** | Free | Free (self-host) | $0.015/GB | $0.005/GB | $0.023/GB |
| **Setup Complexity** | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Scalability** | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Reliability** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Free Tier** | ∞ | ∞ | 10GB | 10GB | 5GB |
| **CDN** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Egress Fees** | None | None | **Free!** | $0.01/GB | $0.09/GB |

---

## Recommended Approach by Scale

### 🏃 Startup/MVP (0-1000 users)
```
Local File System + Nginx
- Cost: $0
- Storage: Server disk space
- Backup: Daily rsync to backup server
```

### 🚶 Small Business (1000-10,000 users)
```
MinIO (self-hosted) + CloudFlare CDN (free tier)
- Cost: ~$20/month (VPS)
- Storage: 100-500GB
- Redundancy: MinIO replication
```

### 🚗 Growing Business (10,000-100,000 users)
```
Cloudflare R2 + Local Cache
- Cost: ~$50-200/month
- Storage: Unlimited
- No egress fees!
```

### ✈️ Enterprise (100,000+ users)
```
Multi-region S3/GCS + CloudFront/Fastly CDN
- Cost: $500+/month
- Storage: Unlimited
- Global distribution
```

---

## Implementation Checklist

### Phase 1: Local Storage (Week 1)
- [ ] Setup local file system structure
- [ ] Implement file upload/download
- [ ] Add file cleanup cron job
- [ ] Setup daily backups

### Phase 2: Add MinIO (Week 2)
- [ ] Deploy MinIO container
- [ ] Implement S3-compatible client
- [ ] Setup replication
- [ ] Configure backup policies

### Phase 3: Cloud Integration (Week 3)
- [ ] Choose cloud provider
- [ ] Implement cloud storage client
- [ ] Setup CDN
- [ ] Configure failover

### Phase 4: Optimization (Week 4)
- [ ] Implement hybrid storage
- [ ] Add intelligent routing
- [ ] Setup monitoring
- [ ] Performance tuning

---

## Security Considerations

### 1. File Access Security
```nginx
# Nginx configuration for secure file serving
location /uploads/private/ {
    internal;
    alias /var/app/storage/uploads/private/;
}

location /uploads/public/ {
    alias /var/app/storage/uploads/public/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}

location /api/files/download/ {
    # Verify authentication via app
    proxy_pass http://app:3000;
}
```

### 2. Storage Encryption
```typescript
// Encrypt files at rest
import crypto from 'crypto';

class EncryptedStorage {
  private algorithm = 'aes-256-gcm';
  private key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

  encrypt(buffer: Buffer): Buffer {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([iv, authTag, encrypted]);
  }

  decrypt(buffer: Buffer): Buffer {
    const iv = buffer.slice(0, 16);
    const authTag = buffer.slice(16, 32);
    const encrypted = buffer.slice(32);
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
  }
}
```

---

## Monitoring & Maintenance

### Storage Metrics
```typescript
interface StorageMetrics {
  totalSpace: number;
  usedSpace: number;
  freeSpace: number;
  fileCount: number;
  averageFileSize: number;
  dailyUploadVolume: number;
  dailyBandwidth: number;
  topFileTypes: Record<string, number>;
}

// Monitor and alert
class StorageMonitor {
  async checkHealth() {
    const metrics = await this.getMetrics();
    
    // Alert if storage > 80%
    if (metrics.usedSpace / metrics.totalSpace > 0.8) {
      await this.sendAlert('Storage space running low');
    }
    
    // Alert if daily bandwidth > threshold
    if (metrics.dailyBandwidth > this.bandwidthLimit) {
      await this.sendAlert('Bandwidth limit exceeded');
    }
  }
}
```

### Cleanup Strategy
```typescript
// Automated cleanup job
class StorageCleanup {
  async cleanup() {
    // Delete temporary files older than 24 hours
    await this.deleteOldTempFiles();
    
    // Delete orphaned files (no DB reference)
    await this.deleteOrphanedFiles();
    
    // Archive old files to cold storage
    await this.archiveOldFiles();
    
    // Compress large text files
    await this.compressLargeFiles();
  }
}
```

---

## Cost Optimization Tips

1. **Use appropriate storage class**: Hot/Cold/Archive
2. **Implement lifecycle policies**: Auto-archive old files
3. **Compress files**: Reduce storage and bandwidth
4. **Use CDN**: Reduce origin bandwidth costs
5. **Clean up regularly**: Delete unused files
6. **Monitor usage**: Track and optimize patterns
7. **Choose right region**: Closer = cheaper
8. **Batch operations**: Reduce API calls

---

## Conclusion

For your project, I recommend starting with:

1. **Development**: Local file system
2. **Production MVP**: MinIO self-hosted
3. **Scale**: Migrate to Cloudflare R2 (no egress fees!)
4. **Enterprise**: Multi-cloud with CDN

This approach gives you a free start with a clear upgrade path as you grow.