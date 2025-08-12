import { test, expect } from '@playwright/test';

test.describe('Login Test - WSL2 Environment', () => {
  const baseUrl = 'http://172.26.249.148:3000';
  const apiUrl = 'http://172.26.249.148:5000';
  const testUser = {
    email: 'cuongtranhung@gmail.com',
    password: '@Abcd6789'
  };

  test.beforeEach(async ({ page }) => {
    console.log('🔍 Navigating to', baseUrl + '/login');
    await page.goto(baseUrl + '/login', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
  });

  test('should load login page successfully', async ({ page }) => {
    console.log('📋 Testing login page load...');
    
    // Check if page loads
    await expect(page).toHaveURL(/.*login/);
    
    // Check for login form elements
    const emailInput = page.locator('input[type="email"], input[name="email"], #email');
    const passwordInput = page.locator('input[type="password"], input[name="password"], #password');
    const loginButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")');
    
    // Verify elements are visible
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
    
    console.log('✅ Login page loaded successfully');
  });

  test('should login with valid credentials', async ({ page }) => {
    console.log('🔐 Testing login with:', testUser.email);
    
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
    
    // Find and fill email field
    const emailInput = page.locator('input[type="email"], input[name="email"], #email').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.click();
    await emailInput.fill(testUser.email);
    console.log('✅ Email entered');
    
    // Find and fill password field
    const passwordInput = page.locator('input[type="password"], input[name="password"], #password').first();
    await passwordInput.click();
    await passwordInput.fill(testUser.password);
    console.log('✅ Password entered');
    
    // Take screenshot before login
    await page.screenshot({ path: 'login-form-filled.png', fullPage: true });
    
    // Setup request monitoring
    const loginPromise = page.waitForResponse(
      response => response.url().includes('/api/auth/login') && response.status() === 200,
      { timeout: 30000 }
    ).catch(() => null);
    
    // Monitor network requests
    page.on('response', response => {
      if (response.url().includes('/api/auth/login')) {
        console.log('📡 API Response:', response.status(), response.url());
      }
    });
    
    // Click login button
    const loginButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
    await loginButton.click();
    console.log('🔄 Login button clicked, waiting for response...');
    
    // Wait for either navigation or API response
    const result = await Promise.race([
      loginPromise,
      page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => null),
      page.waitForTimeout(5000)
    ]);
    
    // Check for success indicators
    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);
    
    // Take screenshot after login attempt
    await page.screenshot({ path: 'after-login-attempt.png', fullPage: true });
    
    // Check for error messages
    const errorMessages = await page.locator('text=/error|invalid|failed/i').count();
    if (errorMessages > 0) {
      const errorText = await page.locator('text=/error|invalid|failed/i').first().textContent();
      console.error('❌ Login error found:', errorText);
      throw new Error(`Login failed with error: ${errorText}`);
    }
    
    // Verify successful login
    if (currentUrl.includes('dashboard')) {
      console.log('✅ Successfully logged in and redirected to dashboard');
      await expect(page).toHaveURL(/.*dashboard/);
    } else {
      console.log('⚠️ Not redirected to dashboard, checking for user indicators...');
      
      // Check for user menu or logout button as success indicators
      const logoutButton = await page.locator('button:has-text("Logout")').count();
      const userMenu = await page.locator('[aria-label*="user"]').count();
      const userName = await page.locator('text=/cuong/i').count();
      const indicatorCount = logoutButton + userMenu + userName;
      
      if (indicatorCount > 0) {
        console.log('✅ User logged in (found user indicators)');
      } else {
        throw new Error('Login may have failed - no success indicators found');
      }
    }
  });

  test('should handle API endpoint correctly', async ({ page }) => {
    console.log('🔌 Testing API connectivity...');
    
    // Test API endpoint directly
    const apiResponse = await page.request.post(apiUrl + '/api/auth/login', {
      data: {
        email: testUser.email,
        password: testUser.password
      }
    });
    
    expect(apiResponse.status()).toBe(200);
    const responseData = await apiResponse.json();
    console.log('✅ API Response:', {
      success: responseData.success,
      hasToken: !!responseData.data?.token,
      userEmail: responseData.data?.user?.email
    });
    
    expect(responseData.success).toBe(true);
    expect(responseData.data?.token).toBeTruthy();
    expect(responseData.data?.user?.email).toBe(testUser.email);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== 'passed') {
      console.log('📸 Test failed, taking debug screenshot...');
      await page.screenshot({ 
        path: `test-failure-${Date.now()}.png`, 
        fullPage: true 
      });
      
      // Log console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.error('Browser console error:', msg.text());
        }
      });
    }
  });
});

// Configuration override for WSL2 testing
test.use({
  baseURL: 'http://172.26.249.148:3000',
  actionTimeout: 30000,
  navigationTimeout: 30000,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'on-first-retry',
});