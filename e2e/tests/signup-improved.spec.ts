import { test, expect } from '@playwright/test';
import { RegisterPage } from '../pages/RegisterPage';

/**
 * Improved Signup Tests with Best Practices
 * 
 * Improvements:
 * - Page Object Model for maintainability
 * - Semantic selectors for accessibility
 * - Proper error handling and waits
 * - Data-driven tests
 * - API mocking for consistent testing
 */
test.describe('Registration Feature - Improved', () => {
  let registerPage: RegisterPage;
  
  test.beforeEach(async ({ page }) => {
    registerPage = new RegisterPage(page);
    await registerPage.goto();
  });
  
  test('should display registration form with all required elements', async () => {
    await registerPage.verifyPageElements();
  });
  
  test('should show validation errors for empty form submission', async () => {
    // Submit empty form
    await registerPage.submit();
    
    // Wait for validation to trigger
    await registerPage.waitForValidationErrors();
    
    // Verify all required field errors are shown
    await expect(registerPage.page.getByText('Full name is required')).toBeVisible();
    await expect(registerPage.page.getByText('Email is required')).toBeVisible();
    await expect(registerPage.page.getByText('Password is required')).toBeVisible();
    await expect(registerPage.page.getByText('Please confirm your password')).toBeVisible();
    await expect(registerPage.page.getByText('You must agree to the Terms of Service and Privacy Policy')).toBeVisible();
  });
  
  test.describe('Form Validation', () => {
    const validFormData = {
      fullName: 'Test User',
      email: 'test@example.com',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
      acceptTerms: true
    };
    
    test('should validate email format', async () => {
      await registerPage.fillForm({
        ...validFormData,
        email: 'invalid-email'
      });
      
      await registerPage.submit();
      await expect(registerPage.page.getByText('Please enter a valid email address')).toBeVisible();
    });
    
    test('should validate password strength', async () => {
      await registerPage.fillForm({
        ...validFormData,
        password: 'weak',
        confirmPassword: 'weak'
      });
      
      await registerPage.submit();
      await expect(registerPage.page.getByText('Password must be at least 8 characters')).toBeVisible();
    });
    
    test('should validate password confirmation match', async () => {
      await registerPage.fillForm({
        ...validFormData,
        confirmPassword: 'DifferentPassword123!'
      });
      
      await registerPage.submit();
      await expect(registerPage.page.getByText('Passwords must match')).toBeVisible();
    });
    
    test('should require terms acceptance', async () => {
      await registerPage.fillForm({
        ...validFormData,
        acceptTerms: false
      });
      
      await registerPage.submit();
      await registerPage.waitForValidationErrors();
      await expect(registerPage.page.getByText('You must agree to the Terms of Service and Privacy Policy')).toBeVisible();
    });
  });
  
  test.describe('API Integration', () => {
    test('should successfully register with valid data', async ({ page }) => {
      // Mock successful registration response
      await page.route('**/api/auth/register', async route => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              token: 'mock-jwt-token',
              user: {
                id: '123',
                email: 'test@example.com',
                full_name: 'Test User',
                email_verified: false,
              },
            },
            message: 'Registration successful'
          }),
        });
      });
      
      const userData = {
        fullName: 'Test User',
        email: `test${Date.now()}@example.com`,
        password: 'SecurePassword123!'
      };
      
      await registerPage.registerUser(userData);
      
      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
      
      // Verify token is stored
      const token = await page.evaluate(() => localStorage.getItem('auth_token'));
      expect(token).toBeTruthy();
    });
    
    test('should handle registration error for existing user', async ({ page }) => {
      // Mock error response for existing user  
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
      
      await registerPage.registerUser({
        fullName: 'Existing User',
        email: 'existing@example.com',
        password: 'TestPassword123!'
      });
      
      // Should show error message
      await expect(page.getByText('User with this email already exists')).toBeVisible();
      
      // Should remain on registration page
      await expect(page).toHaveURL('/register');
    });
    
    test('should handle server error', async ({ page }) => {
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
      
      await registerPage.registerUser({
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'TestPassword123!'
      });
      
      // Should show error message
      await expect(page.getByText(/server error/i)).toBeVisible();
    });
    
    test('should handle network failure', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/auth/register', route => route.abort());
      
      await registerPage.registerUser({
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'TestPassword123!'
      });
      
      // Should show network error
      await expect(page.getByText(/network error|connection failed/i)).toBeVisible();
    });
  });
  
  test.describe('User Experience', () => {
    test('should navigate to login page', async ({ page }) => {
      await registerPage.goToLogin();
      await expect(page.locator('h2')).toContainText('Welcome Back');
    });
    
    test('should show loading state during submission', async ({ page }) => {
      // Mock delayed response
      await page.route('**/api/auth/register', async route => {
        await page.waitForTimeout(2000);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { token: 'token', user: {} }
          }),
        });
      });
      
      await registerPage.fillForm({
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!',
        acceptTerms: true
      });
      
      await registerPage.submit();
      
      // Should show loading state (button disabled or loading text)
      await expect(page.getByRole('button', { name: /creating|loading/i })).toBeVisible();
    });
  });
  
  test.describe('Accessibility', () => {
    test('should support keyboard navigation', async ({ page }) => {
      // Test tab order
      await page.keyboard.press('Tab');
      await expect(registerPage.fullNameInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(registerPage.emailInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(registerPage.passwordInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(registerPage.confirmPasswordInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(registerPage.termsCheckbox).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(registerPage.submitButton).toBeFocused();
    });
    
    test('should have proper ARIA labels and roles', async () => {
      // Verify form elements have proper accessibility attributes
      await expect(registerPage.fullNameInput).toHaveAttribute('aria-required', 'true');
      await expect(registerPage.emailInput).toHaveAttribute('type', 'email');
      await expect(registerPage.passwordInput).toHaveAttribute('type', 'password');
      await expect(registerPage.submitButton).toHaveRole('button');
      await expect(registerPage.termsCheckbox).toHaveRole('checkbox');
    });
  });
});