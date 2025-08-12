import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // webServer: [
  //   {
  //     command: 'cd ../backend && npm run dev',
  //     port: 5000,
  //     timeout: 120 * 1000,
  //     reuseExistingServer: !process.env.CI,
  //   },
  //   {
  //     command: 'cd ../frontend && npm run dev',
  //     port: 3000,
  //     timeout: 120 * 1000,
  //     reuseExistingServer: !process.env.CI,
  //   },
  // ],
});