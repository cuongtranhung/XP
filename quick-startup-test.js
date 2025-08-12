#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');

console.log('🚀 Quick Startup Test');
console.log('====================');

// Test backend with tsx
console.log('\n📊 Testing Backend with tsx...');
const backendStart = Date.now();

const backend = spawn('npm', ['run', 'dev'], {
  cwd: './backend',
  env: { ...process.env, NODE_ENV: 'development', PORT: '5000' },
  shell: true
});

backend.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[Backend] ${output.trim()}`);
  
  if (output.includes('Server started successfully')) {
    const time = Date.now() - backendStart;
    console.log(`\n✅ Backend ready in: ${time}ms (${(time/1000).toFixed(2)}s)`);
    
    // Test a quick API call
    setTimeout(() => {
      const req = http.get('http://localhost:5000/api/health', (res) => {
        console.log(`✅ Health check passed: ${res.statusCode}`);
        backend.kill();
        
        // Test frontend
        setTimeout(() => testFrontend(), 2000);
      });
      
      req.on('error', (err) => {
        console.log(`❌ Health check failed: ${err.message}`);
        backend.kill();
        testFrontend();
      });
    }, 1000);
  }
});

function testFrontend() {
  console.log('\n📊 Testing Frontend with Vite cache...');
  const frontendStart = Date.now();
  
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: './frontend',
    env: { ...process.env, PORT: '3000' },
    shell: true
  });
  
  frontend.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[Frontend] ${output.trim()}`);
    
    if (output.includes('ready in') || output.includes('Local:')) {
      const time = Date.now() - frontendStart;
      console.log(`\n✅ Frontend ready in: ${time}ms (${(time/1000).toFixed(2)}s)`);
      
      // Test a quick request
      setTimeout(() => {
        const req = http.get('http://localhost:3000', (res) => {
          console.log(`✅ Frontend accessible: ${res.statusCode}`);
          frontend.kill();
          
          console.log('\n🎉 Performance test completed!');
          process.exit(0);
        });
        
        req.on('error', (err) => {
          console.log(`❌ Frontend test failed: ${err.message}`);
          frontend.kill();
          process.exit(1);
        });
      }, 2000);
    }
  });
  
  // Timeout
  setTimeout(() => {
    console.log('❌ Frontend test timeout');
    frontend.kill();
    process.exit(1);
  }, 30000);
}

// Timeout
setTimeout(() => {
  console.log('❌ Backend test timeout');
  backend.kill();
  process.exit(1);
}, 45000);