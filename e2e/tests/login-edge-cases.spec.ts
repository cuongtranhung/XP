import { test, expect } from '@playwright/test';

test.describe('🛡️ Login Edge Cases & Security Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h2')).toContainText('Welcome Back');
  });

  test.describe('🔒 Security Edge Cases', () => {
    test('should handle SQL injection attempts in email field', async ({ page }) => {
      const sqlInjectionAttempts = [
        "admin@example.com'; DROP TABLE users; --",
        "test@example.com' OR '1'='1",
        "admin@example.com'; INSERT INTO users (email, password) VALUES ('hacker@evil.com', 'password'); --",
        "test@example.com' UNION SELECT * FROM users WHERE '1'='1",
        "admin@example.com'; UPDATE users SET password='hacked' WHERE email='admin@example.com'; --"
      ];

      await page.route('**/api/auth/login', async route => {
        const postData = JSON.parse(route.request().postData() || '{}');
        
        // Verify that backend properly sanitizes input
        // Should receive clean email input, not SQL injection
        expect(postData.email).not.toContain('DROP TABLE');
        expect(postData.email).not.toContain('INSERT INTO');
        expect(postData.email).not.toContain('UPDATE');
        expect(postData.email).not.toContain('UNION SELECT');
        
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Invalid email or password'
          })
        });
      });

      for (const injection of sqlInjectionAttempts) {
        await page.getByLabel('Email address').fill(injection);
        await page.getByLabel('Password').fill('ValidPassword123!');
        await page.getByRole('button', { name: /sign in/i }).click();
        
        // Should show normal authentication failure, not system error
        await expect(page.getByText('Invalid email or password')).toBeVisible();
        
        // Clear form for next test
        await page.getByLabel('Email address').clear();
      }
    });

    test('should handle XSS attempts in form fields', async ({ page }) => {
      const xssAttempts = [
        '<script>alert("XSS")</script>@example.com',
        'test@example.com<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")@example.com',
        '<svg/onload=alert("XSS")>@example.com',
        'test@example.com"><script>alert("XSS")</script>'
      ];

      for (const xss of xssAttempts) {
        await page.getByLabel('Email address').fill(xss);
        await page.getByLabel('Password').fill('<script>alert("XSS")</script>');
        
        // Verify no script execution
        let alertTriggered = false;
        page.on('dialog', dialog => {
          alertTriggered = true;
          dialog.accept();
        });
        
        await page.getByRole('button', { name: /sign in/i }).click();
        
        // XSS should not execute
        expect(alertTriggered).toBeFalsy();
        
        // Clear form
        await page.getByLabel('Email address').clear();
        await page.getByLabel('Password').clear();
      }
    });

    test('should handle extremely long input values', async ({ page }) => {
      const longEmail = 'a'.repeat(1000) + '@example.com';
      const longPassword = 'A1!'.repeat(1000);
      
      await page.route('**/api/auth/login', async route => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Input too long'
          })
        });
      });

      await page.getByLabel('Email address').fill(longEmail);
      await page.getByLabel('Password').fill(longPassword);
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should handle gracefully with appropriate error
      await expect(page.getByText(/input too long/i).or(page.getByText(/invalid input/i))).toBeVisible();
    });

    test('should handle unicode and special character attacks', async ({ page }) => {
      const unicodeAttempts = [
        '𝓽𝓮𝓼𝓽@𝓮𝔁𝓪𝓶𝓹𝓵𝓮.𝓬𝓸𝓶',
        'test@еxample.com', // Cyrillic characters that look like Latin
        'test@example.com\u0000',
        'test@example.com\uFEFF',
        '测试@example.com'
      ];

      for (const unicode of unicodeAttempts) {
        await page.getByLabel('Email address').fill(unicode);
        await page.getByLabel('Password').fill('ValidPassword123!');
        await page.getByRole('button', { name: /sign in/i }).click();
        
        // Should either validate properly or show appropriate error
        const hasValidationError = await page.getByText(/invalid email/i).isVisible();
        const hasAuthError = await page.getByText(/invalid email or password/i).isVisible();
        
        expect(hasValidationError || hasAuthError).toBeTruthy();
        
        await page.getByLabel('Email address').clear();
      }
    });
  });

  test.describe('🌊 Boundary Value Testing', () => {
    test('should handle minimum and maximum valid email lengths', async ({ page }) => {
      // Minimum valid email: a@b.co (6 characters)
      const minEmail = 'a@b.co';
      
      // Maximum reasonable email length (320 characters is RFC limit)
      const maxEmail = 'a'.repeat(64) + '@' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(63) + '.' + 'e'.repeat(63) + '.com';
      
      const emails = [minEmail, maxEmail];
      
      for (const email of emails) {
        await page.getByLabel('Email address').fill(email);
        await page.getByLabel('Password').fill('ValidPassword123!');
        
        // Should accept valid format regardless of length
        await expect(page.getByLabel('Email address')).toHaveValue(email);
        
        await page.getByLabel('Email address').clear();
      }
    });

    test('should handle password length boundaries', async ({ page }) => {
      const passwords = [
        'A1!',           // Too short (3 chars)
        'A1!abcd',       // Minimum (8 chars)
        'A1!' + 'a'.repeat(125), // Very long (128 chars)
        'A1!' + 'a'.repeat(1021) // Extremely long (1024 chars)
      ];

      await page.getByLabel('Email address').fill('test@example.com');

      for (const password of passwords) {
        await page.getByLabel('Password').fill(password);
        await page.getByRole('button', { name: /sign in/i }).click();
        
        // Very short passwords should show validation error
        if (password.length < 8) {
          const hasError = await page.getByText(/password.+least/i).isVisible();
          expect(hasError).toBeTruthy();
        }
        
        await page.getByLabel('Password').clear();
      }
    });
  });

  test.describe('🔄 Concurrent Access & Race Conditions', () => {
    test('should handle multiple rapid form submissions', async ({ page }) => {
      let submissionCount = 0;
      
      await page.route('**/api/auth/login', async route => {
        submissionCount++;
        
        // Add small delay to simulate server processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Invalid email or password'
          })
        });
      });

      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('ValidPassword123!');
      
      // Submit form multiple times rapidly
      const submitButton = page.getByRole('button', { name: /sign in/i });
      await Promise.all([
        submitButton.click(),
        submitButton.click(),
        submitButton.click()
      ]);
      
      // Should only submit once (button should be disabled during submission)
      await page.waitForTimeout(500);
      expect(submissionCount).toBeLessThanOrEqual(1);
    });

    test('should handle browser session conflicts', async ({ browser }) => {
      // Create two different browser contexts (simulating different sessions)
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      // Mock successful login for both
      for (const page of [page1, page2]) {
        await page.route('**/api/auth/login', async route => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                token: 'test-token-' + Date.now(),
                user: { id: 1, email: 'test@example.com', name: 'Test User', emailVerified: true }
              }
            })
          });
        });
      }
      
      // Navigate both to login page
      await page1.goto('/');
      await page2.goto('/');
      
      // Login from both contexts simultaneously
      await Promise.all([
        page1.getByLabel('Email address').fill('test@example.com'),
        page2.getByLabel('Email address').fill('test@example.com')
      ]);
      
      await Promise.all([
        page1.getByLabel('Password').fill('ValidPassword123!'),
        page2.getByLabel('Password').fill('ValidPassword123!')
      ]);
      
      await Promise.all([
        page1.getByRole('button', { name: /sign in/i }).click(),
        page2.getByRole('button', { name: /sign in/i }).click()
      ]);
      
      // Both should be able to login successfully (different sessions)
      await expect(page1).toHaveURL('/dashboard');
      await expect(page2).toHaveURL('/dashboard');
      
      await context1.close();
      await context2.close();
    });
  });

  test.describe('🌐 Browser Compatibility Edge Cases', () => {
    test('should handle JavaScript disabled scenario', async ({ page }) => {
      // Disable JavaScript
      await page.context().setJavaScriptEnabled(false);
      await page.goto('/');
      
      // Form should still be visible (basic HTML)
      await expect(page.getByLabel('Email address')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
      
      // Note: Without JS, form validation and AJAX won't work
      // But basic HTML form should still be present
    });

    test('should handle cookies disabled', async ({ context, page }) => {
      // Clear all cookies and disable them
      await context.clearCookies();
      
      // Mock login that relies on localStorage instead of cookies
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
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should work with localStorage even without cookies
      await expect(page).toHaveURL('/dashboard');
      
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBe('test-token');
    });

    test('should handle localStorage unavailable', async ({ page }) => {
      // Mock localStorage to be unavailable
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          value: null,
          writable: false
        });
      });

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
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should handle gracefully (might show warning about browser compatibility)
      const hasCompatibilityWarning = await page.getByText(/browser.+support/i).isVisible();
      const isRedirected = await page.url().includes('/dashboard');
      
      // Either should work with fallback or show compatibility warning
      expect(hasCompatibilityWarning || isRedirected).toBeTruthy();
    });
  });

  test.describe('📱 Mobile & Touch Edge Cases', () => {
    test('should handle virtual keyboard on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Focus on email field (would trigger virtual keyboard on real device)
      await page.getByLabel('Email address').focus();
      
      // Verify field is still accessible after keyboard appears
      await expect(page.getByLabel('Email address')).toBeFocused();
      
      // Fill form
      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('ValidPassword123!');
      
      // Verify submit button is still accessible
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should handle touch events properly', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Test tap on form fields
      await page.getByLabel('Email address').tap();
      await expect(page.getByLabel('Email address')).toBeFocused();
      
      await page.getByLabel('Password').tap();
      await expect(page.getByLabel('Password')).toBeFocused();
      
      // Test tap on submit button
      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('ValidPassword123!');
      
      await page.route('**/api/auth/login', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Invalid email or password'
          })
        });
      });
      
      await page.getByRole('button', { name: /sign in/i }).tap();
      await expect(page.getByText('Invalid email or password')).toBeVisible();
    });
  });

  test.describe('⚡ Performance Edge Cases', () => {
    test('should handle slow network conditions', async ({ page }) => {
      // Simulate slow network
      await page.route('**/api/auth/login', async route => {
        // Add significant delay
        await new Promise(resolve => setTimeout(resolve, 5000));
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
      await page.getByRole('button', { name: /sign in/i }).click();
      
      // Should show loading state immediately
      const loadingState = page.getByText(/loading/i).or(page.getByText(/signing in/i));
      await expect(loadingState.first()).toBeVisible();
      
      // Should complete eventually
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    });

    test('should handle memory pressure scenarios', async ({ page }) => {
      // Simulate memory pressure by creating large objects
      await page.evaluate(() => {
        const largeArray = new Array(1000000).fill('memory-pressure-test');
        (window as any).memoryPressure = largeArray;
      });
      
      // Form should still function under memory pressure
      await page.getByLabel('Email address').fill('test@example.com');
      await page.getByLabel('Password').fill('ValidPassword123!');
      
      await expect(page.getByLabel('Email address')).toHaveValue('test@example.com');
      await expect(page.getByLabel('Password')).toHaveValue('ValidPassword123!');
    });
  });
});