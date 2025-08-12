---
title: XP Project - Deployment Guide
version: 2.0.0
date: 2025-01-10
author: Claude Code
status: production-ready
tags: [deployment, production, configuration]
---

# XP Project - Deployment Guide

## 🚀 Production Deployment Guide

This guide covers the complete deployment process for the XP Project with enhanced User Group Management functionality.

## 📋 Pre-Deployment Checklist

### Database Preparation
- [ ] Run all migration files in order
- [ ] Verify database indexes are created
- [ ] Test database connection and performance
- [ ] Set up database backups
- [ ] Configure connection pooling

### Backend Deployment
- [ ] Install Node.js 18+ and npm
- [ ] Set up environment variables
- [ ] Install dependencies: `npm install`
- [ ] Build project: `npm run build`
- [ ] Run tests: `npm test`
- [ ] Configure authentication middleware
- [ ] Set up SSL/TLS certificates

### Frontend Deployment
- [ ] Install Node.js 18+ and npm  
- [ ] Configure environment variables
- [ ] Install dependencies: `npm install`
- [ ] Build for production: `npm run build`
- [ ] Configure web server (nginx/Apache)
- [ ] Test all functionality

## 🗄️ Database Setup

### 1. Migration Execution
```bash
# Run migrations in order
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/user-management/001_initial_schema.sql
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/user-management/012_optimize_group_management_indexes.sql

# Verify migrations
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT * FROM schema_migrations;"
```

### 2. Index Verification
```sql
-- Verify critical indexes exist
\di user_groups*

-- Expected indexes:
-- idx_user_groups_type_active
-- idx_user_groups_composite  
-- idx_user_groups_member_lookup
```

### 3. Performance Testing
```sql
-- Test query performance
EXPLAIN ANALYZE 
SELECT g.*, COALESCE(member_counts.member_count, 0) as member_count
FROM user_groups g
LEFT JOIN (
  SELECT group_id, COUNT(*) as member_count
  FROM user_groups ug
  WHERE ug.deleted_at IS NULL
  GROUP BY group_id
) member_counts ON g.id = member_counts.group_id
WHERE g.is_active = true
ORDER BY g.created_at DESC;
```

## 🔧 Backend Configuration

### 1. Environment Variables
```env
# Required production environment variables
NODE_ENV=production
PORT=5000

# Database Configuration  
DATABASE_URL=postgresql://username:password@host:5432/database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=xp_production
DB_USER=xp_user
DB_PASSWORD=secure_password
DB_SSL=true
DB_POOL_MIN=2
DB_POOL_MAX=20

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key
JWT_EXPIRES_IN=24h
SESSION_SECRET=your-secure-session-secret

# API Configuration
API_RATE_LIMIT=1000
API_TIMEOUT=30000

# Security
CORS_ORIGINS=https://yourdomain.com
BCRYPT_ROUNDS=12

# Monitoring
ACTIVITY_LOGGING_ENABLED=true
LOG_LEVEL=info
```

### 2. Production Build
```bash
# Install dependencies
npm ci --only=production

# Build TypeScript
npm run build

# Start production server
npm start
```

### 3. Process Management
```bash
# Using PM2 for process management
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'xp-backend',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🌐 Frontend Configuration

### 1. Environment Variables
```env
# Frontend production environment
NODE_ENV=production
VITE_API_URL=https://api.yourdomain.com
VITE_APP_NAME=XP Project
VITE_APP_VERSION=2.0.0
```

### 2. Production Build
```bash
# Install dependencies
npm ci

# Build for production
npm run build

# Preview build (optional)
npm run preview
```

### 3. Web Server Configuration

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/xp-frontend
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;
    
    root /var/www/xp/frontend/dist;
    index index.html;
    
    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

#### Apache Configuration
```apache
# /etc/apache2/sites-available/xp-frontend.conf
<VirtualHost *:80>
    ServerName yourdomain.com
    Redirect permanent / https://yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName yourdomain.com
    DocumentRoot /var/www/xp/frontend/dist
    
    SSLEngine on
    SSLCertificateFile /path/to/ssl/certificate.crt
    SSLCertificateKeyFile /path/to/ssl/private.key
    
    # Handle SPA routing
    <Directory /var/www/xp/frontend/dist>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
    
    # API proxy
    ProxyPreserveHost On
    ProxyPass /api/ http://localhost:5000/
    ProxyPassReverse /api/ http://localhost:5000/
    
    # Enable compression
    LoadModule deflate_module modules/mod_deflate.so
    <Location />
        SetOutputFilter DEFLATE
        SetEnvIfNoCase Request_URI \
            \.(?:gif|jpe?g|png)$ no-gzip dont-vary
        SetEnvIfNoCase Request_URI \
            \.(?:exe|t?gz|zip|bz2|sit|rar)$ no-gzip dont-vary
    </Location>
</VirtualHost>
```

## 🔐 Security Configuration

### 1. SSL/TLS Setup
```bash
# Using Let's Encrypt (Certbot)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
sudo certbot renew --dry-run
```

### 2. Firewall Configuration
```bash
# UFW configuration
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 5000/tcp  # Block direct API access
sudo ufw enable
```

### 3. Database Security
```sql
-- Create dedicated database user
CREATE USER xp_app WITH ENCRYPTED PASSWORD 'secure_password';

-- Grant minimal required permissions
GRANT CONNECT ON DATABASE xp_production TO xp_app;
GRANT USAGE ON SCHEMA public TO xp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO xp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO xp_app;

-- Enable Row Level Security (if needed)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

## 📊 Monitoring & Logging

### 1. Application Monitoring
```javascript
// PM2 monitoring
pm2 monitor

// Log monitoring
pm2 logs xp-backend --lines 100

// Resource monitoring
pm2 monit
```

### 2. Database Monitoring
```sql
-- Monitor active connections
SELECT count(*) FROM pg_stat_activity;

-- Monitor query performance
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### 3. Health Check Endpoints
```typescript
// Backend health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime()
  });
});

// Database health check
app.get('/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});
```

## 🚀 Deployment Scripts

### 1. Automated Deployment Script
```bash
#!/bin/bash
# deploy.sh - Production deployment script

set -e

echo "🚀 Starting XP Project deployment..."

# Pull latest code
git pull origin main

# Backend deployment
echo "📦 Deploying backend..."
cd backend
npm ci --only=production
npm run build
pm2 restart xp-backend

# Frontend deployment  
echo "🌐 Deploying frontend..."
cd ../frontend
npm ci
npm run build
sudo rsync -av --delete dist/ /var/www/xp/frontend/dist/

# Database migrations (if any)
echo "🗄️  Running database migrations..."
cd ../backend
npm run migrate:prod

# Health check
echo "🏥 Running health checks..."
sleep 5
curl -f http://localhost:5000/health || exit 1

echo "✅ Deployment completed successfully!"
```

### 2. Rollback Script
```bash
#!/bin/bash
# rollback.sh - Rollback to previous version

set -e

echo "⏪ Rolling back XP Project..."

# Rollback backend
pm2 restart xp-backend

# Rollback frontend
sudo rsync -av --delete dist.backup/ /var/www/xp/frontend/dist/

echo "✅ Rollback completed!"
```

## 🧪 Testing in Production

### 1. Smoke Tests
```bash
# Basic functionality tests
curl -f https://yourdomain.com/health
curl -f https://yourdomain.com/api/health
curl -f https://yourdomain.com/api/user-management/groups

# Authentication test
curl -H "Authorization: Bearer $TEST_TOKEN" https://yourdomain.com/api/user-management/groups
```

### 2. Load Testing
```bash
# Using Artillery for load testing
npm install -g artillery

# Create load test config
cat > load-test.yml << EOF
config:
  target: 'https://yourdomain.com'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "API Load Test"
    requests:
      - get:
          url: "/api/health"
      - get:
          url: "/api/user-management/groups"
          headers:
            Authorization: "Bearer {{token}}"
EOF

# Run load test
artillery run load-test.yml
```

## 📝 Post-Deployment Tasks

### 1. Verification Checklist
- [ ] All services are running
- [ ] Health checks pass
- [ ] SSL certificate is valid
- [ ] Database connections work
- [ ] API endpoints respond correctly
- [ ] Frontend loads and functions
- [ ] User authentication works
- [ ] Group management features work
- [ ] Error handling works correctly
- [ ] Logging is functional

### 2. Performance Monitoring
- [ ] Set up monitoring alerts
- [ ] Configure log rotation
- [ ] Monitor database performance
- [ ] Track API response times
- [ ] Monitor memory usage
- [ ] Set up automated backups

## 🆘 Troubleshooting

### Common Issues

#### Backend Not Starting
```bash
# Check logs
pm2 logs xp-backend

# Check port availability
sudo netstat -tulpn | grep :5000

# Check environment variables
pm2 show xp-backend
```

#### Database Connection Issues
```bash
# Test database connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"

# Check connection pool
SELECT count(*) FROM pg_stat_activity WHERE application_name = 'xp-backend';
```

#### Frontend Not Loading
```bash
# Check nginx/apache logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/apache2/error.log

# Check file permissions
ls -la /var/www/xp/frontend/dist/
```

### Performance Issues
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE mean_time > 1000 
ORDER BY mean_time DESC;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname = 'public';
```

## 📧 Support Contacts

- **Technical Issues**: tech-support@yourdomain.com
- **Deployment Issues**: devops@yourdomain.com
- **Database Issues**: dba@yourdomain.com

---

**Deployment Status**: ✅ **Production Ready**  
**Last Updated**: 2025-01-10  
**Version**: 2.0.0