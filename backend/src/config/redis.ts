/**
 * Redis Configuration
 * Mock redis client for development without Redis server
 */

import { logger } from '../utils/logger';

// Mock Redis client for development
const mockRedisClient = {
  get: async (key: string) => {
    logger.debug('Mock Redis GET:', key);
    return null;
  },
  set: async (key: string, value: any, options?: any) => {
    logger.debug('Mock Redis SET:', key, value);
    return 'OK';
  },
  setex: async (key: string, seconds: number, value: any) => {
    logger.debug('Mock Redis SETEX:', key, seconds, value);
    return 'OK';
  },
  del: async (key: string) => {
    logger.debug('Mock Redis DEL:', key);
    return 1;
  },
  exists: async (key: string) => {
    logger.debug('Mock Redis EXISTS:', key);
    return 0;
  },
  expire: async (key: string, seconds: number) => {
    logger.debug('Mock Redis EXPIRE:', key, seconds);
    return 1;
  },
  ttl: async (key: string) => {
    logger.debug('Mock Redis TTL:', key);
    return -1;
  },
  keys: async (pattern: string) => {
    logger.debug('Mock Redis KEYS:', pattern);
    return [];
  },
  flushall: async () => {
    logger.debug('Mock Redis FLUSHALL');
    return 'OK';
  },
  ping: async () => {
    return 'PONG';
  },
  quit: async () => {
    return 'OK';
  }
};

export default mockRedisClient;