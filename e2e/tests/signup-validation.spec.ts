import { test, expect } from '@playwright/test';

test.describe('Signup Validation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should validate individual fields on blur', async ({ page }) => {
    // Test full name validation
    const nameInput = page.getByRole('textbox', { name: 'Full Name*' });
    await nameInput.click();
    await nameInput.blur();
    // Wait a moment for validation to appear
    await page.waitForTimeout(500);
    
    // Test email validation
    const emailInput = page.getByRole('textbox', { name: 'Email Address*' });
    await emailInput.fill('invalid-email');
    await emailInput.blur();
    await page.waitForTimeout(500);
    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
    
    // Test password validation
    const passwordInput = page.locator('#password');
    await passwordInput.fill('weak');
    await passwordInput.blur();
    await page.waitForTimeout(500);
    
    // Test password mismatch
    const confirmPasswordInput = page.locator('#confirm-password');
    await passwordInput.fill('StrongPassword123!');
    await confirmPasswordInput.fill('DifferentPassword123!');
    await confirmPasswordInput.blur();
    await page.waitForTimeout(500);
    await expect(page.getByText('Passwords must match')).toBeVisible();
  });

  test('should require terms checkbox', async ({ page }) => {
    // Fill all fields correctly but don't check terms
    await page.getByRole('textbox', { name: 'Full Name*' }).fill('Test User');
    await page.getByRole('textbox', { name: 'Email Address*' }).fill('test@example.com');
    await page.locator('#password').fill('StrongPassword123!');
    await page.locator('#confirm-password').fill('StrongPassword123!');
    
    // Submit without checking terms
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should show terms validation error
    await expect(page.getByText('You must agree to the Terms of Service and Privacy Policy')).toBeVisible();
  });

  test('should successfully validate complete form', async ({ page }) => {
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
              email: 'validuser@example.com',
              name: 'Valid User',
              emailVerified: false,
            },
          },
          message: 'Registration successful'
        }),
      });
    });

    // Fill valid form data
    const timestamp = Date.now();
    const testEmail = `validuser${timestamp}@example.com`;
    
    await page.getByRole('textbox', { name: 'Full Name*' }).fill('Valid User');
    await page.getByRole('textbox', { name: 'Email Address*' }).fill(testEmail);
    await page.locator('#password').fill('StrongPassword123!');
    await page.locator('#confirm-password').fill('StrongPassword123!');
    
    // Check terms checkbox
    await page.getByRole('checkbox', { name: /Terms of Service/i }).check();
    
    // Submit form
    await page.getByRole('button', { name: /create account/i }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });
});