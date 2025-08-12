import { test, expect } from '@playwright/test';

test.describe('🔐 Comprehensive Login Testing Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/');
    
    // Verify we're on the login page
    await expect(page).toHaveTitle(/Fullstack Auth App/);
    await expect(page.locator('h2')).toContainText('Welcome Back');
  });

  test.describe('📝 Form Element Validation', () => {
    test('should display all required form elements', async ({ page }) => {
      // Email field
      const emailField = page.getByLabel('Email address');
      await expect(emailField).toBeVisible();
      await expect(emailField).toHaveAttribute('type', 'email');
      await expect(emailField).toHaveAttribute('required');
      await expect(emailField).toBeEditable();

      // Password field
      const passwordField = page.getByLabel('Password');
      await expect(passwordField).toBeVisible();
      await expect(passwordField).toHaveAttribute('type', 'password');
      await expect(passwordField).toHaveAttribute('required');
      await expect(passwordField).toBeEditable();

      // Submit button
      const submitButton = page.getByRole('button', { name: /sign in/i });
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();

      // Navigation links
      await expect(page.getByText('Create one here')).toBeVisible();
      await expect(page.getByText('Forgot password?')).toBeVisible();
    });

    test('should have proper accessibility attributes', async ({ page }) => {
      // Check ARIA labels and roles
      const emailField = page.getByLabel('Email address');
      const passwordField = page.getByLabel('Password');
      
      await expect(emailField).toHaveAttribute('aria-required', 'true');
      await expect(passwordField).toHaveAttribute('aria-required', 'true');
      
      // Check form structure
      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('should support keyboard navigation', async ({ page }) => {
      // Tab navigation through form elements
      await page.keyboard.press('Tab');
      await expect(page.getByLabel('Email address')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.getByLabel('Password')).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: /sign in/i })).toBeFocused();
    });
  });

  test.describe('✅ Input Validation', () => {
    test('should show validation errors for empty form submission', async ({ page }) => {
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Check for validation error messages
      await expect(page.getByText('Email is required')).toBeVisible();
      await expect(page.getByText('Password is required')).toBeVisible();
      
      // Verify form was not submitted (still on login page)
      await expect(page).toHaveURL('/');
    });

    test('should validate email format', async ({ page }) => {
      const emailField = page.getByLabel('Email address');
      
      // Test invalid email formats
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@domain.com',
        'test..test@domain.com',
        'test@domain',
        'test@.com'
      ];

      for (const email of invalidEmails) {
        await emailField.fill(email);
        await page.getByLabel('Password').fill('ValidPassword123!');
        await page.getByRole('button', { name: /sign in/i }).click();
        
        // Should show email validation error
        await expect(page.getByText(/invalid email/i).or(page.getByText(/email.+valid/i))).toBeVisible();
        
        // Clear the field for next test
        await emailField.clear();
      }
    });

    test('should validate password requirements', async ({ page }) => {
      await page.getByLabel('Email address').fill('test@example.com');
      
      const passwordField = page.getByLabel('Password');
      
      // Test weak passwords
      const weakPasswords = [
        '',
        '123',
        'short',
        'password',
        'PASSWORD',
        '12345678'
      ];

      for (const password of weakPasswords) {
        await passwordField.fill(password);
        await page.getByRole('button', { name: /sign in/i }).click();
        
        // Should show password validation error or authentication failure
        const hasValidationError = await page.getByText(/password.+required/i).isVisible();
        const hasMinLengthError = await page.getByText(/password.+least/i).isVisible();
        
        expect(hasValidationError || hasMinLengthError).toBeTruthy();
        
        await passwordField.clear();
      }
    });

    test('should handle special characters in input fields', async ({ page }) => {
      const specialInputs = [
        { email: 'test+tag@example.com', password: 'Valid@Pass123!' },
        { email: 'user.name@domain-name.com', password: 'Complex&Password#2024' },
        { email: 'test_user@example.org', password: 'Special$Characters%Pass' }
      ];

      for (const { email, password } of specialInputs) {
        await page.getByLabel('Email address').fill(email);
        await page.getByLabel('Password').fill(password);
        
        // Verify inputs are accepted (no immediate validation errors)
        await expect(page.getByLabel('Email address')).toHaveValue(email);
        await expect(page.getByLabel('Password')).toHaveValue(password);
        
        // Clear for next iteration
        await page.getByLabel('Email address').clear();
        await page.getByLabel('Password').clear();
      }
    });
  });

  test.describe('🔒 Authentication Flow Testing', () => {
    test('should handle successful login with valid credentials', async ({ page }) => {
      // Mock successful authentication response
      await page.route('**/api/auth/login', async route => {
        const request = route.request();
        const postData = JSON.parse(request.postData() || '{}');
        
        // Verify request structure
        expect(postData).toHaveProperty('email');
        expect(postData).toHaveProperty('password');
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, GET, OPTIONS',
            'access-control-allow-headers': 'content-type, authorization'
          },
          body: JSON.stringify({
            success: true,
            data: {
              token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
              user: {
                id: 1,
                email: 'test@example.com',
                name: 'Test User',
                emailVerified: true
              }
            },
            message: 'Login successful'
          })
        });
      });

      // Fill login form with valid credentials
      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('ValidPassword123!');
      
      // Submit form
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
      await expect(page.locator('h1')).toContainText('Dashboard');
      
      // Verify user is logged in (check for user info or logout button)
      await expect(page.getByRole('button', { name: /logout/i })).toBeVisible();
    });

    test('should handle login failure with invalid credentials', async ({ page }) => {
      // Mock failed authentication response
      await page.route('**/api/auth/login', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          headers: {
            'access-control-allow-origin': '*'
          },
          body: JSON.stringify({
            success: false,
            message: 'Invalid email or password'
          })
        });
      });

      // Fill form with invalid credentials
      await page.getByLabel('Email address').fill('wrong@example.com');
      await page.getByLabel('Password').fill('WrongPassword123!');
      
      // Submit form
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show error message
      await expect(page.getByText('Invalid email or password')).toBeVisible();
      
      // Should remain on login page
      await expect(page).toHaveURL('/');
      await expect(page.locator('h2')).toContainText('Welcome Back');
    });

    test('should handle server errors gracefully', async ({ page }) => {
      // Mock server error response
      await page.route('**/api/auth/login', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Internal server error'
          })
        });
      });

      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('ValidPassword123!');
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show appropriate error message
      const errorMessage = page.getByText(/server error/i).or(page.getByText(/something went wrong/i));
      await expect(errorMessage).toBeVisible();
    });

    test('should handle network connectivity issues', async ({ page }) => {
      // Mock network failure
      await page.route('**/api/auth/login', async route => {
        await route.abort('failed');
      });

      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('ValidPassword123!');
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show network error message
      const networkError = page.getByText(/network error/i).or(page.getByText(/connection/i));
      await expect(networkError).toBeVisible();
    });
  });

  test.describe('🔄 Rate Limiting & Security', () => {
    test('should handle rate limiting', async ({ page }) => {
      // Mock rate limit response
      await page.route('**/api/auth/login', async route => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          headers: {
            'x-ratelimit-limit': '5',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Date.now() + 900000)
          },
          body: JSON.stringify({
            success: false,
            message: 'Too many login attempts. Please try again later.'
          })
        });
      });

      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('ValidPassword123!');
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show rate limit message
      await expect(page.getByText(/too many.+attempts/i)).toBeVisible();
    });

    test('should not expose sensitive information in error messages', async ({ page }) => {
      // Mock response that doesn't leak user existence
      await page.route('**/api/auth/login', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Invalid email or password'  // Generic message
          })
        });
      });

      // Test with non-existent email
      await page.getByLabel('Email address').fill('nonexistent@example.com');
      await page.getByLabel('Password').fill('SomePassword123!');
      
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show generic error (no indication whether email exists)
      await expect(page.getByText('Invalid email or password')).toBeVisible();
      
      // Should not show messages like "Email not found" or "User does not exist"
      await expect(page.getByText(/email.+not.+found/i)).not.toBeVisible();
      await expect(page.getByText(/user.+not.+exist/i)).not.toBeVisible();
    });
  });

  test.describe('💾 State Management & Persistence', () => {
    test('should persist authentication state', async ({ page }) => {
      // Mock successful login
      await page.route('**/api/auth/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              token: 'test-jwt-token',
              user: {
                id: 1,
                email: 'test@example.com',
                name: 'Test User',
                emailVerified: true
              }
            }
          })
        });
      });

      // Login
      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('ValidPassword123!');
      await page.getByRole('button', { name: /sign in/i }).click();
      
      await expect(page).toHaveURL('/dashboard');
      
      // Check if token is stored in localStorage
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBe('test-jwt-token');
      
      // Refresh page and verify user remains logged in
      await page.reload();
      
      // Mock token validation
      await page.route('**/api/auth/validate', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              valid: true,
              user: {
                id: 1,
                email: 'test@example.com',
                name: 'Test User'
              }
            }
          })
        });
      });
      
      // Should still be on dashboard after refresh
      await expect(page).toHaveURL('/dashboard');
    });

    test('should handle expired tokens gracefully', async ({ page }) => {
      // Set expired token in localStorage
      await page.addInitScript(() => {
        localStorage.setItem('token', 'expired-token');
      });

      // Mock token validation failure
      await page.route('**/api/auth/validate', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Token expired'
          })
        });
      });

      // Try to access protected route
      await page.goto('/dashboard');
      
      // Should redirect to login page
      await expect(page).toHaveURL('/');
      
      // Token should be cleared from localStorage
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeNull();
    });
  });

  test.describe('🌐 Cross-Browser & Responsive Testing', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Verify login form is still functional
      await expect(page.getByLabel('Email address')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      
      // Form should be responsive
      const form = page.locator('form');
      const formBox = await form.boundingBox();
      expect(formBox?.width).toBeLessThanOrEqual(375);
    });

    test('should handle browser back/forward navigation', async ({ page }) => {
      // Navigate to register page
      await page.getByText('Create one here').click();
      await expect(page).toHaveURL('/register');
      
      // Go back to login
      await page.goBack();
      await expect(page).toHaveURL('/');
      await expect(page.locator('h2')).toContainText('Welcome Back');
      
      // Go forward to register again
      await page.goForward();
      await expect(page).toHaveURL('/register');
    });
  });

  test.describe('🎯 Performance & UX', () => {
    test('should show loading state during authentication', async ({ page }) => {
      // Add delay to login response
      await page.route('**/api/auth/login', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              token: 'test-token',
              user: { id: 1, email: 'test@example.com', name: 'Test User', emailVerified: true }
            }
          })
        });
      });

      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('ValidPassword123!');
      
      // Click submit and immediately check for loading state
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show loading indicator or disabled button
      const loadingIndicator = page.getByText(/loading/i).or(page.locator('.spinner')).or(page.getByRole('button', { name: /signing in/i }));
      await expect(loadingIndicator.first()).toBeVisible();
    });

    test('should have reasonable form submission performance', async ({ page }) => {
      await page.route('**/api/auth/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              token: 'test-token',
              user: { id: 1, email: 'test@example.com', name: 'Test User', emailVerified: true }
            }
          })
        });
      });

      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('ValidPassword123!');
      
      const startTime = Date.now();
      await page.getByRole('button', { name: /sign in/i }).click();
      await expect(page).toHaveURL('/dashboard');
      const endTime = Date.now();
      
      // Form submission should complete within reasonable time
      const submissionTime = endTime - startTime;
      expect(submissionTime).toBeLessThan(5000); // 5 seconds max
    });
  });
});