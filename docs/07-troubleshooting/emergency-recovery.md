# Emergency Recovery Procedures

## 🚨 Quick Response Guide

### System Status Check
```bash
# Check all services status
./stability-monitoring.js

# Check specific service
curl http://localhost:5000/health  # Backend
curl http://localhost:3000          # Frontend
```

## 📊 Alert Response Procedures

### 1. Memory Emergency (>95% Usage)

**Immediate Actions:**
```bash
# 1. Identify memory-hungry processes
top -o %MEM

# 2. Restart backend with memory limits
kill $(cat backend.pid)
NODE_OPTIONS="--max-old-space-size=2048" npm run dev --prefix backend &

# 3. Clear application caches
redis-cli FLUSHDB  # If using Redis
rm -rf /tmp/cache/* # Clear temp caches

# 4. Check for memory leaks
node --inspect backend/src/server.js
# Use Chrome DevTools to profile memory
```

**Root Cause Analysis:**
- Check `stability-monitor.log` for patterns
- Review recent code changes
- Analyze database query performance

### 2. CPU Emergency (>95% Usage)

**Immediate Actions:**
```bash
# 1. Identify CPU-intensive processes
top -o %CPU

# 2. Check for infinite loops or runaway processes
ps aux | grep node
kill -9 [PID]  # Force kill if necessary

# 3. Restart services with CPU limits
cpulimit -l 80 -p $(pgrep node)

# 4. Scale horizontally if possible
pm2 start backend/src/server.js -i 4  # Start 4 instances
```

### 3. Backend Not Responding

**Immediate Actions:**
```bash
# 1. Check if backend is running
ps aux | grep "node.*server"

# 2. Restart backend service
./start-server.sh

# 3. Check port availability
ss -tulpn | grep :5000
fuser -k 5000/tcp  # Kill process using port 5000

# 4. Start with debug logging
DEBUG=* npm run dev --prefix backend

# 5. Check database connection
PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "SELECT 1;"
```

### 4. Database Connection Issues

**Immediate Actions:**
```bash
# 1. Check PostgreSQL status
sudo systemctl status postgresql

# 2. Restart PostgreSQL
sudo systemctl restart postgresql

# 3. Check connection limits
PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "
  SELECT max_conn, used, res_for_super, max_conn-used-res_for_super AS available
  FROM (SELECT count(*) AS used FROM pg_stat_activity) t1,
       (SELECT setting::int AS max_conn FROM pg_settings WHERE name='max_connections') t2,
       (SELECT setting::int AS res_for_super FROM pg_settings WHERE name='superuser_reserved_connections') t3;"

# 4. Kill idle connections
PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle'
    AND state_change < current_timestamp - INTERVAL '10 minutes';"
```

### 5. High Response Time (>5s)

**Immediate Actions:**
```bash
# 1. Check slow queries
PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;"

# 2. Restart with optimized settings
./start-with-memory-limits.sh

# 3. Enable query caching
# Edit frontend/src/config/queryClient.ts
# Increase staleTime and cacheTime

# 4. Check network latency
ping -c 10 172.26.240.1
traceroute 172.26.240.1
```

### 6. Frontend Crashes/Freezes

**Immediate Actions:**
```bash
# 1. Clear browser cache and localStorage
# In browser console:
localStorage.clear()
sessionStorage.clear()

# 2. Restart frontend with production build
npm run build --prefix frontend
npm run preview --prefix frontend

# 3. Check for JavaScript errors
# Open browser DevTools Console

# 4. Disable problematic features temporarily
# Set feature flags in frontend/.env
VITE_DISABLE_ANIMATIONS=true
VITE_DISABLE_WEBSOCKETS=true
```

## 🔧 Recovery Scripts

### Full System Restart
```bash
#!/bin/bash
# emergency-restart.sh

echo "🚨 Emergency System Restart"

# Stop all services
kill $(cat backend.pid) 2>/dev/null
kill $(cat frontend.pid) 2>/dev/null
kill $(cat alert-monitor.pid) 2>/dev/null

# Clear caches and logs
rm -rf /tmp/cache/*
echo "" > stability-monitor.log
echo "" > alerts.log

# Restart with safe mode
NODE_ENV=production NODE_OPTIONS="--max-old-space-size=1024" npm run dev --prefix backend &
echo $! > backend.pid

npm run build --prefix frontend && npm run preview --prefix frontend &
echo $! > frontend.pid

# Start monitoring
./start-alert-monitoring.sh &

echo "✅ System restarted in safe mode"
```

### Database Recovery
```bash
#!/bin/bash
# db-recovery.sh

echo "🔧 Database Recovery"

# 1. Backup current state
PGPASSWORD='@abcd1234' pg_dump -h 172.26.240.1 -p 5432 -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Kill all connections
PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE pid <> pg_backend_pid();"

# 3. VACUUM and REINDEX
PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "VACUUM ANALYZE;"
PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "REINDEX DATABASE postgres;"

echo "✅ Database recovery complete"
```

## 📞 Escalation Procedures

### Severity Levels

1. **Level 1 - Warning** (Can wait 1-2 hours)
   - Memory usage 70-85%
   - Response time 1-3s
   - Error rate 1-5%
   - Action: Monitor closely, plan maintenance window

2. **Level 2 - Critical** (Requires immediate attention)
   - Memory usage 85-95%
   - Response time 3-5s
   - Error rate 5-10%
   - Action: Execute recovery procedures

3. **Level 3 - Emergency** (System down or failing)
   - Memory usage >95%
   - Response time >5s or timeout
   - Error rate >10%
   - Backend not responding
   - Action: Emergency restart, escalate to senior team

### Contact Information

- **On-Call Engineer**: Check schedule in team calendar
- **Database Admin**: For database-specific issues
- **Infrastructure Team**: For server/network issues
- **Development Lead**: For application-specific issues

## 📝 Post-Incident Procedures

1. **Document the incident:**
   ```bash
   echo "Incident $(date): [Description]" >> incidents.log
   ```

2. **Collect diagnostics:**
   ```bash
   # Create incident report directory
   mkdir incident_$(date +%Y%m%d_%H%M%S)
   cd incident_*
   
   # Collect logs
   cp ../stability-monitor.log .
   cp ../alerts.log .
   cp ../critical-alerts.log .
   
   # System state
   top -b -n 1 > system_state.txt
   ps aux > processes.txt
   netstat -tulpn > network.txt
   df -h > disk_usage.txt
   ```

3. **Root cause analysis:**
   - Review logs for patterns
   - Check recent deployments
   - Analyze metric trends
   - Document findings

4. **Preventive measures:**
   - Update monitoring thresholds
   - Add new health checks
   - Improve error handling
   - Update this documentation

## 🛠️ Preventive Maintenance

### Daily Tasks
- Review `stability-monitor.log`
- Check `alerts.log` for warnings
- Verify backup completion

### Weekly Tasks
- Analyze performance trends
- Update system packages
- Review and optimize slow queries
- Test recovery procedures

### Monthly Tasks
- Full system health check
- Database maintenance (VACUUM, REINDEX)
- Review and update thresholds
- Capacity planning review

## 🔍 Monitoring Commands Reference

```bash
# Real-time monitoring
watch -n 5 'curl -s http://localhost:5000/health | jq .'

# Database monitoring
watch -n 10 'PGPASSWORD="@abcd1234" psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "SELECT count(*) FROM pg_stat_activity;"'

# Memory monitoring
watch -n 5 'free -h'

# CPU monitoring
htop

# Network monitoring
iftop

# Disk I/O monitoring
iotop

# Process monitoring
ps aux --sort=-%mem | head -10  # Top 10 memory consumers
ps aux --sort=-%cpu | head -10  # Top 10 CPU consumers
```

## 📚 Additional Resources

- [Node.js Memory Management](https://nodejs.org/en/docs/guides/diagnostics/memory-leaks)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [React Performance Profiling](https://reactjs.org/docs/profiler.html)
- [System Monitoring Best Practices](https://www.brendangregg.com/usemethod.html)

---

**Last Updated**: $(date)
**Version**: 1.0
**Author**: System Administrator

⚠️ **Important**: Keep this document updated with any new issues and solutions discovered during operations.