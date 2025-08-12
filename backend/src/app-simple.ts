import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import testAuthRoute from './routes/testAuthRoute';
import permissionRoutes from './routes/permissionRoutes';
import userManagementRoutes from './modules/user-management/routes';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration - Allow all origins in development
const allowedOrigins = [
  process.env.FRONTEND_URL ?? 'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002', 
  'http://localhost:3003',
  'http://172.26.249.148:3000',  // WSL IP
  'http://172.26.249.148:3001',
  'http://10.255.255.254:3000',   // Network IP
  'http://127.0.0.1:3000'         // Loopback
];

// In development, allow all origins for easier testing
const corsOptions = process.env.NODE_ENV === 'development' 
  ? {
      origin: true,  // Allow all origins in development
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  : {
      origin: allowedOrigins,
      credentials: true,
      optionsSuccessStatus: 200,
    };

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, _res, next) => {
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', testAuthRoute);
app.use('/api/permissions', permissionRoutes);
app.use('/api/user-management', userManagementRoutes);

// Health endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({ 
    message: 'Simplified XP Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: `Route ${req.originalUrl} not found` 
  });
});

// Error handler
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Application error', { error: error.message, stack: error.stack });
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

export default app;