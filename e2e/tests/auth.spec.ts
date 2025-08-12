import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveTitle(/Fullstack Auth App/);
    await expect(page.locator('h2')).toContainText('Welcome Back');
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();
    
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.getByText('Create one here').click();
    
    await expect(page).toHaveURL('/register');
    await expect(page.locator('h2')).toContainText('Create Account');
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.getByText('Forgot password?').click();
    
    await expect(page).toHaveURL('/forgot-password');
    await expect(page.locator('h2')).toContainText('Forgot Password?');
  });

  test('should register new user', async ({ page }) => {
    // Navigate to register page
    await page.getByText('Create one here').click();
    
    // Fill registration form
    const testEmail = `test${Date.now()}@example.com`;
    await page.getByLabel('Name').fill('Test User');
    await page.getByLabel('Email address').fill(testEmail);
    await page.getByLabel('Password', { exact: true }).fill('TestPassword123!');
    await page.getByLabel('Confirm password').fill('TestPassword123!');
    
    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should redirect to dashboard after successful registration
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should login with valid credentials', async ({ page }) => {
    // This test would require a pre-existing user in the database
    // For now, we'll test the login flow without actual authentication
    
    await page.getByLabel('Email address').fill('test@example.com');
    await page.getByLabel('Password').fill('TestPassword123!');
    
    // Intercept the API call to mock successful login
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: 'mock-token',
            user: {
              id: '123',
              email: 'test@example.com',
              name: 'Test User',
              emailVerified: true,
            },
          },
        }),
      });
    });
    
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel('Email address').fill('wrong@example.com');
    await page.getByLabel('Password').fill('WrongPassword123!');
    
    // Intercept the API call to mock failed login
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Invalid email or password',
          },
        }),
      });
    });
    
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Should show error message
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });

  test('should logout user', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock-token');
    });
    
    // Intercept validate token API call
    await page.route('**/api/auth/validate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: '123',
              email: 'test@example.com',
              name: 'Test User',
              emailVerified: true,
            },
          },
        }),
      });
    });
    
    // Go to dashboard
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    // Click logout
    await page.getByRole('button', { name: /logout/i }).click();
    
    // Should redirect to login page
    await expect(page).toHaveURL('/login');
    
    // Token should be removed
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});