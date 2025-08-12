#!/usr/bin/env node

/**
 * Simple Monitoring Dashboard Server
 * Lightweight server without external dependencies
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const PORT = 4000;
const HOST = '0.0.0.0';

// Helper to execute shell commands
function executeCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                reject({ error: error.message, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

// Get system metrics
async function getSystemMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = Math.round((usedMem / totalMem) * 100);
    
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach(cpu => {
        for (const type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });
    const cpuUsage = Math.round(100 - ~~(100 * totalIdle / cpus.length / (totalTick / cpus.length)));
    
    // Check services
    const services = {};
    
    // Check backend
    try {
        const backendPid = fs.readFileSync('backend.pid', 'utf8').trim();
        const psResult = await executeCommand(`ps -p ${backendPid} 2>/dev/null | grep -q ${backendPid} && echo "online" || echo "offline"`);
        services.backend = psResult.stdout.trim() === 'online' ? 'online' : 'offline';
    } catch {
        services.backend = 'offline';
    }
    
    // Check frontend
    try {
        const frontendPid = fs.readFileSync('frontend.pid', 'utf8').trim();
        const psResult = await executeCommand(`ps -p ${frontendPid} 2>/dev/null | grep -q ${frontendPid} && echo "online" || echo "offline"`);
        services.frontend = psResult.stdout.trim() === 'online' ? 'online' : 'offline';
    } catch {
        services.frontend = 'offline';
    }
    
    services.database = 'unknown';
    services.monitoring = 'online'; // We are running
    
    return {
        memory: { usage: memoryUsage, total: Math.round(totalMem / (1024*1024*1024)), free: Math.round(freeMem / (1024*1024*1024)) },
        cpu: { usage: cpuUsage, cores: cpus.length },
        disk: { usage: 0, total: 0, free: 0 },
        network: { responseTime: 0, errorRate: 0, requestRate: 0 },
        services,
        alerts: []
    };
}

// Allowed commands for security
const ALLOWED_COMMANDS = {
    'start-all': './start-with-memory-limits.sh',
    'stop-all': './stop-all-services.sh',
    'check-health': 'curl -s http://localhost:5000/health || echo "Backend offline"',
    'view-processes': 'ps aux | grep node | head -10',
    'emergency-restart': './emergency-restart.sh',
    'safe-mode': 'NODE_ENV=production ./start-with-memory-limits.sh'
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Parse URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // Routes
    if (url.pathname === '/' || url.pathname === '/index.html') {
        // Serve dashboard HTML
        try {
            const html = fs.readFileSync(path.join(__dirname, 'monitoring-dashboard.html'), 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        } catch (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Dashboard not found');
        }
    }
    else if (url.pathname === '/api/health') {
        // Health check
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'online',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        }));
    }
    else if (url.pathname === '/api/metrics') {
        // Get system metrics
        try {
            const metrics = await getSystemMetrics();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(metrics));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to get metrics' }));
        }
    }
    else if (url.pathname === '/api/services') {
        // Get service status
        try {
            const metrics = await getSystemMetrics();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(metrics.services));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to get services' }));
        }
    }
    else if (url.pathname === '/api/execute' && req.method === 'POST') {
        // Execute command
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { command } = JSON.parse(body);
                const shellCommand = ALLOWED_COMMANDS[command];
                
                if (!shellCommand) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid command' }));
                    return;
                }
                
                const result = await executeCommand(shellCommand);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true,
                    command,
                    output: result.stdout.substring(0, 1000)
                }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false,
                    error: error.error || error.message
                }));
            }
        });
    }
    else if (url.pathname.startsWith('/api/logs/')) {
        // Get logs
        const logType = url.pathname.split('/')[3];
        const lines = url.searchParams.get('lines') || '50';
        
        const logFiles = {
            'stability': 'stability-monitor.log',
            'alerts': 'alerts.log',
            'critical': 'critical-alerts.log',
            'backend': 'backend.log',
            'frontend': 'frontend.log'
        };
        
        const logFile = logFiles[logType];
        if (!logFile) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid log type' }));
            return;
        }
        
        try {
            const result = await executeCommand(`tail -n ${lines} ${logFile} 2>/dev/null || echo "Log file not found"`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                type: logType,
                file: logFile,
                content: result.stdout
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read log' }));
        }
    }
    else if (url.pathname === '/api/alerts') {
        // Get alerts
        try {
            const alertsContent = fs.readFileSync('alerts.log', 'utf8');
            const alerts = alertsContent
                .split('\n')
                .filter(line => line.trim())
                .slice(-20)
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return { message: line };
                    }
                });
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(alerts));
        } catch {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([]));
        }
    }
    else if (url.pathname === '/api/database/stats') {
        // Database stats
        try {
            const result = await executeCommand(
                `PGPASSWORD='@abcd1234' psql -h 172.26.240.1 -p 5432 -U postgres -d postgres -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null || echo "0"`
            );
            const connections = parseInt(result.stdout.trim()) || 0;
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                connections,
                maxConnections: 50,
                usage: Math.round((connections / 50) * 100)
            }));
        } catch {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ connections: 0, maxConnections: 50, usage: 0 }));
        }
    }
    else {
        // 404 for unknown routes
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }
});

// Start server
server.listen(PORT, HOST, () => {
    console.log('');
    console.log('📊 Simple Monitoring Dashboard Server');
    console.log('=====================================');
    console.log(`✅ Server running on:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   http://172.26.249.148:${PORT}`);
    console.log(`   http://0.0.0.0:${PORT}`);
    console.log('');
    console.log('📡 API endpoints:');
    console.log(`   GET  /api/health   - Health check`);
    console.log(`   GET  /api/metrics  - System metrics`);
    console.log(`   GET  /api/services - Service status`);
    console.log(`   POST /api/execute  - Execute commands`);
    console.log(`   GET  /api/logs/:type - View logs`);
    console.log(`   GET  /api/alerts   - Get alerts`);
    console.log('');
    console.log('🖥️  Open dashboard in browser:');
    console.log(`   http://172.26.249.148:${PORT}`);
    console.log('=====================================');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Server shutting down...');
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Server shutting down...');
    server.close(() => {
        process.exit(0);
    });
});