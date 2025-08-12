# Backend Monitoring Guide

**Last Updated**: 2025-08-05  
**Version**: 1.1.0

## 📊 Overview

This guide provides comprehensive monitoring instructions for the backend system, focusing on database connections, external services, and system health.

## 🏥 Health Check Endpoints

### 1. Main Health Endpoint
```bash
GET /health
```

**Response Structure**:
```json
{
  "status": "healthy|degraded|critical",
  "timestamp": "2025-08-05T16:51:15.482Z",
  "uptime": 232.753737581,
  "environment": "development|production",
  "version": "1.1.0",
  "database": {
    "status": "healthy|warning|critical",
    "connected": true,
    "responseTime": "1ms",
    "poolInfo": {
      "totalCount": 2,
      "idleCount": 1,
      "waitingCount": 0,
      "maxConnections": 20,
      "utilization": 10.0,
      "waitingRatio": 0.0
    },
    "alerts": ["High connection pool utilization (>80%)"]
  }
}
```

**Alert Thresholds**:
- 🟢 **Healthy**: <80% utilization, <1000ms response time
- 🟡 **Warning**: 80-90% utilization, >1000ms response time, waiting queue >0
- 🔴 **Critical**: >90% utilization, connection failures

### 2. Email Service Health
```bash
GET /health/email
```

**Response Structure**:
```json
{
  "healthy": true,
  "service": "Email Service",
  "circuitBreaker": {
    "state": "CLOSED|HALF_OPEN|OPEN",
    "failureCount": 0,
    "successCount": 5,
    "lastFailureTime": 0,
    "timeSinceLastFailure": null
  },
  "connection": {
    "testPassed": true,
    "smtpHost": "smtp.gmail.com",
    "smtpPort": "587"
  },
  "recommendations": []
}
```

**Circuit Breaker States**:
- 🟢 **CLOSED**: Normal operation
- 🟡 **HALF_OPEN**: Testing recovery after failures
- 🔴 **OPEN**: Service blocked due to failures

### 3. UAL (User Activity Logging) Health
```bash
GET /health/ual
```

**Response Structure**:
```json
{
  "healthy": true,
  "service": "User Activity Logging (UAL)",
  "ualMetrics": {
    "enabled": true,
    "queueSize": 25,
    "maxQueueSize": 1000,
    "circuitBreakerState": "CLOSED"
  },
  "database": {
    "healthy": true,
    "tableExists": true,
    "recentActivity": 150
  },
  "issues": [],
  "recommendations": []
}
```

### 4. Database Specific Health
```bash
GET /health/database
```

**Detailed database metrics including version, user, and comprehensive pool information.**

### 5. GPS Service Health
```bash
GET /health/gps
```

**GPS-specific monitoring including location tables, active sessions, and indexing status.**

## 🚨 Alert Thresholds & Actions

### Database Connection Pool

| Metric | Threshold | Severity | Action Required |
|--------|-----------|----------|-----------------|
| Utilization | >90% | 🔴 Critical | Immediate investigation - potential deadlock |
| Utilization | >80% | 🟡 Warning | Monitor closely, check for connection leaks |
| Waiting Queue | >0 | 🟡 Warning | Active connections may be blocked |
| Response Time | >1000ms | 🟡 Warning | Database performance investigation |

### Circuit Breaker Monitoring

| State | Severity | Action Required |
|-------|----------|-----------------|
| OPEN | 🔴 Critical | Check external service connectivity |
| HALF_OPEN | 🟡 Warning | Monitor recovery process |
| Failure Count >3 | 🟡 Warning | Investigate service reliability |

### UAL System Monitoring

| Metric | Threshold | Severity | Action Required |
|--------|-----------|----------|-----------------|
| Queue Size | >800 (80%) | 🟡 Warning | Consider increasing processing rate |
| Queue Drops | >0 | 🟡 Warning | Increase queue size or processing interval |
| Circuit Breaker Trips | >0 | 🔴 Critical | Database connectivity issues |
| No Recent Activity | 0 logs/hour | 🟡 Warning | Verify logging is working |

## 📈 Monitoring Best Practices

### 1. **Regular Health Checks**
```bash
# Basic health check
curl http://localhost:5000/health

# Comprehensive system status
curl http://localhost:5000/health/database
curl http://localhost:5000/health/email
curl http://localhost:5000/health/ual
```

### 2. **Automated Monitoring Script**
```bash
#!/bin/bash
# monitor.sh - Basic health monitoring script

API_BASE="http://localhost:5000"

echo "=== System Health Check ==="
echo "Main Health:"
curl -s $API_BASE/health | jq '.status, .database.poolInfo'

echo -e "\nEmail Service:"
curl -s $API_BASE/health/email | jq '.healthy, .circuitBreaker.state'

echo -e "\nUAL Status:"
curl -s $API_BASE/health/ual | jq '.healthy, .ualMetrics.enabled'
```

### 3. **Connection Pool Monitoring**
```bash
# Monitor pool utilization
curl -s http://localhost:5000/health | jq '.database.poolInfo'

# Expected healthy output:
# {
#   "totalCount": 2,
#   "idleCount": 1,
#   "waitingCount": 0,
#   "maxConnections": 20,
#   "utilization": 10.0
# }
```

## 🔍 Troubleshooting Guide

### Connection Pool Issues

**Symptoms**: High utilization (>80%), waiting connections
```bash
# Check current pool status
curl http://localhost:5000/health | jq '.database.poolInfo'

# Look for connection leaks in logs
grep "client.release" backend.log
grep "connection" backend.log | tail -20
```

**Solutions**:
1. Restart backend service to reset pool
2. Check for connection leaks in recent code changes
3. Increase pool size if load is genuinely high

### Circuit Breaker Issues

**Symptoms**: Circuit breaker OPEN state, email failures
```bash
# Check circuit breaker status
curl http://localhost:5000/health/email | jq '.circuitBreaker'
```

**Solutions**:
1. Verify SMTP server connectivity
2. Check email service credentials
3. Wait for automatic recovery (30 seconds)

### UAL System Issues

**Symptoms**: UAL disabled, high queue size, no recent activity
```bash
# Check UAL status
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/activity-control/status

# Check UAL health
curl http://localhost:5000/health/ual
```

**Solutions**:
1. Enable UAL via admin API
2. Check database connectivity
3. Verify user_activity_logs table exists

## 📊 Performance Baselines

### Normal Operating Ranges

| Metric | Healthy Range | Warning Threshold | Critical Threshold |
|--------|---------------|-------------------|-------------------|
| DB Pool Utilization | 0-50% | 50-80% | >80% |
| Response Time | <100ms | 100-1000ms | >1000ms |
| Memory Usage (Heap) | <200MB | 200-400MB | >400MB |
| UAL Queue Size | 0-200 | 200-800 | >800 |

### Expected Performance
- **Health Check Response**: <10ms
- **UAL Toggle Operations**: <50ms
- **Database Queries**: <5ms average
- **Connection Acquisition**: <100ms

## 🚀 Production Monitoring

### 1. **Automated Alerts**
Set up monitoring tools to check health endpoints every 30 seconds:
- Nagios, Zabbix, or Prometheus integration
- Slack/email notifications for critical issues
- Dashboard visualization of key metrics

### 2. **Log Monitoring**
Monitor application logs for critical patterns:
```bash
# Critical error patterns to watch
tail -f backend.log | grep -E "(ERROR|CRITICAL|FATAL|timeout|deadlock)"

# Connection-related issues
tail -f backend.log | grep -E "(connection|pool|client)"
```

### 3. **Database Monitoring**
```sql
-- Monitor active connections
SELECT count(*) as active_connections FROM pg_stat_activity;

-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Monitor query performance
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC LIMIT 10;
```

## 📞 Emergency Response

### Critical Issues (System Down)
1. **Check health endpoint**: `curl http://localhost:5000/health`
2. **Restart services**: `pm2 restart backend` or `systemctl restart backend`
3. **Check connection pool**: Look for 100% utilization
4. **Review recent changes**: Check git log for recent deployments

### Warning Issues (Degraded Performance)
1. **Monitor trends**: Check if issues are increasing
2. **Review logs**: Look for error patterns
3. **Connection pool**: Monitor for gradual increase in utilization
4. **Proactive action**: Consider restarting during maintenance window

---

**Note**: This monitoring guide should be reviewed monthly and updated as the system evolves.