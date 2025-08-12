/**
 * Ultra-fast server for testing startup time
 */

import express from 'express';
import cors from 'cors';

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';

console.time('Server startup');

const app = express();

// Basic middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (minimal)
app.post('/api/auth/login', (req, res) => {
  res.json({ success: true, message: 'Fast server - login endpoint' });
});

app.post('/api/auth/register', (req, res) => {
  res.json({ success: true, message: 'Fast server - register endpoint' });
});

// Start server immediately
app.listen(PORT, HOST, () => {
  console.timeEnd('Server startup');
  console.log(`🚀 Fast server running at http://${HOST}:${PORT}`);
  console.log(`   Health check: http://${HOST}:${PORT}/health`);
});