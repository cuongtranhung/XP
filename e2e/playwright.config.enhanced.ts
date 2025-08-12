import { defineConfig, devices } from '@playwright/test';

/**
 * Enhanced Playwright Configuration for Login Function Testing
 * Optimized for comprehensive testing with detailed reporting
 */
export default defineConfig({
  // Test directory configuration
  testDir: './tests',
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  
  // Global timeout and retry configuration
  timeout: 60000, // 60 seconds per test
  globalTimeout: 1800000, // 30 minutes total
  expect: {
    timeout: 10000, // 10 seconds for assertions
    toHaveScreenshot: { 
      threshold: 0.2, 
      mode: 'pixel' 
    }
  },
  
  // Retry strategy for flaky tests
  retries: process.env.CI ? 2 : 1,
  
  // Parallel execution configuration
  workers: process.env.CI ? 3 : 6,
  fullyParallel: true,
  
  // Reporter configuration for comprehensive reporting
  reporter: [
    ['html', { 
      outputFolder: 'playwright-report',
      open: 'never'
    }],
    ['json', { 
      outputFile: 'test-results/test-results.json' 
    }],
    ['junit', { 
      outputFile: 'test-results/junit.xml' 
    }],
    ['line']
  ],
  
  // Global test configuration
  use: {
    // Base URL for the application
    baseURL: 'http://localhost:3000',
    
    // Browser configuration
    headless: true,
    viewport: { width: 1280, height: 720 },
    
    // Interaction timeouts
    actionTimeout: 15000,
    navigationTimeout: 30000,
    
    // Test artifacts
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    
    // Context options
    ignoreHTTPSErrors: true,
    permissions: ['notifications'],
    
    // Locale and timezone
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    // Security headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    }
  },

  // Test projects for different browsers and scenarios
  projects: [
    // Desktop browsers
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: ['**/login-comprehensive.spec.ts']
    },
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: ['**/login-comprehensive.spec.ts']
    },
    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: ['**/login-comprehensive.spec.ts']
    },
    
    // Mobile devices
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5']
      },
      testMatch: ['**/login-comprehensive.spec.ts']
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12']
      },
      testMatch: ['**/login-comprehensive.spec.ts']
    },
    
    // Edge cases and security testing
    {
      name: 'security-tests',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
      testMatch: ['**/login-edge-cases.spec.ts']
    },
    
    // Accessibility testing
    {
      name: 'accessibility-tests',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        // Additional accessibility testing configurations
        reducedMotion: 'reduce',
        forcedColors: 'active'
      },
      testMatch: ['**/login-comprehensive.spec.ts']
    },
    
    // Performance testing
    {
      name: 'performance-tests',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        // Network throttling for performance testing
        launchOptions: {
          args: ['--disable-dev-shm-usage', '--disable-extensions']
        }
      },
      testMatch: ['**/login-comprehensive.spec.ts']
    }
  ],

  // Development server configuration
  webServer: process.env.CI ? undefined : [
    {
      command: 'cd ../backend && npm run dev',
      port: 5000,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        NODE_ENV: 'test'
      }
    },
    {
      command: 'cd ../frontend && npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        NODE_ENV: 'test'
      }
    }
  ],

  // Test output directory
  outputDir: 'test-results',
  
  // Preserve test output
  preserveOutput: 'failures-only',
  
  // Test metadata
  metadata: {
    testType: 'Login Function E2E Testing',
    framework: 'Playwright with TypeScript',
    version: '1.40.0',
    environment: process.env.NODE_ENV || 'development',
    date: new Date().toISOString().split('T')[0]
  }
});