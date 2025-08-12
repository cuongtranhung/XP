/**
 * Load Testing Routes
 * API endpoints for comprehensive load testing and performance analysis
 */

import { Router, Request, Response } from 'express';
import { loadTestingService, LoadTestConfig } from '../services/loadTestingService';
import auth from '../middleware/auth';
// Async handler for route error handling
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get available test configurations
 * GET /api/load-test/configurations
 */
router.get('/configurations', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can access load testing
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required for load testing'
    });
  }

  const configurations = loadTestingService.getAvailableTests();

  res.json({
    success: true,
    data: {
      configurations: configurations.map(({ name, config }) => ({
        name,
        testName: config.testName,
        duration: config.duration,
        concurrentUsers: config.concurrentUsers,
        requestsPerSecond: config.requestsPerSecond,
        operationMix: config.operationMix,
        cacheTypes: config.cacheTypes
      })),
      count: configurations.length
    }
  });
}));

/**
 * Start load test
 * POST /api/load-test/start
 */
router.post('/start', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can start load tests
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required for load testing'
    });
  }

  const { configName, customConfig } = req.body;

  if (!configName && !customConfig) {
    return res.status(400).json({
      success: false,
      error: 'Either configName or customConfig must be provided'
    });
  }

  let testId: string;
  
  try {
    if (customConfig) {
      // Validate custom configuration
      const requiredFields = ['testName', 'duration', 'concurrentUsers', 'requestsPerSecond', 'operationMix', 'cacheTypes'];
      for (const field of requiredFields) {
        if (!customConfig[field]) {
          return res.status(400).json({
            success: false,
            error: `Missing required field: ${field}`
          });
        }
      }
      
      testId = await loadTestingService.startLoadTest(customConfig as LoadTestConfig);
    } else {
      testId = await loadTestingService.startLoadTest(configName);
    }

    logger.info('Load test started via API', {
      testId,
      configName: configName || 'custom',
      startedBy: requestingUser.userId
    });

    res.status(201).json({
      success: true,
      data: {
        testId,
        message: 'Load test started successfully',
        startedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Failed to start load test via API', {
      error: error instanceof Error ? error.message : 'Unknown error',
      configName,
      requestedBy: requestingUser.userId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to start load test: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}));

/**
 * Get test status
 * GET /api/load-test/status/:testId
 */
router.get('/status/:testId', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can view test status
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const { testId } = req.params;
  const status = loadTestingService.getTestStatus(testId);

  res.json({
    success: true,
    data: {
      testId,
      ...status,
      timestamp: new Date()
    }
  });
}));

/**
 * Stop active test
 * POST /api/load-test/stop/:testId
 */
router.post('/stop/:testId', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can stop tests
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const { testId } = req.params;
  const stopped = await loadTestingService.stopLoadTest(testId);

  if (!stopped) {
    return res.status(404).json({
      success: false,
      error: 'Test not found or already completed'
    });
  }

  logger.info('Load test stopped via API', {
    testId,
    stoppedBy: requestingUser.userId
  });

  res.json({
    success: true,
    data: {
      testId,
      message: 'Test stopped successfully',
      stoppedAt: new Date()
    }
  });
}));

/**
 * Get test results
 * GET /api/load-test/results/:testId?
 */
router.get('/results/:testId?', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can view results
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const { testId } = req.params;
  const { limit = 10, offset = 0 } = req.query;

  try {
    const results = loadTestingService.getTestResults(testId);
    
    if (testId) {
      // Single test result
      res.json({
        success: true,
        data: {
          result: results,
          retrievedAt: new Date()
        }
      });
    } else {
      // Multiple test results with pagination
      const resultArray = results as any[];
      const paginatedResults = resultArray.slice(Number(offset), Number(offset) + Number(limit));
      
      res.json({
        success: true,
        data: {
          results: paginatedResults,
          pagination: {
            total: resultArray.length,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + Number(limit) < resultArray.length
          },
          retrievedAt: new Date()
        }
      });
    }

  } catch (error) {
    res.status(404).json({
      success: false,
      error: error instanceof Error ? error.message : 'Results not found'
    });
  }
}));

/**
 * Run test suite
 * POST /api/load-test/suite
 */
router.post('/suite', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can run test suites
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const { suiteType = 'basic' } = req.body;

  if (!['basic', 'comprehensive', 'stress'].includes(suiteType)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid suite type. Must be: basic, comprehensive, or stress'
    });
  }

  logger.info('Load test suite started via API', {
    suiteType,
    startedBy: requestingUser.userId
  });

  // Run test suite asynchronously and return immediately
  loadTestingService.runTestSuite(suiteType).then(results => {
    logger.info('Load test suite completed', {
      suiteType,
      testCount: results.length,
      startedBy: requestingUser.userId
    });
  }).catch(error => {
    logger.error('Load test suite failed', {
      suiteType,
      error: error instanceof Error ? error.message : 'Unknown error',
      startedBy: requestingUser.userId
    });
  });

  res.status(202).json({
    success: true,
    data: {
      message: `${suiteType} test suite started`,
      suiteType,
      startedAt: new Date(),
      note: 'Suite is running asynchronously. Check results endpoint for completion.'
    }
  });
}));

/**
 * Set performance baseline
 * POST /api/load-test/baseline
 */
router.post('/baseline', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can set baselines
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const { testName, testId } = req.body;

  if (!testName || !testId) {
    return res.status(400).json({
      success: false,
      error: 'Both testName and testId are required'
    });
  }

  try {
    const testResults = loadTestingService.getTestResults(testId);
    if (Array.isArray(testResults)) {
      return res.status(400).json({
        success: false,
        error: 'Specific testId required for baseline setting'
      });
    }

    loadTestingService.setPerformanceBaseline(testName, testResults);

    logger.info('Performance baseline set via API', {
      testName,
      testId,
      setBy: requestingUser.userId
    });

    res.json({
      success: true,
      data: {
        testName,
        testId,
        message: 'Performance baseline set successfully',
        baselineMetrics: {
          averageResponseTime: testResults.averageResponseTime,
          successRate: (testResults.successfulRequests / testResults.totalRequests * 100).toFixed(2) + '%',
          throughput: testResults.requestsPerSecond
        }
      }
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set baseline'
    });
  }
}));

/**
 * Compare with baseline
 * POST /api/load-test/compare
 */
router.post('/compare', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can compare with baseline
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const { testName, testId } = req.body;

  if (!testName || !testId) {
    return res.status(400).json({
      success: false,
      error: 'Both testName and testId are required'
    });
  }

  try {
    const testResults = loadTestingService.getTestResults(testId);
    if (Array.isArray(testResults)) {
      return res.status(400).json({
        success: false,
        error: 'Specific testId required for comparison'
      });
    }

    const comparison = loadTestingService.compareWithBaseline(testName, testResults);

    res.json({
      success: true,
      data: {
        testName,
        testId,
        comparison: {
          ...comparison,
          responseTimeChange: ((comparison.responseTimeRatio - 1) * 100).toFixed(2) + '%',
          throughputChange: ((comparison.throughputRatio - 1) * 100).toFixed(2) + '%'
        },
        timestamp: new Date()
      }
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compare with baseline'
    });
  }
}));

/**
 * Generate performance report
 * GET /api/load-test/report
 */
router.get('/report', auth, asyncHandler(async (req: Request, res: Response) => {
  const requestingUser = req.user as any;

  // Only admin users can generate reports
  if (requestingUser.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Admin access required'
    });
  }

  const report = loadTestingService.generatePerformanceReport();

  res.json({
    success: true,
    data: {
      report,
      generatedAt: new Date(),
      generatedBy: requestingUser.userId
    }
  });
}));

/**
 * Health check for load testing service
 * GET /api/load-test/health
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  // Get active tests count
  const configurations = loadTestingService.getAvailableTests();
  
  const healthStatus = {
    status: 'healthy',
    service: 'load-testing',
    availableConfigurations: configurations.length,
    systemResources: {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage()
    },
    timestamp: new Date()
  };

  res.json({
    success: true,
    data: healthStatus
  });
}));

export default router;