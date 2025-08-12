import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

console.time('⚡ Server initialization');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Basic middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Lazy load modules
let modulesLoaded = false;
let dbInitialized = false;

async function loadModules() {
  if (modulesLoaded) return;
  
  console.time('📦 Lazy loading modules');
  
  try {
    // Load database
    const { pool } = await import('./config/database');
    
    // Test database connection with timeout
    const testConnection = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('⚠️ Database connection timeout, continuing without DB');
        resolve(false);
      }, 3000);
      
      pool.query('SELECT 1')
        .then(() => {
          clearTimeout(timeout);
          console.log('✅ Database connected');
          dbInitialized = true;
          resolve(true);
        })
        .catch(err => {
          clearTimeout(timeout);
          console.log('⚠️ Database not available:', err.message);
          resolve(false);
        });
    });
    
    await testConnection;
    
    // Load routes dynamically
    const authRoutes = (await import('./routes/authRoutes')).default;
    const userRoutes = (await import('./routes/userRoutes')).default;
    const dynamicFormRoutes = (await import('./routes/formBuilder/dynamicFormRoutes')).default;
    const adminRoutes = (await import('./routes/adminRoutes')).default;
    
    // Apply routes
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/formbuilder', dynamicFormRoutes);
    app.use('/api/admin', adminRoutes);
    
    // Load cache service (non-blocking)
    import('./services/cacheService').then(module => {
      console.log('📦 Cache service loaded');
    }).catch(err => {
      console.log('⚠️ Cache service not available:', err.message);
    });
    
    // Load email service (non-blocking)
    import('./services/emailService').then(module => {
      console.log('📧 Email service loaded');
    }).catch(err => {
      console.log('⚠️ Email service not available:', err.message);
    });
    
    modulesLoaded = true;
    console.timeEnd('📦 Lazy loading modules');
    
  } catch (error) {
    console.error('❌ Error loading modules:', error);
  }
}

// Middleware to trigger lazy loading
app.use(async (req, res, next) => {
  if (!modulesLoaded && req.path !== '/health') {
    await loadModules();
  }
  next();
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server immediately
server.listen(PORT as number, HOST, () => {
  console.timeEnd('⚡ Server initialization');
  console.log(`🚀 Optimized server running at http://${HOST}:${PORT}`);
  console.log(`   Health check: http://${HOST}:${PORT}/health`);
  console.log('   Modules will load on first request (lazy loading)');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;