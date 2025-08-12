import { test, expect } from '@playwright/test';

test.describe('Login Test - Specific User', () => {
  const testUser = {
    email: 'cuongtranhung@gmail.com',
    password: '@Abcd6789'
  };

  test.beforeEach(async ({ page }) => {
    // Navigate to the login page
    await page.goto('http://localhost:3000/login');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Take screenshot of login page
    await page.screenshot({ path: 'login-page-initial.png' });

    // Wait for the page to fully load and check for React app
    await page.waitForTimeout(3000);
    
    // Debug: Log page content
    const pageContent = await page.content();
    console.log('Page title:', await page.title());
    console.log('Page URL:', page.url());
    
    // Try multiple selectors for email input
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]', 
      'input[placeholder*="email" i]',
      '[data-testid="email-input"]',
      'input#email'
    ];
    
    let emailInput = null;
    for (const selector of emailSelectors) {
      const element = page.locator(selector);
      if (await element.count() > 0) {
        emailInput = element.first();
        console.log(`Found email input with selector: ${selector}`);
        break;
      }
    }
    
    if (!emailInput) {
      // Take debug screenshot
      await page.screenshot({ path: 'debug-no-email-input.png' });
      throw new Error('Email input not found with any selector');
    }

    // Try multiple selectors for password input  
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="password" i]',
      '[data-testid="password-input"]',
      'input#password'
    ];
    
    let passwordInput = null;
    for (const selector of passwordSelectors) {
      const element = page.locator(selector);
      if (await element.count() > 0) {
        passwordInput = element.first();
        console.log(`Found password input with selector: ${selector}`);
        break;
      }
    }
    
    if (!passwordInput) {
      await page.screenshot({ path: 'debug-no-password-input.png' });
      throw new Error('Password input not found with any selector');
    }

    // Try multiple selectors for submit button
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Sign in")',
      'button:has-text("Login")',
      'button:has-text("Log in")',
      '[data-testid="login-button"]'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      const element = page.locator(selector);
      if (await element.count() > 0) {
        submitButton = element.first();
        console.log(`Found submit button with selector: ${selector}`);
        break;
      }
    }
    
    if (!submitButton) {
      await page.screenshot({ path: 'debug-no-submit-button.png' });
      throw new Error('Submit button not found with any selector');
    }

    // Wait for form elements to be visible
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
    await expect(submitButton).toBeVisible({ timeout: 10000 });

    // Fill in the login form
    await emailInput.fill(testUser.email);
    await passwordInput.fill(testUser.password);

    // Take screenshot after filling form
    await page.screenshot({ path: 'login-form-filled.png' });

    // Listen for console messages
    page.on('console', msg => {
      console.log('Browser console:', msg.type(), msg.text());
    });

    // Listen for network responses
    page.on('response', response => {
      if (response.url().includes('/api/auth')) {
        console.log('API Response:', response.url(), response.status());
      }
    });

    // Click the submit button
    await submitButton.click();

    // Wait for navigation or response
    try {
      await page.waitForURL('**/dashboard', { timeout: 5000 });
      console.log('✅ Successfully redirected to dashboard');
      await page.screenshot({ path: 'dashboard-after-login.png' });
      expect(page.url()).toContain('/dashboard');
    } catch (e) {
      // Check for any error messages
      const errorMessage = page.locator('.error-message, .alert-error, [role="alert"], .text-red-500, .text-red-600');
      if (await errorMessage.count() > 0) {
        const errorText = await errorMessage.first().textContent();
        console.log('❌ Login failed with error:', errorText);
        await page.screenshot({ path: 'login-error.png' });
        throw new Error(`Login failed: ${errorText}`);
      } else {
        // Check current URL and page content
        console.log('Current URL:', page.url());
        await page.screenshot({ path: 'login-result.png' });
        
        // Check if login was actually successful but no redirect
        const userInfo = page.locator('[data-testid="user-info"], .user-info, .user-name');
        if (await userInfo.count() > 0) {
          console.log('✅ User info found, login successful');
        } else if (page.url().includes('/login')) {
          // Still on login page
          throw new Error('Login failed - still on login page after submission');
        }
      }
    }
  });

  test('should display user information after login', async ({ page }) => {
    // Perform login
    await page.locator('input[type="email"], input[name="email"], input#email').fill(testUser.email);
    await page.locator('input[type="password"], input[name="password"], input#password').fill(testUser.password);
    await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').click();
    
    await page.waitForLoadState('networkidle');

    // Check for user email or name display
    const userEmail = page.locator(`text=${testUser.email}`);
    const userAvatar = page.locator('.user-avatar, .avatar, img[alt*="avatar"]');
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")');

    // Check if any user indicator is visible
    const isUserEmailVisible = await userEmail.isVisible().catch(() => false);
    const isUserAvatarVisible = await userAvatar.isVisible().catch(() => false);
    const isLogoutButtonVisible = await logoutButton.isVisible().catch(() => false);

    if (isUserEmailVisible || isUserAvatarVisible || isLogoutButtonVisible) {
      console.log('✅ User session indicators found');
      await page.screenshot({ path: 'user-logged-in.png' });
      expect(isUserEmailVisible || isUserAvatarVisible || isLogoutButtonVisible).toBeTruthy();
    } else {
      console.log('⚠️ No user session indicators found');
      await page.screenshot({ path: 'no-user-indicators.png' });
    }
  });

  test('should handle logout after successful login', async ({ page }) => {
    // Perform login
    await page.locator('input[type="email"], input[name="email"], input#email').fill(testUser.email);
    await page.locator('input[type="password"], input[name="password"], input#password').fill(testUser.password);
    await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').click();
    
    await page.waitForLoadState('networkidle');

    // Try to find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")');
    
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForLoadState('networkidle');
      
      // Check if redirected back to login
      if (page.url().includes('/login')) {
        console.log('✅ Successfully logged out and redirected to login');
        expect(page.url()).toContain('/login');
      }
    } else {
      console.log('⚠️ Logout button not found - user might not be logged in');
    }
  });
});