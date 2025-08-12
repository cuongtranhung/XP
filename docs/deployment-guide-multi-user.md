# Multi-User Form Builder - Deployment Guide

## 🚀 Production Deployment Overview

This guide covers the deployment of the multi-user Form Builder system to production environments, including infrastructure setup, security configuration, monitoring, and maintenance procedures.

## 🏗️ Infrastructure Requirements

### System Requirements

**Minimum Production Requirements**
- **CPU**: 4 cores (8 cores recommended)
- **RAM**: 8GB (16GB recommended)
- **Storage**: 100GB SSD (500GB recommended)
- **Network**: 1Gbps connection
- **OS**: Ubuntu 20.04 LTS / CentOS 8 / RHEL 8

**Recommended Production Setup**
- **Application Servers**: 2+ instances (load balanced)
- **Database**: PostgreSQL 13+ with read replicas
- **Cache**: Redis 6+ cluster
- **Load Balancer**: Nginx / AWS ALB / Cloudflare
- **File Storage**: AWS S3 / Google Cloud Storage
- **Monitoring**: Prometheus + Grafana

### Architecture Overview

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    │   (Nginx/ALB)   │
                    └─────────┬───────┘
                              │
                    ┌─────────▼───────┐
                    │   Reverse Proxy │
                    │   SSL Termination│
                    └─────────┬───────┘
                              │
             ┌────────────────┼────────────────┐
             │                │                │
    ┌────────▼───────┐ ┌─────▼─────┐ ┌────────▼───────┐
    │  App Server 1  │ │App Server │ │  App Server 3  │
    │   (Node.js)    │ │     2     │ │   (Node.js)    │
    └────────┬───────┘ └─────┬─────┘ └────────┬───────┘
             │               │                │
             └───────────────┼────────────────┘
                             │
    ┌────────────────────────▼────────────────────────┐
    │                 Database Layer                   │
    │  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
    │  │ PostgreSQL  │  │   Redis     │  │   S3     │ │
    │  │   Master    │  │   Cluster   │  │ Storage  │ │
    │  └──────┬──────┘  └─────────────┘  └──────────┘ │
    │         │                                       │
    │  ┌──────▼──────┐                               │
    │  │ PostgreSQL  │                               │
    │  │   Replica   │                               │
    │  └─────────────┘                               │
    └─────────────────────────────────────────────────┘
```

## 🔧 Environment Setup

### 1. Server Preparation

**Update System**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip

# CentOS/RHEL
sudo yum update -y
sudo yum install -y curl wget git unzip
```

**Install Node.js**
```bash
# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be v18.x.x
npm --version   # Should be 9.x.x
```

**Install PM2 Process Manager**
```bash
npm install -g pm2
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

### 2. Database Setup

**PostgreSQL Installation**
```bash
# Ubuntu
sudo apt install -y postgresql postgresql-contrib

# CentOS
sudo yum install -y postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

**Database Configuration**
```bash
# Switch to postgres user
sudo -u postgres psql

-- Create database and user
CREATE DATABASE formbuilder_production;
CREATE USER formbuilder_app WITH ENCRYPTED PASSWORD 'your-secure-password-here';
GRANT ALL PRIVILEGES ON DATABASE formbuilder_production TO formbuilder_app;

-- Enable required extensions
\c formbuilder_production;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Configure permissions
GRANT USAGE, CREATE ON SCHEMA public TO formbuilder_app;

\q
```

**PostgreSQL Configuration (postgresql.conf)**
```bash
# /etc/postgresql/13/main/postgresql.conf

# Connection settings
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Performance tuning
random_page_cost = 1.1
effective_io_concurrency = 200
wal_buffers = 16MB
checkpoint_completion_target = 0.9

# Logging
log_statement = 'mod'
log_duration = on
log_min_duration_statement = 1000
log_checkpoints = on
log_connections = on
log_disconnections = on

# Security
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
```

**pg_hba.conf Security**
```bash
# /etc/postgresql/13/main/pg_hba.conf

# Allow local connections
local   all             postgres                                peer
local   all             all                                     md5

# Allow application connections
host    formbuilder_production    formbuilder_app     127.0.0.1/32        md5
host    formbuilder_production    formbuilder_app     10.0.0.0/8          md5

# Deny all other connections
host    all             all             0.0.0.0/0               reject
```

### 3. Redis Setup

**Redis Installation**
```bash
# Ubuntu
sudo apt install -y redis-server

# CentOS  
sudo yum install -y epel-release
sudo yum install -y redis

# Configure Redis
sudo systemctl enable redis
sudo systemctl start redis
```

**Redis Configuration**
```bash
# /etc/redis/redis.conf

# Security
bind 127.0.0.1
requirepass your-redis-password-here
protected-mode yes

# Memory management
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Logging
logfile /var/log/redis/redis-server.log
loglevel notice
```

### 4. Application Deployment

**Application Setup**
```bash
# Create application user
sudo useradd -m -s /bin/bash formbuilder
sudo usermod -aG sudo formbuilder

# Switch to application user
sudo su - formbuilder

# Create application directory
mkdir -p ~/formbuilder-app
cd ~/formbuilder-app

# Clone repository (replace with your repo URL)
git clone https://github.com/yourcompany/formbuilder.git .
git checkout main

# Install dependencies
npm ci --production

# Build application
npm run build
```

**Environment Configuration**
```bash
# Create production environment file
cat > .env.production << 'EOF'
# Application
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.yourcompany.com

# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=formbuilder_production
DB_USERNAME=formbuilder_app
DB_PASSWORD=your-secure-database-password-here
DB_SSL=true
DB_CONNECTION_LIMIT=20

# Redis
REDIS_URL=redis://:your-redis-password@127.0.0.1:6379

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters
JWT_EXPIRES_IN=24h
SESSION_SECRET=your-session-secret-minimum-32-characters

# Security
FRONTEND_URL=https://forms.yourcompany.com
ALLOWED_ORIGINS=https://forms.yourcompany.com,https://admin.yourcompany.com

# Rate Limiting
FORM_CREATION_RATE_LIMIT=20
FORM_SUBMISSION_RATE_LIMIT=50
PUBLIC_STATS_RATE_LIMIT=200

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=text/csv,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
LOG_LEVEL=info

# Email (configure based on your provider)
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
FROM_EMAIL=noreply@yourcompany.com
EOF

# Secure the environment file
chmod 600 .env.production
```

**Database Migration**
```bash
# Run database migrations
npm run migrate:production

# Seed initial data (if needed)
npm run seed:production
```

**PM2 Configuration**
```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'formbuilder-app',
      script: './dist/server.js',
      instances: 'max',  // Use all CPU cores
      exec_mode: 'cluster',
      env_file: '.env.production',
      log_file: './logs/app.log',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      time: true,
      max_restarts: 5,
      min_uptime: '10s',
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      kill_timeout: 5000,
      listen_timeout: 8000,
      shutdown_with_message: true,
      health_check_interval: 30000,
      instances_log_file: './logs/instances.log'
    },
    {
      name: 'formbuilder-worker',
      script: './dist/worker.js',
      instances: 2,
      env_file: '.env.production',
      cron_restart: '0 2 * * *',  // Restart daily at 2 AM
      log_file: './logs/worker.log',
      error_file: './logs/worker-error.log'
    }
  ]
};
EOF

# Create logs directory
mkdir -p logs

# Start application with PM2
pm2 start ecosystem.config.js
pm2 save
```

## 🌐 Nginx Configuration

### SSL Certificate Setup

**Using Let's Encrypt (Certbot)**
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d forms.yourcompany.com -d api.yourcompany.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

### Nginx Configuration

**Main Configuration**
```nginx
# /etc/nginx/sites-available/formbuilder

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=submit:10m rate=50r/m;

# Upstream backend servers
upstream formbuilder_backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s backup;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name forms.yourcompany.com api.yourcompany.com;
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name forms.yourcompany.com api.yourcompany.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/forms.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/forms.yourcompany.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self';" always;
    
    # Logging
    access_log /var/log/nginx/formbuilder-access.log combined;
    error_log /var/log/nginx/formbuilder-error.log warn;
    
    # Basic settings
    client_max_body_size 10M;
    client_body_timeout 60s;
    client_header_timeout 60s;
    keepalive_timeout 65s;
    send_timeout 60s;
    
    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;
    
    # Rate limiting for authentication endpoints
    location ~ ^/api/auth/ {
        limit_req zone=auth burst=10 nodelay;
        limit_req_status 429;
        proxy_pass http://formbuilder_backend;
        include /etc/nginx/proxy_params;
    }
    
    # Rate limiting for form submissions
    location ~ ^/api/forms/.+/submissions$ {
        limit_req zone=submit burst=20 nodelay;
        limit_req_status 429;
        proxy_pass http://formbuilder_backend;
        include /etc/nginx/proxy_params;
    }
    
    # General API rate limiting
    location /api/ {
        limit_req zone=api burst=50 nodelay;
        limit_req_status 429;
        proxy_pass http://formbuilder_backend;
        include /etc/nginx/proxy_params;
    }
    
    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://formbuilder_backend;
        include /etc/nginx/proxy_params;
        access_log off;
    }
    
    # Metrics endpoint (restrict access)
    location /metrics {
        allow 127.0.0.1;
        allow 10.0.0.0/8;
        deny all;
        proxy_pass http://formbuilder_backend;
        include /etc/nginx/proxy_params;
    }
    
    # Static files with caching
    location /static/ {
        alias /home/formbuilder/formbuilder-app/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        gzip_static on;
    }
    
    # Frontend application
    location / {
        try_files $uri $uri/ @proxy;
    }
    
    location @proxy {
        proxy_pass http://formbuilder_backend;
        include /etc/nginx/proxy_params;
    }
}
```

**Proxy Parameters**
```nginx
# /etc/nginx/proxy_params

proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Port $server_port;
proxy_set_header X-Forwarded-Host $host;

proxy_buffering on;
proxy_buffer_size 128k;
proxy_buffers 4 256k;
proxy_busy_buffers_size 256k;

proxy_connect_timeout 60s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;

proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_cache_bypass $http_upgrade;
```

**Enable Configuration**
```bash
# Test configuration
sudo nginx -t

# Enable site
sudo ln -s /etc/nginx/sites-available/formbuilder /etc/nginx/sites-enabled/

# Restart nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 📊 Monitoring Setup

### 1. Prometheus Configuration

**Install Prometheus**
```bash
# Create prometheus user
sudo useradd --no-create-home --shell /bin/false prometheus

# Download and install Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.35.0/prometheus-2.35.0.linux-amd64.tar.gz
tar xvf prometheus-2.35.0.linux-amd64.tar.gz
sudo mv prometheus-2.35.0.linux-amd64/prometheus /usr/local/bin/
sudo mv prometheus-2.35.0.linux-amd64/promtool /usr/local/bin/

# Create directories
sudo mkdir /etc/prometheus
sudo mkdir /var/lib/prometheus
sudo chown prometheus:prometheus /etc/prometheus
sudo chown prometheus:prometheus /var/lib/prometheus
```

**Prometheus Configuration**
```yaml
# /etc/prometheus/prometheus.yml

global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "formbuilder-rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'formbuilder-app'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: /metrics
    scrape_interval: 30s
    
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']
    
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['localhost:9187']
      
  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['localhost:9121']
      
  - job_name: 'nginx-exporter'
    static_configs:
      - targets: ['localhost:9113']
```

**Alert Rules**
```yaml
# /etc/prometheus/formbuilder-rules.yml

groups:
  - name: formbuilder-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} for {{ $labels.instance }}"
          
      - alert: DatabaseConnectionsHigh
        expr: pg_stat_activity_count > 80
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High database connections"
          description: "Database connections: {{ $value }}"
          
      - alert: RateLimitViolations
        expr: increase(rate_limit_violations_total[1h]) > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High rate limit violations"
          description: "{{ $value }} rate limit violations in the last hour"
          
      - alert: SecurityIncidents
        expr: increase(security_incidents_total[1h]) > 10
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Security incidents detected"
          description: "{{ $value }} security incidents in the last hour"
```

### 2. Grafana Setup

**Install Grafana**
```bash
# Add Grafana repository
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana

# Enable and start Grafana
sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

**Grafana Dashboard JSON** (example dashboard)
```json
{
  "dashboard": {
    "id": null,
    "title": "Form Builder Multi-User Dashboard",
    "tags": ["formbuilder"],
    "timezone": "utc",
    "panels": [
      {
        "id": 1,
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "active_users_total",
            "refId": "A"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "min": 0
          }
        }
      },
      {
        "id": 2,
        "title": "Forms Created",
        "type": "stat",
        "targets": [
          {
            "expr": "increase(forms_created_total[24h])",
            "refId": "A"
          }
        ]
      },
      {
        "id": 3,
        "title": "Form Submissions",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(form_submissions_total[5m])",
            "refId": "A"
          }
        ]
      },
      {
        "id": 4,
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "refId": "A",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ],
    "time": {
      "from": "now-24h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

## 🔒 Security Hardening

### Firewall Configuration

**UFW Setup**
```bash
# Enable UFW
sudo ufw --force enable

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (adjust port if needed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow internal monitoring (adjust IP ranges)
sudo ufw allow from 10.0.0.0/8 to any port 9090
sudo ufw allow from 10.0.0.0/8 to any port 3000

# Check status
sudo ufw status verbose
```

### System Security

**Fail2Ban Setup**
```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Configure for Nginx
sudo cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
EOF

sudo systemctl restart fail2ban
```

**System Limits**
```bash
# /etc/security/limits.conf
formbuilder soft nofile 65536
formbuilder hard nofile 65536
formbuilder soft nproc 4096
formbuilder hard nproc 4096

# /etc/systemd/user.conf
DefaultLimitNOFILE=65536

# Reload systemd
sudo systemctl daemon-reload
```

## 📋 Deployment Checklist

### Pre-Deployment

- [ ] **Infrastructure Ready**
  - [ ] Servers provisioned and configured
  - [ ] Database setup and tuned
  - [ ] Load balancer configured
  - [ ] SSL certificates installed
  - [ ] DNS records configured

- [ ] **Security Configured**
  - [ ] Firewall rules applied
  - [ ] Fail2Ban configured
  - [ ] Rate limiting enabled
  - [ ] Security headers configured
  - [ ] Secrets properly secured

- [ ] **Monitoring Setup**
  - [ ] Prometheus installed and configured
  - [ ] Grafana dashboards created
  - [ ] Alert rules defined
  - [ ] Log aggregation configured
  - [ ] Health checks enabled

### Deployment Steps

1. [ ] **Code Deployment**
   - [ ] Clone repository
   - [ ] Install dependencies
   - [ ] Build application
   - [ ] Configure environment variables
   - [ ] Run database migrations

2. [ ] **Service Configuration**
   - [ ] PM2 ecosystem configured
   - [ ] Nginx configuration applied
   - [ ] Services enabled and started
   - [ ] Health checks passing

3. [ ] **Verification**
   - [ ] Application responds correctly
   - [ ] Database queries working
   - [ ] All endpoints accessible
   - [ ] SSL certificate valid
   - [ ] Monitoring data flowing

### Post-Deployment

- [ ] **Functionality Testing**
  - [ ] User registration works
  - [ ] Form creation works
  - [ ] Multi-user access works
  - [ ] File uploads work
  - [ ] Email notifications work

- [ ] **Performance Testing**
  - [ ] Load testing completed
  - [ ] Response times acceptable
  - [ ] Rate limiting working
  - [ ] Database performance good

- [ ] **Security Testing**
  - [ ] Security headers present
  - [ ] XSS protection working
  - [ ] Rate limiting effective
  - [ ] Authentication secure

- [ ] **Documentation**
  - [ ] Deployment notes updated
  - [ ] Runbooks created
  - [ ] Contact information updated
  - [ ] Emergency procedures documented

## 🔄 Backup & Recovery

### Automated Backups

**Database Backup Script**
```bash
#!/bin/bash
# /home/formbuilder/scripts/backup-db.sh

BACKUP_DIR="/var/backups/formbuilder"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/db_backup_${DATE}.sql"

# Create backup
pg_dump -h localhost -U formbuilder_app -d formbuilder_production > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to S3 (optional)
aws s3 cp "${BACKUP_FILE}.gz" s3://your-backup-bucket/database/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Database backup completed: ${BACKUP_FILE}.gz"
```

**Cron Jobs**
```bash
# Add to crontab: crontab -e

# Database backup every 6 hours
0 */6 * * * /home/formbuilder/scripts/backup-db.sh >> /var/log/backup.log 2>&1

# File backup daily at 2 AM
0 2 * * * /home/formbuilder/scripts/backup-files.sh >> /var/log/backup.log 2>&1

# Log rotation weekly
0 0 * * 0 /home/formbuilder/scripts/rotate-logs.sh >> /var/log/maintenance.log 2>&1
```

## 🚨 Troubleshooting

### Common Issues

**Application Won't Start**
```bash
# Check PM2 status
pm2 status
pm2 logs formbuilder-app --lines 100

# Check environment variables
pm2 env 0

# Check database connection
psql -h localhost -U formbuilder_app -d formbuilder_production -c "SELECT 1;"

# Check Redis connection
redis-cli -a your-redis-password ping
```

**High Memory Usage**
```bash
# Check memory usage
free -h
pm2 monit

# Restart application if needed
pm2 restart formbuilder-app

# Check for memory leaks
pm2 logs formbuilder-app | grep "memory"
```

**Database Performance Issues**
```bash
# Check active connections
psql -d formbuilder_production -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
psql -d formbuilder_production -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check locks
psql -d formbuilder_production -c "SELECT * FROM pg_locks WHERE NOT GRANTED;"
```

---

🚀 **Deployment Complete!** Your multi-user Form Builder is now running in production.  

**Next Steps**:
- Monitor application metrics
- Set up automated backups
- Configure alerting
- Perform security audits
- Plan capacity scaling