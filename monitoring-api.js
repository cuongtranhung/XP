#!/usr/bin/env node

/**
 * Monitoring Dashboard API Server
 * Provides REST API endpoints for system monitoring and control
 */

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const http = require('http');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve dashboard HTML

// System metrics storage
let systemMetrics = {
    memory: { usage: 0, total: 0, free: 0 },
    cpu: { usage: 0, cores: os.cpus().length },
    disk: { usage: 0, total: 0, free: 0 },
    network: { responseTime: 0, errorRate: 0, requestRate: 0 },
    services: {
        backend: 'unknown',
        frontend: 'unknown',
        database: 'unknown',
        monitoring: 'unknown'
    },
    alerts: [],
    logs: []
};

// Helper function to execute shell commands
function executeShellCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                reject({ error: error.message, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

// Check if process is running
async function isProcessRunning(pidFile) {
    try {
        const pid = await fs.readFile(pidFile, 'utf8');
        const result = await executeShellCommand(`ps -p ${pid.trim()} > /dev/null 2>&1 && echo "running" || echo "stopped"`);
        return result.stdout.trim() === 'running';
    } catch {
        return false;
    }
}

// Update system metrics
async function updateSystemMetrics() {
    // Memory metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    systemMetrics.memory = {
        usage: Math.round((usedMem / totalMem) * 100),
        total: Math.round(totalMem / (1024 * 1024 * 1024)), // GB
        free: Math.round(freeMem / (1024 * 1024 * 1024)) // GB
    };

    // CPU metrics (simplified)
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
    systemMetrics.cpu.usage = Math.round(100 - ~~(100 * idle / total));

    // Check service status
    systemMetrics.services.backend = await isProcessRunning('backend.pid') ? 'online' : 'offline';
    systemMetrics.services.frontend = await isProcessRunning('frontend.pid') ? 'online' : 'offline';
    systemMetrics.services.monitoring = await isProcessRunning('monitor.pid') ? 'online' : 'offline';

    // Check backend health
    try {
        const startTime = Date.now();
        const healthCheck = await new Promise((resolve, reject) => {
            const req = http.get('http://localhost:5000/health', { timeout: 5000 }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, data }));
            });
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout'));
            });
        });
        
        systemMetrics.network.responseTime = Date.now() - startTime;
        if (healthCheck.status === 200) {
            systemMetrics.services.backend = 'online';
        } else {
            systemMetrics.services.backend = 'offline';
        }
    } catch (error) {
        systemMetrics.services.backend = 'offline';
        systemMetrics.network.responseTime = -1;
    }

    // Check database
    try {
        const result = await executeShellCommand(
            'PGPASSWORD="@abcd1234" psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "SELECT 1;" 2>&1'
        );
        systemMetrics.services.database = result.stdout.includes('1') ? 'online' : 'offline';
    } catch {
        systemMetrics.services.database = 'offline';
    }
}

// API Routes

// Get system metrics
app.get('/api/metrics', async (req, res) => {
    await updateSystemMetrics();
    res.json(systemMetrics);
});

// Get service status
app.get('/api/services', async (req, res) => {
    await updateSystemMetrics();
    res.json(systemMetrics.services);
});

// Execute command
app.post('/api/execute', async (req, res) => {
    const { command } = req.body;
    
    // Command whitelist for security
    const allowedCommands = {
        'start-all': './start-with-memory-limits.sh',
        'stop-all': './stop-all-services.sh',
        'restart-backend': 'kill $(cat backend.pid 2>/dev/null) ; cd backend && npm run dev > ../backend.log 2>&1 & echo $! > ../backend.pid',
        'restart-frontend': 'kill $(cat frontend.pid 2>/dev/null) ; cd frontend && npm run dev > ../frontend.log 2>&1 & echo $! > ../frontend.pid',
        'check-health': 'curl -s http://localhost:5000/health',
        'view-processes': 'ps aux | grep node | head -20',
        'start-monitoring': 'node stability-monitoring.js > monitoring.log 2>&1 & echo $! > monitor.pid',
        'start-alerts': './start-alert-monitoring.sh',
        'emergency-restart': './emergency-restart.sh',
        'clear-cache': 'rm -rf /tmp/cache/* && rm -rf frontend/node_modules/.vite',
        'safe-mode': 'NODE_ENV=production NODE_OPTIONS="--max-old-space-size=1024" ./start-with-memory-limits.sh'
    };

    const shellCommand = allowedCommands[command];
    if (!shellCommand) {
        return res.status(400).json({ error: 'Invalid command' });
    }

    try {
        const result = await executeShellCommand(shellCommand);
        res.json({ 
            success: true, 
            command,
            output: result.stdout.substring(0, 1000), // Limit output size
            error: result.stderr 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            command,
            error: error.error,
            details: error.stderr 
        });
    }
});

// Get logs
app.get('/api/logs/:type', async (req, res) => {
    const { type } = req.params;
    const { lines = 50 } = req.query;
    
    const logFiles = {
        'stability': 'stability-monitor.log',
        'alerts': 'alerts.log',
        'critical': 'critical-alerts.log',
        'backend': 'backend.log',
        'frontend': 'frontend.log',
        'monitoring': 'monitoring.log'
    };

    const logFile = logFiles[type];
    if (!logFile) {
        return res.status(400).json({ error: 'Invalid log type' });
    }

    try {
        const result = await executeShellCommand(`tail -n ${lines} ${logFile} 2>/dev/null || echo "Log file not found"`);
        res.json({ 
            type,
            file: logFile,
            content: result.stdout,
            lines: result.stdout.split('\n').length
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read log file' });
    }
});

// Get alerts
app.get('/api/alerts', async (req, res) => {
    try {
        const alertsContent = await fs.readFile('alerts.log', 'utf8').catch(() => '');
        const alerts = alertsContent
            .split('\n')
            .filter(line => line.trim())
            .slice(-20) // Last 20 alerts
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return { message: line };
                }
            });
        
        res.json(alerts);
    } catch (error) {
        res.json([]);
    }
});

// Clear logs
app.post('/api/logs/clear', async (req, res) => {
    const { type } = req.body;
    
    const logFiles = {
        'all': ['*.log'],
        'stability': ['stability-monitor.log'],
        'alerts': ['alerts.log', 'critical-alerts.log']
    };

    const files = logFiles[type] || logFiles['all'];
    
    try {
        for (const file of files) {
            await executeShellCommand(`echo "Log cleared at $(date)" > ${file}`);
        }
        res.json({ success: true, message: 'Logs cleared' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear logs' });
    }
});

// Database operations
app.post('/api/database/reset-connections', async (req, res) => {
    try {
        const result = await executeShellCommand(
            `PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < current_timestamp - INTERVAL '5 minutes';" 2>&1`
        );
        res.json({ success: true, output: result.stdout });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset database connections' });
    }
});

// Get database stats
app.get('/api/database/stats', async (req, res) => {
    try {
        const result = await executeShellCommand(
            `PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -t -c "SELECT count(*) as connections FROM pg_stat_activity;" 2>&1`
        );
        const connections = parseInt(result.stdout.trim()) || 0;
        res.json({ 
            connections,
            maxConnections: 50,
            usage: Math.round((connections / 50) * 100)
        });
    } catch (error) {
        res.json({ connections: 0, maxConnections: 50, usage: 0 });
    }
});

// Backup system
app.post('/api/backup', async (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}.tar.gz`;
    
    try {
        await executeShellCommand(
            `tar -czf backups/${backupName} --exclude=node_modules --exclude=.git --exclude=backups .`
        );
        res.json({ 
            success: true, 
            backupName,
            message: `Backup created: ${backupName}`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Serve dashboard at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'monitoring-dashboard.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server - bind to all interfaces
app.listen(PORT, '0.0.0.0', () => {
    console.log(`📊 Monitoring API Server running on:`);
    console.log(`   - http://localhost:${PORT}`);
    console.log(`   - http://172.26.249.148:${PORT}`);
    console.log(`   - http://0.0.0.0:${PORT}`);
    console.log(`🖥️  Dashboard available at all addresses above`);
    console.log(`📡 API endpoints available at http://<address>:${PORT}/api/*`);
    
    // Initial metrics update
    updateSystemMetrics();
    
    // Update metrics every 30 seconds
    setInterval(updateSystemMetrics, 30000);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Monitoring API Server shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Monitoring API Server shutting down...');
    process.exit(0);
});