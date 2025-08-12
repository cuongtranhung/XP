# Multi-User Form Builder - Administrator Guide

## 🛡️ System Administration Overview

This guide provides comprehensive information for system administrators managing the multi-user Form Builder platform, including security configuration, user management, monitoring, and troubleshooting.

## 🔧 System Configuration

### Environment Variables

**Core Application Settings**
```bash
# Application
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.yourcompany.com

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=formbuilder_production
DB_USERNAME=formbuilder_user
DB_PASSWORD=secure_database_password
DB_SSL=true
DB_CONNECTION_LIMIT=20
DB_IDLE_TIMEOUT=30000

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_EXPIRES_IN=24h
SESSION_SECRET=your-session-secret
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS Configuration
FRONTEND_URL=https://forms.yourcompany.com
ALLOWED_ORIGINS=https://forms.yourcompany.com,https://admin.yourcompany.com
```

**Security Configuration**
```bash
# Rate Limiting
FORM_CREATION_RATE_LIMIT=20        # Forms per hour per user
FORM_SUBMISSION_RATE_LIMIT=50      # Submissions per hour per IP
PUBLIC_STATS_RATE_LIMIT=200        # Public stats requests per hour per IP
FORM_CLONING_RATE_LIMIT=10         # Form clones per hour per user
DATA_EXPORT_RATE_LIMIT=5           # Data exports per hour per user
GENERAL_RATE_LIMIT=100             # General API requests per 15 min per IP

# File Upload Security
MAX_FILE_SIZE=10485760             # 10MB in bytes
ALLOWED_FILE_TYPES=text/csv,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

# Security Headers
HSTS_MAX_AGE=31536000              # 1 year
ENABLE_CSP=true
ENABLE_FRAME_GUARD=true
ENABLE_XSS_PROTECTION=true

# Admin Access (Optional IP Whitelist)
ADMIN_IP_WHITELIST=192.168.1.100,10.0.0.50
EXPORT_IP_WHITELIST=192.168.1.0/24
```

**Monitoring & Logging**
```bash
# Logging Configuration
LOG_LEVEL=info
SECURITY_LOG_LEVEL=warn
LOG_FORMAT=json
LOG_FILE_PATH=/var/log/formbuilder/application.log
SECURITY_LOG_FILE_PATH=/var/log/formbuilder/security.log

# Monitoring
ENABLE_HEALTH_CHECKS=true
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_INTERVAL=30000

# Alerts
ENABLE_SECURITY_MONITORING=true
ALERT_EMAIL=admin@yourcompany.com
WEBHOOK_SECURITY_ALERTS=https://your-monitoring-service.com/webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### Database Setup

**PostgreSQL Configuration**
```sql
-- Create database and user
CREATE DATABASE formbuilder_production;
CREATE USER formbuilder_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE formbuilder_production TO formbuilder_user;

-- Enable required extensions
\c formbuilder_production;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Configure connection limits
ALTER USER formbuilder_user CONNECTION LIMIT 20;

-- Set timezone
ALTER DATABASE formbuilder_production SET timezone TO 'UTC';
```

**Database Indexes for Performance**
```sql
-- Multi-user specific indexes
CREATE INDEX CONCURRENTLY idx_forms_owner_status ON forms(owner_id, status);
CREATE INDEX CONCURRENTLY idx_forms_status_created ON forms(status, created_at);
CREATE INDEX CONCURRENTLY idx_submissions_form_submitter ON form_submissions(form_id, submitter_id);
CREATE INDEX CONCURRENTLY idx_submissions_submitter_date ON form_submissions(submitter_id, submitted_at);
CREATE INDEX CONCURRENTLY idx_forms_public_stats ON forms(status, show_public_stats) WHERE status = 'published';

-- Performance indexes
CREATE INDEX CONCURRENTLY idx_forms_search ON forms USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX CONCURRENTLY idx_submissions_date ON form_submissions(submitted_at);
CREATE INDEX CONCURRENTLY idx_forms_slug ON forms(slug) WHERE slug IS NOT NULL;
```

## 👥 User Management

### User Roles and Permissions

**Role Hierarchy**
```
Super Admin (system_admin)
├── Full system access
├── User management
├── System configuration
├── Security monitoring
└── Database access

Admin (admin) 
├── User management (limited)
├── Form moderation
├── Analytics access
├── Support functions
└── No system config access

User (user)
├── Create/manage own forms
├── View all published forms
├── Submit to forms
├── Clone published forms
└── View own submissions only

Viewer (viewer)
├── View published forms only
├── Submit to forms
├── View own submissions
└── Cannot create forms
```

### User Management Commands

**Create Admin User**
```bash
# Using CLI tool
npm run create-admin -- \
  --email admin@company.com \
  --name "System Administrator" \
  --password "secure_admin_password" \
  --role admin

# Using database query
INSERT INTO users (id, email, full_name, password_hash, role, created_at, updated_at, is_active)
VALUES (
  gen_random_uuid(),
  'admin@company.com',
  'System Administrator',
  '$2a$10$hashed_password_here',
  'admin',
  NOW(),
  NOW(),
  true
);
```

**User Management Queries**
```sql
-- List all users with their activity
SELECT 
  u.email,
  u.full_name,
  u.role,
  u.is_active,
  u.created_at,
  u.last_login_at,
  COUNT(f.id) as forms_created,
  COUNT(s.id) as submissions_made
FROM users u
LEFT JOIN forms f ON f.owner_id = u.id
LEFT JOIN form_submissions s ON s.submitter_id = u.id
GROUP BY u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, u.last_login_at
ORDER BY u.created_at DESC;

-- Disable user account
UPDATE users SET is_active = false, updated_at = NOW() WHERE email = 'user@company.com';

-- Delete user and anonymize their data
BEGIN;
-- Anonymize submissions
UPDATE form_submissions 
SET submitter_id = NULL, data = jsonb_set(data, '{submitter_name}', '"[User Deleted]"')
WHERE submitter_id = 'user-uuid';
-- Transfer or delete forms
DELETE FROM forms WHERE owner_id = 'user-uuid';
-- Delete user
DELETE FROM users WHERE id = 'user-uuid';
COMMIT;
```

### Bulk User Operations

**Import Users from CSV**
```bash
# CSV format: email,full_name,role,is_active
# example.csv:
# john@company.com,John Doe,user,true
# admin@company.com,Admin User,admin,true

npm run import-users -- --file users.csv --send-welcome-email
```

**Export User Data**
```bash
# Export all users
npm run export-users -- --format csv --output users_export.csv

# Export specific role
npm run export-users -- --role admin --format json --output admins.json

# Export with activity data
npm run export-users -- --include-activity --output user_activity_report.csv
```

## 🔒 Security Management

### Security Monitoring Dashboard

**Key Metrics to Monitor**
```bash
# Rate limit violations
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as violations,
  endpoint,
  ip_address
FROM security_logs 
WHERE event = 'rate_limit_exceeded' 
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY hour, endpoint, ip_address
ORDER BY violations DESC;

# Failed authentication attempts
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as failed_attempts,
  ip_address,
  user_email
FROM security_logs 
WHERE event = 'login_failed'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY hour, ip_address, user_email
HAVING COUNT(*) > 5
ORDER BY failed_attempts DESC;

# Suspicious file uploads
SELECT 
  timestamp,
  user_id,
  ip_address,
  details->>'filename' as filename,
  details->>'reason' as rejection_reason
FROM security_logs 
WHERE event = 'file_upload_rejected'
  AND timestamp > NOW() - INTERVAL '7 days'
ORDER BY timestamp DESC;

# XSS attempt detection
SELECT 
  timestamp,
  user_id,
  ip_address,
  endpoint,
  details->>'content' as malicious_content
FROM security_logs 
WHERE event = 'xss_attempt_blocked'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

### Security Configuration Management

**Update Rate Limits**
```bash
# Environment variable update
export FORM_CREATION_RATE_LIMIT=30    # Increase from 20 to 30
export FORM_SUBMISSION_RATE_LIMIT=100 # Increase from 50 to 100

# Dynamic configuration (if implemented)
curl -X PUT https://api.yourcompany.com/admin/rate-limits \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "formCreation": 30,
    "formSubmission": 100,
    "publicStats": 200
  }'
```

**IP Address Management**
```bash
# Add IP to whitelist
curl -X POST https://api.yourcompany.com/admin/ip-whitelist \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "192.168.1.150",
    "reason": "New office location",
    "expires": "2024-12-31T23:59:59Z"
  }'

# Block suspicious IP
curl -X POST https://api.yourcompany.com/admin/ip-blacklist \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "suspicious.ip.address",
    "reason": "Multiple failed auth attempts",
    "duration": "24h"
  }'
```

### SSL/TLS Configuration

**Nginx SSL Configuration**
```nginx
server {
    listen 443 ssl http2;
    server_name forms.yourcompany.com;
    
    # SSL Configuration
    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private-key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Security Headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # CSP Header
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Rate limiting
        limit_req zone=api burst=10 nodelay;
        limit_req_status 429;
    }
    
    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
}
```

## 📊 System Monitoring

### Health Check Endpoints

**Application Health**
```bash
# Basic health check
curl https://api.yourcompany.com/health
# Response: {"status":"healthy","timestamp":"2024-03-15T16:00:00Z","version":"2.0.0"}

# Detailed health check
curl https://api.yourcompany.com/health/detailed
```

```json
{
  "status": "healthy",
  "timestamp": "2024-03-15T16:00:00Z",
  "version": "2.0.0",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 12,
      "connections": {
        "active": 8,
        "idle": 12,
        "total": 20
      }
    },
    "redis": {
      "status": "healthy",
      "responseTime": 3
    },
    "fileStorage": {
      "status": "healthy",
      "diskUsage": "45%"
    }
  },
  "metrics": {
    "uptime": 86400,
    "memoryUsage": "512MB",
    "cpuUsage": "15%"
  }
}
```

### Performance Metrics

**System Performance Queries**
```sql
-- Database performance
SELECT 
  schemaname,
  tablename,
  n_tup_ins + n_tup_upd + n_tup_del as total_writes,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  seq_scan,
  idx_scan
FROM pg_stat_user_tables 
ORDER BY total_writes DESC;

-- Slow queries (requires pg_stat_statements)
SELECT 
  query,
  calls,
  total_time,
  total_time/calls as avg_time,
  stddev_time,
  rows
FROM pg_stat_statements 
WHERE total_time > 1000
ORDER BY total_time DESC 
LIMIT 10;

-- Connection statistics
SELECT 
  state,
  COUNT(*) as connections
FROM pg_stat_activity 
WHERE datname = 'formbuilder_production'
GROUP BY state;
```

**Application Metrics**
```bash
# Prometheus metrics endpoint
curl https://api.yourcompany.com/metrics

# Key metrics to monitor:
# - form_creations_total
# - form_submissions_total  
# - rate_limit_violations_total
# - security_events_total
# - response_time_seconds
# - active_users_gauge
# - database_connections_active
```

### Log Analysis

**Security Log Analysis**
```bash
# High-frequency IP addresses
tail -n 10000 /var/log/formbuilder/security.log | \
  jq -r '.ip' | sort | uniq -c | sort -nr | head -20

# Failed authentication attempts by user
tail -n 10000 /var/log/formbuilder/security.log | \
  jq -r 'select(.event == "login_failed") | .userEmail' | \
  sort | uniq -c | sort -nr

# Rate limit violations by endpoint
tail -n 10000 /var/log/formbuilder/security.log | \
  jq -r 'select(.event == "rate_limit_exceeded") | .details.endpoint' | \
  sort | uniq -c | sort -nr

# XSS attempts analysis
grep "xss_attempt_blocked" /var/log/formbuilder/security.log | \
  jq -r '.details.content' | head -10
```

**Application Log Analysis**
```bash
# Error frequency
tail -n 10000 /var/log/formbuilder/application.log | \
  jq -r 'select(.level == "error") | .message' | \
  sort | uniq -c | sort -nr

# Response time analysis
tail -n 10000 /var/log/formbuilder/application.log | \
  jq -r 'select(.responseTime != null) | .responseTime' | \
  awk '{sum+=$1; count++} END {print "Average:", sum/count, "ms"}'

# API endpoint usage
tail -n 10000 /var/log/formbuilder/application.log | \
  jq -r 'select(.path != null) | .method + " " + .path' | \
  sort | uniq -c | sort -nr | head -20
```

## 📈 Analytics & Reporting

### System Usage Reports

**Daily Usage Report**
```sql
-- Generate daily usage statistics
WITH daily_stats AS (
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as forms_created
  FROM forms 
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(created_at)
),
submission_stats AS (
  SELECT 
    DATE(submitted_at) as date,
    COUNT(*) as submissions_made,
    COUNT(DISTINCT submitter_id) as unique_submitters
  FROM form_submissions 
  WHERE submitted_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(submitted_at)
),
user_stats AS (
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as users_registered
  FROM users 
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(created_at)
)
SELECT 
  COALESCE(d.date, s.date, u.date) as date,
  COALESCE(forms_created, 0) as forms_created,
  COALESCE(submissions_made, 0) as submissions_made,
  COALESCE(unique_submitters, 0) as unique_submitters,
  COALESCE(users_registered, 0) as users_registered
FROM daily_stats d
FULL OUTER JOIN submission_stats s ON d.date = s.date
FULL OUTER JOIN user_stats u ON COALESCE(d.date, s.date) = u.date
ORDER BY date DESC;
```

**User Activity Report**
```sql
-- Top active users
SELECT 
  u.email,
  u.full_name,
  u.role,
  COUNT(DISTINCT f.id) as forms_created,
  COUNT(DISTINCT s.id) as submissions_made,
  MAX(u.last_login_at) as last_login,
  CASE 
    WHEN MAX(u.last_login_at) > NOW() - INTERVAL '7 days' THEN 'Active'
    WHEN MAX(u.last_login_at) > NOW() - INTERVAL '30 days' THEN 'Recent'
    ELSE 'Inactive'
  END as activity_status
FROM users u
LEFT JOIN forms f ON f.owner_id = u.id
LEFT JOIN form_submissions s ON s.submitter_id = u.id
WHERE u.is_active = true
GROUP BY u.id, u.email, u.full_name, u.role
ORDER BY (COUNT(DISTINCT f.id) + COUNT(DISTINCT s.id)) DESC
LIMIT 50;
```

### Automated Reporting

**Weekly Security Report Script**
```bash
#!/bin/bash
# weekly-security-report.sh

REPORT_DATE=$(date +"%Y-%m-%d")
REPORT_FILE="/var/reports/security-report-${REPORT_DATE}.txt"

echo "Form Builder Security Report - Week ending ${REPORT_DATE}" > $REPORT_FILE
echo "================================================================" >> $REPORT_FILE

# Rate limit violations
echo -e "\nRate Limit Violations (Last 7 days):" >> $REPORT_FILE
psql -d formbuilder_production -c "
SELECT 
  DATE_TRUNC('day', timestamp) as day,
  COUNT(*) as violations,
  endpoint
FROM security_logs 
WHERE event = 'rate_limit_exceeded' 
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY day, endpoint
ORDER BY violations DESC;" >> $REPORT_FILE

# Failed logins
echo -e "\nFailed Login Attempts (Last 7 days):" >> $REPORT_FILE
psql -d formbuilder_production -c "
SELECT 
  ip_address,
  user_email,
  COUNT(*) as attempts
FROM security_logs 
WHERE event = 'login_failed'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY ip_address, user_email
HAVING COUNT(*) > 5
ORDER BY attempts DESC;" >> $REPORT_FILE

# Send report via email
mail -s "Form Builder Security Report - ${REPORT_DATE}" admin@company.com < $REPORT_FILE
```

## 🔧 Maintenance Operations

### Database Maintenance

**Regular Maintenance Tasks**
```bash
# Vacuum and analyze tables
psql -d formbuilder_production -c "
VACUUM ANALYZE forms;
VACUUM ANALYZE form_submissions;
VACUUM ANALYZE users;
VACUUM ANALYZE security_logs;
"

# Update table statistics
psql -d formbuilder_production -c "
ANALYZE forms;
ANALYZE form_submissions;
ANALYZE users;
"

# Check for unused indexes
psql -d formbuilder_production -c "
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY schemaname, tablename;"
```

**Log Rotation**
```bash
# /etc/logrotate.d/formbuilder
/var/log/formbuilder/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 formbuilder formbuilder
    postrotate
        systemctl reload formbuilder
    endscript
}
```

### Backup Procedures

**Database Backup**
```bash
#!/bin/bash
# backup-database.sh

BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/formbuilder"
BACKUP_FILE="${BACKUP_DIR}/formbuilder_${BACKUP_DATE}.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create database backup
pg_dump -h localhost -U formbuilder_user -d formbuilder_production > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to cloud storage (example with AWS S3)
aws s3 cp "${BACKUP_FILE}.gz" s3://your-backup-bucket/database/

# Clean up old local backups (keep last 7 days)
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Database backup completed: ${BACKUP_FILE}.gz"
```

**File Storage Backup**
```bash
#!/bin/bash
# backup-files.sh

BACKUP_DATE=$(date +"%Y%m%d_%H%M%S")
FILES_DIR="/var/formbuilder/uploads"
BACKUP_DIR="/var/backups/formbuilder"

# Create tar archive of uploaded files
tar -czf "${BACKUP_DIR}/files_${BACKUP_DATE}.tar.gz" -C $FILES_DIR .

# Upload to cloud storage
aws s3 cp "${BACKUP_DIR}/files_${BACKUP_DATE}.tar.gz" s3://your-backup-bucket/files/

# Clean up old backups
find $BACKUP_DIR -name "files_*.tar.gz" -mtime +30 -delete
```

### System Updates

**Application Updates**
```bash
# Backup before update
./backup-database.sh
./backup-files.sh

# Update application
git pull origin main
npm ci --production
npm run build

# Run database migrations
npm run migrate

# Restart services
systemctl restart formbuilder
systemctl restart nginx

# Verify health
curl -f https://api.yourcompany.com/health || echo "Health check failed!"

# Run smoke tests
npm run test:smoke
```

## 🚨 Incident Response

### Common Issues & Solutions

**High Database Load**
```bash
# Check active queries
psql -d formbuilder_production -c "
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';"

# Kill long-running queries if needed
psql -d formbuilder_production -c "SELECT pg_terminate_backend(PID);"
```

**Memory Issues**
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Restart application if needed
systemctl restart formbuilder

# Check for memory leaks
valgrind --tool=memcheck --leak-check=full npm start
```

**Rate Limit Issues**
```bash
# Check rate limit violations
tail -f /var/log/formbuilder/security.log | grep rate_limit_exceeded

# Temporarily increase limits (restart required)
export FORM_SUBMISSION_RATE_LIMIT=100
systemctl restart formbuilder

# Block problematic IPs
ufw deny from suspicious.ip.address
```

### Emergency Procedures

**Service Outage Response**
1. **Immediate Response** (0-5 minutes)
   - Check service status: `systemctl status formbuilder`
   - Check health endpoint: `curl https://api.yourcompany.com/health`
   - Check system resources: `htop`, `df -h`
   - Check error logs: `tail -f /var/log/formbuilder/application.log`

2. **Investigation** (5-15 minutes)
   - Identify root cause from logs
   - Check database connectivity
   - Verify external dependencies
   - Review recent changes

3. **Recovery** (15-30 minutes)
   - Apply immediate fixes
   - Restart services if needed
   - Verify functionality restoration
   - Monitor for stability

4. **Communication** (Ongoing)
   - Update status page
   - Notify affected users
   - Prepare incident report

**Security Incident Response**
1. **Detection & Analysis**
   - Identify security event type
   - Assess impact and scope
   - Collect evidence and logs

2. **Containment**
   - Block malicious IPs
   - Disable compromised accounts
   - Isolate affected systems

3. **Eradication**
   - Remove malicious content
   - Patch vulnerabilities
   - Update security measures

4. **Recovery**
   - Restore services
   - Monitor for recurrence
   - Validate security controls

5. **Post-Incident**
   - Document lessons learned
   - Update procedures
   - Implement preventive measures

## 📞 Support & Escalation

### Contact Information
- **System Administrator**: admin@yourcompany.com
- **Security Team**: security@yourcompany.com  
- **On-Call Engineer**: +1-XXX-XXX-XXXX
- **Vendor Support**: support@formbuilder-vendor.com

### Escalation Matrix
1. **Level 1**: System Administrator
2. **Level 2**: Lead Developer / DevOps Engineer
3. **Level 3**: CTO / Security Officer
4. **Level 4**: External Vendor Support

---

📋 **Admin Dashboard**: https://admin.formbuilder.com  
📊 **Monitoring**: https://monitoring.formbuilder.com  
📖 **Documentation**: https://docs.formbuilder.com/admin