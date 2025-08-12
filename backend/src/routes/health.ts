import { Router } from 'express';
import { 
  healthCheck, 
  databaseHealth, 
  gpsPerformanceMetrics, 
  gpsServiceHealth, 
  systemResources, 
  emailServiceHealth, 
  ualHealthCheck,
  observabilityHealthCheck 
} from '../controllers/healthController';

const router = Router();

/**
 * @route   GET /health
 * @desc    General health check including database
 * @access  Public
 */
router.get('/', healthCheck);

/**
 * @route   GET /health/database
 * @desc    Database-specific health check
 * @access  Public
 */
router.get('/database', databaseHealth);

/**
 * @route   GET /health/gps
 * @desc    GPS service health check
 * @access  Public
 */
router.get('/gps', gpsServiceHealth);

/**
 * @route   GET /health/performance
 * @desc    GPS performance metrics
 * @access  Public
 */
router.get('/performance', gpsPerformanceMetrics);

/**
 * @route   GET /health/resources
 * @desc    System resource usage
 * @access  Public
 */
router.get('/resources', systemResources);

/**
 * @route   GET /health/email
 * @desc    Email service health check
 * @access  Public
 */
router.get('/email', emailServiceHealth);

/**
 * @route   GET /health/ual
 * @desc    User Activity Logging health check
 * @access  Public
 */
router.get('/ual', ualHealthCheck);

/**
 * @route   GET /health/observability
 * @desc    Advanced Monitoring & Observability Platform health check
 * @access  Public
 */
router.get('/observability', observabilityHealthCheck);

export default router;