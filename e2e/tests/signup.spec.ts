import { test, expect } from '@playwright/test';

test.describe('Signup Feature Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to signup page directly
    await page.goto('/register');
  });

  test('should display signup form with all required fields', async ({ page }) => {
    // Verify page title and heading
    await expect(page).toHaveTitle(/Fullstack Auth App/);
    await expect(page.locator('h2')).toContainText('Create Account');
    
    // Verify all form fields are present
    await expect(page.getByRole('textbox', { name: 'Full Name*' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email Address*' })).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByLabel('Confirm Password')).toBeVisible();
    
    // Verify terms checkbox
    await expect(page.getByRole('checkbox', { name: /Terms of Service/i })).toBeVisible();
    
    // Verify signup button
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    
    // Verify login link
    await expect(page.getByText('Already have an account?')).toBeVisible();
    await expect(page.getByText('Sign in here')).toBeVisible();
  });

  test('should show validation errors for empty form submission', async ({ page }) => {
    // Try to submit empty form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Wait for validation to trigger
    await page.waitForSelector('.text-red-600', { timeout: 5000 });
    
    // Should show validation errors - using exact error messages from validation schema
    await expect(page.getByText('Full name is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    await expect(page.getByText('Please confirm your password')).toBeVisible();
    await expect(page.getByText('You must agree to the Terms of Service and Privacy Policy')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    // Fill form with invalid email
    await page.getByRole('textbox', { name: 'Full Name*' }).fill('Test User');
    await page.getByRole('textbox', { name: 'Email Address*' }).fill('invalid-email');
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByLabel('Confirm Password').fill('TestPassword123!');
    
    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should show email validation error
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
  });

  test('should validate password strength requirements', async ({ page }) => {
    // Test weak password
    await page.getByRole('textbox', { name: 'Full Name*' }).fill('Test User');
    await page.getByRole('textbox', { name: 'Email Address*' }).fill('test@example.com');
    await page.getByLabel('Password').fill('weak');
    await page.getByLabel('Confirm Password').fill('weak');
    
    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should show password validation error
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('should validate password confirmation match', async ({ page }) => {
    // Fill form with mismatched passwords
    await page.getByRole('textbox', { name: 'Full Name*' }).fill('Test User');
    await page.getByRole('textbox', { name: 'Email Address*' }).fill('test@example.com');
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByLabel('Confirm Password').fill('DifferentPassword123!');
    
    // Accept terms
    await page.getByRole('checkbox', { name: /Terms of Service/i }).check();
    
    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should show password mismatch error
    await expect(page.getByText('Passwords must match')).toBeVisible();
  });

  test('should successfully register new user with valid data', async ({ page }) => {
    // Mock successful registration API response
    await page.route('**/api/auth/register', async route => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: 'mock-token-12345',
            user: {
              id: '123',
              email: 'newuser@example.com',
              name: 'New Test User',
              emailVerified: false,
            },
          },
          message: 'Registration successful'
        }),
      });
    });

    // Fill registration form with valid data
    const timestamp = Date.now();
    const testEmail = `newuser${timestamp}@example.com`;
    
    await page.getByRole('textbox', { name: 'Full Name*' }).fill('New Test User');
    await page.getByRole('textbox', { name: 'Email Address*' }).fill(testEmail);
    await page.getByLabel('Password').fill('SecurePassword123!');
    await page.getByLabel('Confirm Password').fill('SecurePassword123!');
    
    // Accept terms and conditions
    await page.getByRole('checkbox', { name: /Terms of Service/i }).check();
    
    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should redirect to dashboard after successful registration
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Dashboard');
    
    // Verify user is logged in (token should be stored)
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(token).toBeTruthy();
  });

  test('should handle registration error for existing user', async ({ page }) => {
    // Mock registration error (user already exists)
    await page.route('**/api/auth/register', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'User with this email already exists',
        }),
      });
    });

    // Fill form with existing user data
    await page.getByRole('textbox', { name: 'Full Name*' }).fill('Existing User');
    await page.getByRole('textbox', { name: 'Email Address*' }).fill('existing@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.locator('#confirm-password').fill('TestPassword123!');
    
    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should show error message
    await expect(page.getByText('User with this email already exists')).toBeVisible();
    
    // Should remain on registration page
    await expect(page).toHaveURL('/register');
  });

  test('should handle server error during registration', async ({ page }) => {
    // Mock server error
    await page.route('**/api/auth/register', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Internal server error',
        }),
      });
    });

    // Fill form with valid data
    await page.getByRole('textbox', { name: 'Full Name*' }).fill('Test User');
    await page.getByRole('textbox', { name: 'Email Address*' }).fill('test@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.locator('#confirm-password').fill('TestPassword123!');
    
    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should show generic error message
    await expect(page.getByText(/server error/i)).toBeVisible();
  });

  test('should navigate to login page from signup page', async ({ page }) => {
    // Click login link
    await page.getByText('Sign in here').click();
    
    // Should navigate to login page
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h2')).toContainText('Welcome Back');
  });

  test('should show loading state during form submission', async ({ page }) => {
    // Mock delayed API response
    await page.route('**/api/auth/register', async route => {
      // Add delay to simulate loading
      await page.waitForTimeout(2000);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: 'mock-token',
            user: { id: '123', email: 'test@example.com', name: 'Test User', emailVerified: false },
          },
        }),
      });
    });

    // Fill form
    await page.getByRole('textbox', { name: 'Full Name*' }).fill('Test User');
    await page.getByRole('textbox', { name: 'Email Address*' }).fill('test@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.locator('#confirm-password').fill('TestPassword123!');
    
    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should show loading state (button disabled or loading indicator)
    await expect(page.getByRole('button', { name: /creating/i })).toBeVisible();
  });

  test('should validate form accessibility', async ({ page }) => {
    // Check form labels are properly associated
    const nameInput = page.getByRole('textbox', { name: 'Full Name*' });
    const emailInput = page.getByRole('textbox', { name: 'Email Address*' });
    const passwordInput = page.getByLabel('Password');
    const confirmPasswordInput = page.getByLabel('Confirm Password');
    
    // All inputs should be accessible via labels
    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(confirmPasswordInput).toBeVisible();
    
    // Check tab navigation order
    await page.keyboard.press('Tab');
    await expect(nameInput).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(emailInput).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(passwordInput).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(confirmPasswordInput).toBeFocused();
  });

  test('should handle network error during registration', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/auth/register', route => route.abort());

    // Fill form
    await page.getByRole('textbox', { name: 'Full Name*' }).fill('Test User');
    await page.getByRole('textbox', { name: 'Email Address*' }).fill('test@example.com');
    await page.locator('#password').fill('TestPassword123!');
    await page.locator('#confirm-password').fill('TestPassword123!');
    
    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should show network error message
    await expect(page.getByText(/network error|connection failed/i)).toBeVisible();
  });
});