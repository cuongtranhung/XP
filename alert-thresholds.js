#!/usr/bin/env node

/**
 * Alert Thresholds Configuration and Monitoring
 * Monitors critical system metrics and triggers alerts when thresholds are exceeded
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios').default;
const os = require('os');

// Alert threshold configuration
const THRESHOLDS = {
  // Memory thresholds
  memory: {
    warning: 70,    // 70% memory usage triggers warning
    critical: 85,   // 85% memory usage triggers critical alert
    emergency: 95   // 95% memory usage triggers emergency alert
  },
  
  // CPU thresholds
  cpu: {
    warning: 60,    // 60% CPU usage triggers warning
    critical: 80,   // 80% CPU usage triggers critical alert
    emergency: 95   // 95% CPU usage triggers emergency alert
  },
  
  // Response time thresholds (milliseconds)
  responseTime: {
    warning: 1000,   // 1 second
    critical: 3000,  // 3 seconds
    emergency: 5000  // 5 seconds
  },
  
  // Error rate thresholds (percentage)
  errorRate: {
    warning: 1,      // 1% error rate
    critical: 5,     // 5% error rate
    emergency: 10    // 10% error rate
  },
  
  // Database connection pool
  dbConnections: {
    warning: 40,     // 40 connections
    critical: 45,    // 45 connections
    emergency: 48    // 48 connections (near max of 50)
  },
  
  // Disk usage thresholds
  diskUsage: {
    warning: 70,     // 70% disk usage
    critical: 85,    // 85% disk usage
    emergency: 95    // 95% disk usage
  },
  
  // Request queue size
  queueSize: {
    warning: 100,    // 100 queued requests
    critical: 500,   // 500 queued requests
    emergency: 1000  // 1000 queued requests
  }
};

// Alert levels
const AlertLevel = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  EMERGENCY: 'EMERGENCY'
};

// Alert history to prevent spam
const alertHistory = new Map();
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown between same alerts

class AlertManager {
  constructor() {
    this.logFile = path.join(__dirname, 'alerts.log');
    this.criticalLogFile = path.join(__dirname, 'critical-alerts.log');
  }

  /**
   * Check if an alert should be triggered based on cooldown
   */
  shouldAlert(alertKey) {
    const lastAlert = alertHistory.get(alertKey);
    if (!lastAlert) return true;
    
    const timeSinceLastAlert = Date.now() - lastAlert;
    return timeSinceLastAlert > ALERT_COOLDOWN;
  }

  /**
   * Trigger an alert
   */
  triggerAlert(metric, value, level, threshold) {
    const alertKey = `${metric}-${level}`;
    
    if (!this.shouldAlert(alertKey)) {
      return; // Skip due to cooldown
    }
    
    const alert = {
      timestamp: new Date().toISOString(),
      metric,
      value,
      level,
      threshold,
      message: this.formatAlertMessage(metric, value, level, threshold)
    };
    
    // Log the alert
    this.logAlert(alert);
    
    // Send notifications based on level
    this.sendNotifications(alert);
    
    // Update alert history
    alertHistory.set(alertKey, Date.now());
    
    return alert;
  }

  /**
   * Format alert message
   */
  formatAlertMessage(metric, value, level, threshold) {
    const emoji = this.getAlertEmoji(level);
    return `${emoji} ${level}: ${metric} is at ${value} (threshold: ${threshold})`;
  }

  /**
   * Get emoji for alert level
   */
  getAlertEmoji(level) {
    switch (level) {
      case AlertLevel.INFO: return 'ℹ️';
      case AlertLevel.WARNING: return '⚠️';
      case AlertLevel.CRITICAL: return '🚨';
      case AlertLevel.EMERGENCY: return '🔴';
      default: return '📊';
    }
  }

  /**
   * Log alert to file
   */
  logAlert(alert) {
    const logEntry = JSON.stringify(alert) + '\n';
    
    // Always log to main alert file
    fs.appendFileSync(this.logFile, logEntry);
    
    // Log critical and emergency alerts to separate file
    if (alert.level === AlertLevel.CRITICAL || alert.level === AlertLevel.EMERGENCY) {
      fs.appendFileSync(this.criticalLogFile, logEntry);
    }
    
    // Console output with color
    const color = this.getConsoleColor(alert.level);
    console.log(color, alert.message);
  }

  /**
   * Get console color based on alert level
   */
  getConsoleColor(level) {
    switch (level) {
      case AlertLevel.WARNING: return '\x1b[33m%s\x1b[0m'; // Yellow
      case AlertLevel.CRITICAL: return '\x1b[31m%s\x1b[0m'; // Red
      case AlertLevel.EMERGENCY: return '\x1b[41m%s\x1b[0m'; // Red background
      default: return '\x1b[36m%s\x1b[0m'; // Cyan
    }
  }

  /**
   * Send notifications based on alert level
   */
  sendNotifications(alert) {
    // In production, this would send emails, SMS, Slack messages, etc.
    // For now, we'll create notification files
    
    if (alert.level === AlertLevel.EMERGENCY) {
      // Create emergency notification file
      const emergencyFile = path.join(__dirname, 'EMERGENCY_ALERT.txt');
      const content = `
EMERGENCY ALERT - IMMEDIATE ACTION REQUIRED
========================================
Time: ${alert.timestamp}
Metric: ${alert.metric}
Value: ${alert.value}
Threshold: ${alert.threshold}
Message: ${alert.message}

Action Required: Check system immediately!
========================================
`;
      fs.writeFileSync(emergencyFile, content);
    }
  }
}

class MetricsMonitor {
  constructor(alertManager) {
    this.alertManager = alertManager;
    this.metrics = {
      errorCount: 0,
      requestCount: 0,
      responseTimeSum: 0
    };
  }

  /**
   * Check memory usage
   */
  checkMemory() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsagePercent = (usedMem / totalMem) * 100;
    
    if (memoryUsagePercent >= THRESHOLDS.memory.emergency) {
      this.alertManager.triggerAlert('Memory Usage', `${memoryUsagePercent.toFixed(1)}%`, 
        AlertLevel.EMERGENCY, `${THRESHOLDS.memory.emergency}%`);
    } else if (memoryUsagePercent >= THRESHOLDS.memory.critical) {
      this.alertManager.triggerAlert('Memory Usage', `${memoryUsagePercent.toFixed(1)}%`, 
        AlertLevel.CRITICAL, `${THRESHOLDS.memory.critical}%`);
    } else if (memoryUsagePercent >= THRESHOLDS.memory.warning) {
      this.alertManager.triggerAlert('Memory Usage', `${memoryUsagePercent.toFixed(1)}%`, 
        AlertLevel.WARNING, `${THRESHOLDS.memory.warning}%`);
    }
    
    return memoryUsagePercent;
  }

  /**
   * Check CPU usage
   */
  checkCPU() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const cpuUsagePercent = 100 - ~~(100 * idle / total);
    
    if (cpuUsagePercent >= THRESHOLDS.cpu.emergency) {
      this.alertManager.triggerAlert('CPU Usage', `${cpuUsagePercent}%`, 
        AlertLevel.EMERGENCY, `${THRESHOLDS.cpu.emergency}%`);
    } else if (cpuUsagePercent >= THRESHOLDS.cpu.critical) {
      this.alertManager.triggerAlert('CPU Usage', `${cpuUsagePercent}%`, 
        AlertLevel.CRITICAL, `${THRESHOLDS.cpu.critical}%`);
    } else if (cpuUsagePercent >= THRESHOLDS.cpu.warning) {
      this.alertManager.triggerAlert('CPU Usage', `${cpuUsagePercent}%`, 
        AlertLevel.WARNING, `${THRESHOLDS.cpu.warning}%`);
    }
    
    return cpuUsagePercent;
  }

  /**
   * Check backend response time
   */
  async checkResponseTime() {
    const startTime = Date.now();
    
    try {
      await axios.get('http://localhost:5000/health', { timeout: 10000 });
      const responseTime = Date.now() - startTime;
      
      this.metrics.responseTimeSum += responseTime;
      this.metrics.requestCount++;
      
      if (responseTime >= THRESHOLDS.responseTime.emergency) {
        this.alertManager.triggerAlert('Response Time', `${responseTime}ms`, 
          AlertLevel.EMERGENCY, `${THRESHOLDS.responseTime.emergency}ms`);
      } else if (responseTime >= THRESHOLDS.responseTime.critical) {
        this.alertManager.triggerAlert('Response Time', `${responseTime}ms`, 
          AlertLevel.CRITICAL, `${THRESHOLDS.responseTime.critical}ms`);
      } else if (responseTime >= THRESHOLDS.responseTime.warning) {
        this.alertManager.triggerAlert('Response Time', `${responseTime}ms`, 
          AlertLevel.WARNING, `${THRESHOLDS.responseTime.warning}ms`);
      }
      
      return responseTime;
    } catch (error) {
      this.metrics.errorCount++;
      this.alertManager.triggerAlert('Backend Health', 'OFFLINE', 
        AlertLevel.EMERGENCY, 'Backend not responding');
      return -1;
    }
  }

  /**
   * Check error rate
   */
  checkErrorRate() {
    if (this.metrics.requestCount === 0) return 0;
    
    const errorRate = (this.metrics.errorCount / this.metrics.requestCount) * 100;
    
    if (errorRate >= THRESHOLDS.errorRate.emergency) {
      this.alertManager.triggerAlert('Error Rate', `${errorRate.toFixed(1)}%`, 
        AlertLevel.EMERGENCY, `${THRESHOLDS.errorRate.emergency}%`);
    } else if (errorRate >= THRESHOLDS.errorRate.critical) {
      this.alertManager.triggerAlert('Error Rate', `${errorRate.toFixed(1)}%`, 
        AlertLevel.CRITICAL, `${THRESHOLDS.errorRate.critical}%`);
    } else if (errorRate >= THRESHOLDS.errorRate.warning) {
      this.alertManager.triggerAlert('Error Rate', `${errorRate.toFixed(1)}%`, 
        AlertLevel.WARNING, `${THRESHOLDS.errorRate.warning}%`);
    }
    
    return errorRate;
  }

  /**
   * Reset metrics periodically
   */
  resetMetrics() {
    // Reset error tracking every hour
    setInterval(() => {
      this.metrics.errorCount = 0;
      this.metrics.requestCount = 0;
      this.metrics.responseTimeSum = 0;
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Run all checks
   */
  async runChecks() {
    console.log('\n📊 Running threshold checks...');
    
    const memory = this.checkMemory();
    const cpu = this.checkCPU();
    const responseTime = await this.checkResponseTime();
    const errorRate = this.checkErrorRate();
    
    // Log current metrics
    console.log(`📈 Current Metrics:`);
    console.log(`  Memory: ${memory.toFixed(1)}%`);
    console.log(`  CPU: ${cpu}%`);
    console.log(`  Response Time: ${responseTime}ms`);
    console.log(`  Error Rate: ${errorRate.toFixed(1)}%`);
    
    return {
      memory,
      cpu,
      responseTime,
      errorRate
    };
  }
}

// Main monitoring loop
async function startMonitoring() {
  const alertManager = new AlertManager();
  const monitor = new MetricsMonitor(alertManager);
  
  console.log('🚨 Alert Threshold Monitoring Started');
  console.log('📝 Logs: alerts.log, critical-alerts.log');
  console.log('⏱️  Check interval: 30 seconds\n');
  
  // Display threshold configuration
  console.log('📊 Configured Thresholds:');
  console.log(JSON.stringify(THRESHOLDS, null, 2));
  console.log('\n');
  
  // Reset metrics periodically
  monitor.resetMetrics();
  
  // Run initial check
  await monitor.runChecks();
  
  // Run checks every 30 seconds
  setInterval(async () => {
    await monitor.runChecks();
  }, 30000);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Alert monitoring stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Alert monitoring stopped');
  process.exit(0);
});

// Start monitoring
startMonitoring().catch(error => {
  console.error('❌ Failed to start monitoring:', error);
  process.exit(1);
});