import { createServer } from 'http';
import app from './app-simple';
import { logger } from './utils/logger';
import { testConnection } from './utils/database';

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const server = createServer(app);

server.listen(PORT, HOST, async () => {
  logger.info('Simplified server started successfully', {
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV ?? 'development'
  });
  
  try {
    await testConnection();
    logger.info('Database connection verified');
  } catch (error) {
    logger.warn('Database connection failed', { error });
  }
});

export default server;