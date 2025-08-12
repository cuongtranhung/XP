import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

console.time('⚡ Total startup time');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Basic middleware - these are fast
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware for authenticated routes (loaded lazily)
let sessionMiddlewareLoaded = false;
app.use(async (req, res, next) => {
  // Only load session middleware for authenticated routes
  if ((req.path.startsWith('/api/') && !req.path.includes('/auth/login') && !req.path.includes('/auth/register')) && !sessionMiddlewareLoaded) {
    try {
      const { trackSession, synchronizeSession, handleSessionCleanup, sessionCache } = await import('./middleware/sessionMiddleware');
      
      // Apply session middleware to authenticated requests
      if (req.headers.authorization || req.headers['x-session-id']) {
        await trackSession()(req, res, () => {});
        await synchronizeSession()(req, res, () => {});
        await handleSessionCleanup()(req, res, () => {});
        await sessionCache()(req, res, () => {});
      }
      
      sessionMiddlewareLoaded = true;
    } catch (error) {
      console.log('   ⚠️ Session middleware load failed:', (error as Error).message);
    }
  }
  next();
});

// Health check endpoint - always available
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mode: 'optimized-lazy-loading'
  });
});

// Performance metrics endpoint
app.get('/api/metrics', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    modulesLoaded,
    cacheEnabled: process.env.REDIS_ENABLED === 'true'
  });
});

// Module loading state
let modulesLoaded = false;
let loadingInProgress = false;
let loadingPromise: Promise<void> | null = null;

// Lazy load heavy modules
async function loadModules() {
  if (modulesLoaded) return;
  if (loadingInProgress) {
    return loadingPromise;
  }
  
  loadingInProgress = true;
  console.log('📦 Starting lazy module loading...');
  const startTime = Date.now();
  
  loadingPromise = (async () => {
    try {
      // Step 1: Load database (with timeout)
      console.log('   Loading database...');
      try {
        const dbModule = await import('./config/database');
        if (dbModule.pool) {
          // Quick connection test with timeout
          await Promise.race([
            dbModule.pool.query('SELECT 1'),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('DB timeout')), 2000)
            )
          ]);
          console.log('   ✅ Database connected');
        }
      } catch (dbError) {
        console.log('   ⚠️ Database unavailable, continuing without DB');
      }
      
      // Step 2: Load authentication routes
      console.log('   Loading auth routes...');
      const authRoutes = (await import('./routes/authRoutes')).default;
      app.use('/api/auth', authRoutes);
      
      // Step 3: Load user routes
      console.log('   Loading user routes...');
      const userRoutes = (await import('./routes/userRoutes')).default;
      app.use('/api/users', userRoutes);
      
      // Step 4: Load form builder routes (commented out - missing file)
      // console.log('   Loading form builder...');
      // const dynamicFormRoutes = (await import('./routes/formBuilder/dynamicFormRoutes')).default;
      // app.use('/api/formbuilder', dynamicFormRoutes);
      
      // Step 5: Load admin routes
      console.log('   Loading admin routes...');
      const adminRoutes = (await import('./routes/adminRoutes')).default;
      app.use('/api/admin', adminRoutes);
      
      // Step 6: Load cache routes
      console.log('   Loading cache routes...');
      const cacheRoutes = (await import('./routes/cacheRoutes')).default;
      app.use('/api/cache', cacheRoutes);
      
      // Step 6.1: Load geospatial routes
      console.log('   Loading geospatial routes...');
      const geospatialRoutes = (await import('./routes/geospatialRoutes')).default;
      app.use('/api/geo', geospatialRoutes);
      
      // Step 6.2: Load real-time cache routes
      console.log('   Loading real-time cache routes...');
      const realTimeCacheRoutes = (await import('./routes/realTimeCacheRoutes')).default;
      app.use('/api/realtime-cache', realTimeCacheRoutes);
      
      // Step 6.3: Load multi-user session routes
      console.log('   Loading multi-user session routes...');
      const multiUserSessionRoutes = (await import('./routes/multiUserSessionRoutes')).default;
      app.use('/api/multi-session', multiUserSessionRoutes);
      
      // Step 7: Load optional services (non-blocking)
      Promise.all([
        // Cache service
        import('./services/cacheService')
          .then(() => console.log('   ✅ Cache service loaded'))
          .catch(err => console.log('   ⚠️ Cache service failed:', err.message)),
        
        // Location cache service
        import('./services/locationCacheService')
          .then(() => console.log('   ✅ Location cache service loaded'))
          .catch(err => console.log('   ⚠️ Location cache service failed:', err.message)),
        
        // Real-time cache service
        import('./services/realTimeCacheService')
          .then(() => console.log('   ✅ Real-time cache service loaded'))
          .catch(err => console.log('   ⚠️ Real-time cache service failed:', err.message)),
        
        // Multi-user session service
        import('./services/multiUserSessionService')
          .then(() => console.log('   ✅ Multi-user session service loaded'))
          .catch(err => console.log('   ⚠️ Multi-user session service failed:', err.message)),
        
        // WebSocket service (initialize after server start)
        Promise.resolve().then(() => console.log('   ⏳ WebSocket service will initialize after server start')),
        
        // Email service (skip in dev to save time)
        process.env.NODE_ENV === 'production' 
          ? import('./services/emailService')
              .then(() => console.log('   ✅ Email service loaded'))
              .catch(err => console.log('   ⚠️ Email service failed:', err.message))
          : Promise.resolve(console.log('   ⏭️ Email service skipped (dev mode)'))
      ]);
      
      modulesLoaded = true;
      const loadTime = Date.now() - startTime;
      console.log(`✅ All modules loaded in ${loadTime}ms`);
      
    } catch (error) {
      console.error('❌ Critical error loading modules:', error);
      // Even on error, mark as loaded to prevent retry loops
      modulesLoaded = true;
    } finally {
      loadingInProgress = false;
    }
  })();
  
  return loadingPromise;
}

// Middleware to trigger lazy loading on first real request
app.use(async (req, res, next) => {
  // Skip loading for health and metrics endpoints
  if (req.path === '/health' || req.path === '/api/metrics') {
    return next();
  }
  
  // Load modules if not loaded
  if (!modulesLoaded) {
    await loadModules();
  }
  
  next();
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server immediately
server.listen(PORT as number, HOST, async () => {
  console.timeEnd('⚡ Total startup time');
  
  // Initialize WebSocket service after server is ready
  try {
    const { webSocketService } = await import('./services/webSocketService');
    webSocketService.initialize(server);
    console.log('   ✅ WebSocket service initialized');
  } catch (error) {
    console.log('   ⚠️ WebSocket service failed:', (error as Error).message);
  }
  
  console.log(`
🚀 Optimized Backend Server Started
   URL: http://${HOST}:${PORT}
   Health: http://${HOST}:${PORT}/health
   Metrics: http://${HOST}:${PORT}/api/metrics
   Mode: Lazy Loading Enabled
   
   Note: First API request will load modules (~3-5 seconds)
         Subsequent requests will be fast (<100ms)
  `);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Shutting down server gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after 10 seconds');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;