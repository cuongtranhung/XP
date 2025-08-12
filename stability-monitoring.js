#!/usr/bin/env node
/**
 * System Stability Monitoring Script
 * Monitors frontend and backend for crashes, freezes, and resource issues
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class StabilityMonitor {
  constructor() {
    this.logFile = path.join(__dirname, 'stability-monitor.log');
    this.config = {
      checkInterval: 30000, // 30 seconds
      memoryThreshold: 500 * 1024 * 1024, // 500MB
      cpuThreshold: 80, // 80%
      responseTimeThreshold: 5000, // 5 seconds
      maxLogEntries: 1000
    };
    this.checks = [];
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message,
      ...data
    };
    
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, 
      Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '');
    
    // Write to log file
    try {
      const logLine = `${timestamp} [${level}] ${message} ${JSON.stringify(data)}\n`;
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  async checkProcessHealth() {
    return new Promise((resolve) => {
      exec('ps aux | grep -E "(node|npm)" | grep -v grep', (error, stdout) => {
        if (error) {
          this.log('error', 'Failed to check process health', { error: error.message });
          return resolve({ status: 'error', processes: [] });
        }

        const processes = stdout.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              pid: parts[1],
              cpu: parseFloat(parts[2]) || 0,
              memory: parseFloat(parts[3]) || 0,
              command: parts.slice(10).join(' ')
            };
          });

        // Check for high resource usage
        const criticalProcesses = processes.filter(p => 
          p.cpu > this.config.cpuThreshold || p.memory > 10 // 10% memory
        );

        if (criticalProcesses.length > 0) {
          this.log('warn', 'High resource usage detected', { 
            criticalProcesses: criticalProcesses.map(p => ({
              pid: p.pid,
              cpu: `${p.cpu}%`,
              memory: `${p.memory}%`
            }))
          });
        }

        resolve({ 
          status: 'ok', 
          processes,
          criticalCount: criticalProcesses.length 
        });
      });
    });
  }

  async checkBackendHealth() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      exec('curl -s -w "%{http_code},%{time_total}" http://localhost:5000/health', 
        { timeout: 10000 }, (error, stdout, stderr) => {
        const responseTime = Date.now() - startTime;
        
        if (error) {
          this.log('error', 'Backend health check failed', { 
            error: error.message,
            responseTime 
          });
          return resolve({ status: 'error', responseTime });
        }

        try {
          const parts = stdout.split(',');
          const statusCode = parseInt(parts[parts.length - 2]) || 0;
          const curlTime = parseFloat(parts[parts.length - 1]) || 0;
          
          if (statusCode === 200) {
            if (curlTime * 1000 > this.config.responseTimeThreshold) {
              this.log('warn', 'Slow backend response detected', { 
                responseTime: `${curlTime}s`,
                threshold: `${this.config.responseTimeThreshold/1000}s`
              });
            }
            
            resolve({ 
              status: 'ok', 
              statusCode, 
              responseTime: curlTime * 1000 
            });
          } else {
            this.log('error', 'Backend returned non-200 status', { 
              statusCode,
              responseTime: curlTime * 1000 
            });
            resolve({ status: 'error', statusCode, responseTime: curlTime * 1000 });
          }
        } catch (parseError) {
          this.log('error', 'Failed to parse backend response', { 
            error: parseError.message,
            stdout 
          });
          resolve({ status: 'error', responseTime });
        }
      });
    });
  }

  async checkDatabaseConnection() {
    return new Promise((resolve) => {
      const cmd = `PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "SELECT 1 as test_connection;" -t`;
      
      exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          this.log('error', 'Database connection failed', { 
            error: error.message,
            stderr 
          });
          return resolve({ status: 'error' });
        }

        if (stdout.trim() === '1') {
          resolve({ status: 'ok' });
        } else {
          this.log('warn', 'Database connection unclear', { stdout, stderr });
          resolve({ status: 'warn' });
        }
      });
    });
  }

  async checkSystemResources() {
    return new Promise((resolve) => {
      exec('free -m && df -h /', (error, stdout, stderr) => {
        if (error) {
          this.log('error', 'Failed to check system resources', { 
            error: error.message 
          });
          return resolve({ status: 'error' });
        }

        const lines = stdout.split('\n');
        const memoryLine = lines.find(line => line.startsWith('Mem:'));
        const diskLine = lines.find(line => line.includes('/'));

        if (memoryLine) {
          const memParts = memoryLine.split(/\s+/);
          const totalMem = parseInt(memParts[1]);
          const usedMem = parseInt(memParts[2]);
          const memUsagePercent = (usedMem / totalMem) * 100;

          if (memUsagePercent > 85) {
            this.log('warn', 'High memory usage detected', {
              usagePercent: `${memUsagePercent.toFixed(1)}%`,
              usedMB: usedMem,
              totalMB: totalMem
            });
          }
        }

        resolve({ 
          status: 'ok',
          memory: memoryLine,
          disk: diskLine 
        });
      });
    });
  }

  async runHealthChecks() {
    this.log('info', 'Running stability health checks...');
    
    const results = {
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Run all health checks
    try {
      results.checks.processes = await this.checkProcessHealth();
      results.checks.backend = await this.checkBackendHealth();
      results.checks.database = await this.checkDatabaseConnection();
      results.checks.system = await this.checkSystemResources();

      // Overall health assessment
      const errorCount = Object.values(results.checks)
        .filter(check => check.status === 'error').length;
      const warnCount = Object.values(results.checks)
        .filter(check => check.status === 'warn').length;

      if (errorCount > 0) {
        this.log('error', `Health check failed - ${errorCount} errors, ${warnCount} warnings`, {
          summary: results.checks
        });
      } else if (warnCount > 0) {
        this.log('warn', `Health check completed with warnings - ${warnCount} issues`, {
          summary: results.checks
        });
      } else {
        this.log('info', 'All health checks passed');
      }

      this.checks.push(results);
      
      // Keep only recent checks
      if (this.checks.length > this.config.maxLogEntries) {
        this.checks = this.checks.slice(-this.config.maxLogEntries);
      }

    } catch (error) {
      this.log('error', 'Health check execution failed', { 
        error: error.message 
      });
    }
  }

  getHealthReport() {
    const recent = this.checks.slice(-10);
    const totalErrors = recent.reduce((sum, check) => {
      return sum + Object.values(check.checks)
        .filter(c => c.status === 'error').length;
    }, 0);
    
    const totalWarnings = recent.reduce((sum, check) => {
      return sum + Object.values(check.checks)
        .filter(c => c.status === 'warn').length;
    }, 0);

    return {
      recentChecks: recent.length,
      totalErrors,
      totalWarnings,
      lastCheck: recent[recent.length - 1]?.timestamp || 'Never',
      overallHealth: totalErrors === 0 ? 
        (totalWarnings === 0 ? 'Excellent' : 'Good') : 'Poor'
    };
  }

  start() {
    this.log('info', 'Starting stability monitoring', {
      interval: `${this.config.checkInterval/1000}s`,
      thresholds: {
        memory: `${this.config.memoryThreshold/1024/1024}MB`,
        cpu: `${this.config.cpuThreshold}%`,
        responseTime: `${this.config.responseTimeThreshold/1000}s`
      }
    });

    // Initial check
    this.runHealthChecks();

    // Schedule periodic checks
    this.interval = setInterval(() => {
      this.runHealthChecks();
    }, this.config.checkInterval);

    // Graceful shutdown
    process.on('SIGINT', () => {
      this.log('info', 'Stopping stability monitoring...');
      if (this.interval) {
        clearInterval(this.interval);
      }
      
      const report = this.getHealthReport();
      this.log('info', 'Final health report', report);
      
      process.exit(0);
    });
  }
}

// Run if executed directly
if (require.main === module) {
  const monitor = new StabilityMonitor();
  monitor.start();
}

module.exports = StabilityMonitor;