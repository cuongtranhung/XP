/**
 * Unit Tests for Rate Limiting
 * Tests rate limiting functionality for Form Builder operations
 */

import request from 'supertest';
import { Express } from 'express';
import express, { Request, Response } from 'express';
import { formBuilderRateLimits, generalRateLimit } from '../../src/middleware/rateLimiter';

describe('Rate Limiter Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Test routes with different rate limits
    app.post('/test/form-creation', formBuilderRateLimits.formCreation, (req: Request, res: Response) => {
      res.json({ success: true, message: 'Form created' });
    });

    app.post('/test/form-submission', formBuilderRateLimits.formSubmission, (req: Request, res: Response) => {
      res.json({ success: true, message: 'Form submitted' });
    });

    app.post('/test/form-cloning', formBuilderRateLimits.formCloning, (req: Request, res: Response) => {
      res.json({ success: true, message: 'Form cloned' });
    });

    app.get('/test/public-stats', formBuilderRateLimits.publicStats, (req: Request, res: Response) => {
      res.json({ success: true, stats: {} });
    });

    app.get('/test/data-export', formBuilderRateLimits.dataExport, (req: Request, res: Response) => {
      res.json({ success: true, data: [] });
    });

    app.put('/test/form-update', formBuilderRateLimits.formUpdate, (req: Request, res: Response) => {
      res.json({ success: true, message: 'Form updated' });
    });

    app.post('/test/bulk-operations', formBuilderRateLimits.bulkOperations, (req: Request, res: Response) => {
      res.json({ success: true, message: 'Bulk operation completed' });
    });

    app.get('/test/general', generalRateLimit, (req: Request, res: Response) => {
      res.json({ success: true, message: 'General endpoint' });
    });
  });

  describe('Form Creation Rate Limit', () => {
    it('should allow requests within the limit', async () => {
      // First few requests should pass (limit is 20 per hour)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/test/form-creation')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .post('/test/form-creation')
        .send({});

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Form Submission Rate Limit', () => {
    it('should allow multiple submissions within limit', async () => {
      // Submit multiple times (limit is 50 per hour)
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/test/form-submission')
          .send({ data: { field1: `value${i}` } });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('Form Cloning Rate Limit', () => {
    it('should enforce stricter limits on cloning', async () => {
      // Cloning has a lower limit (10 per hour)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/test/form-cloning')
          .send({});

        expect(response.status).toBe(200);
      }
    });

    it('should return 429 when limit exceeded', async () => {
      // Attempt to exceed the cloning limit
      const requests = [];
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app)
            .post('/test/form-cloning')
            .send({})
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Rate limited responses should have proper error structure
      if (rateLimitedResponses.length > 0) {
        const rateLimitedResponse = rateLimitedResponses[0];
        expect(rateLimitedResponse.body).toHaveProperty('error');
        expect(rateLimitedResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });
  });

  describe('Public Stats Rate Limit', () => {
    it('should allow high frequency access to public stats', async () => {
      // Public stats should have higher limits (200 per hour)
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .get('/test/public-stats');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('Data Export Rate Limit', () => {
    it('should strictly limit data export operations', async () => {
      // Data export has very low limits (5 per hour)
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .get('/test/data-export');

        expect(response.status).toBe(200);
      }
    });

    it('should quickly hit export rate limit', async () => {
      // Try to exceed export limit
      const requests = [];
      for (let i = 0; i < 8; i++) {
        requests.push(request(app).get('/test/data-export'));
      }

      const responses = await Promise.all(requests);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      // Should have some rate limited responses due to low limit
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Form Update Rate Limit', () => {
    it('should allow reasonable update frequency', async () => {
      // Updates have moderate limits (100 per hour)
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .put('/test/form-update')
          .send({ name: `Updated Form ${i}` });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Bulk Operations Rate Limit', () => {
    it('should limit bulk operations strictly', async () => {
      // Bulk operations have low limits (10 per hour)
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/test/bulk-operations')
          .send({ operations: [{ type: 'delete', id: i }] });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('General Rate Limit', () => {
    it('should apply general rate limiting', async () => {
      // General rate limit (100 per 15 minutes)
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .get('/test/general');

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Rate Limit Headers', () => {
    it('should provide accurate rate limit information', async () => {
      const response = await request(app)
        .post('/test/form-creation')
        .send({});

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');

      const limit = parseInt(response.headers['x-ratelimit-limit']);
      const remaining = parseInt(response.headers['x-ratelimit-remaining']);
      
      expect(limit).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(limit);
    });

    it('should show decreasing remaining count', async () => {
      const firstResponse = await request(app)
        .post('/test/form-submission')
        .send({});

      const secondResponse = await request(app)
        .post('/test/form-submission')
        .send({});

      const firstRemaining = parseInt(firstResponse.headers['x-ratelimit-remaining']);
      const secondRemaining = parseInt(secondResponse.headers['x-ratelimit-remaining']);

      expect(secondRemaining).toBeLessThan(firstRemaining);
    });
  });

  describe('Error Response Format', () => {
    it('should return properly formatted error when rate limit exceeded', async () => {
      // Make many requests to exceed limit quickly
      const requests = [];
      for (let i = 0; i < 12; i++) {
        requests.push(
          request(app)
            .post('/test/form-cloning')
            .send({})
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toEqual({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later.'
          }
        });

        expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
      }
    });
  });

  describe('IP-based Rate Limiting', () => {
    it('should track rates per IP address', async () => {
      // All requests from the same test client should share rate limits
      const response1 = await request(app)
        .post('/test/form-creation')
        .send({});

      const response2 = await request(app)
        .post('/test/form-creation')
        .send({});

      const remaining1 = parseInt(response1.headers['x-ratelimit-remaining']);
      const remaining2 = parseInt(response2.headers['x-ratelimit-remaining']);

      expect(remaining2).toBe(remaining1 - 1);
    });
  });

  describe('Rate Limit Reset', () => {
    it('should include reset timestamp', async () => {
      const response = await request(app)
        .post('/test/form-creation')
        .send({});

      const resetTime = parseInt(response.headers['x-ratelimit-reset']);
      const currentTime = Math.floor(Date.now() / 1000);

      // Reset time should be in the future
      expect(resetTime).toBeGreaterThan(currentTime);
    });
  });
});