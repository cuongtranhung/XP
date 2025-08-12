import { test, expect } from '@playwright/test';

// Simple login test for user: cuongtranhung@gmail.com
test('should login with specific user credentials', async ({ page }) => {
  const credentials = {
    email: 'cuongtranhung@gmail.com',
    password: '@Abcd6789'
  };

  console.log('🧪 Testing login for:', credentials.email);
  
  // Navigate to login page
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Verify login page
  await expect(page.locator('h2')).toContainText('Welcome Back');
  
  // Fill login form
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  
  // Take screenshot before submission
  await page.screenshot({ 
    path: 'test-results/simple-login-before-submit.png',
    fullPage: true 
  });
  
  // Submit form
  await page.getByRole('button', { name: /sign in/i }).click();
  
  // Wait and see what happens (reduced timeout)
  await page.waitForTimeout(5000);
  
  const currentUrl = page.url();
  console.log('📍 Current URL after 5 seconds:', currentUrl);
  
  // Take screenshot of result
  await page.screenshot({ 
    path: 'test-results/simple-login-result.png',
    fullPage: true 
  });
  
  // Check if redirected to dashboard or still on login page
  if (currentUrl.includes('dashboard')) {
    console.log('✅ Successfully redirected to dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  } else {
    console.log('⚠️ Still on login page - checking for errors');
    
    // Look for error messages
    const errorElements = await page.locator('*:has-text("error"), *:has-text("failed"), *:has-text("invalid")').all();
    if (errorElements.length > 0) {
      for (const element of errorElements) {
        const text = await element.textContent();
        console.log('❌ Found error:', text);
      }
    }
  }
});

test('should verify API is working with direct call', async ({ page }) => {
  // Test direct API call from browser context
  const apiResult = await page.evaluate(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'cuongtranhung@gmail.com',
          password: '@Abcd6789'
        })
      });
      
      const data = await response.json();
      return {
        status: response.status,
        success: data.success,
        hasToken: !!data.data?.token,
        userEmail: data.data?.user?.email,
        error: null
      };
    } catch (error) {
      return {
        status: 'error',
        success: false,
        hasToken: false,
        userEmail: null,
        error: error.message
      };
    }
  });
  
  console.log('🌐 Direct API call result:', apiResult);
  
  // Verify API is working
  expect(apiResult.status).toBe(200);
  expect(apiResult.success).toBe(true);
  expect(apiResult.hasToken).toBe(true);
  expect(apiResult.userEmail).toBe('cuongtranhung@gmail.com');
  
  console.log('✅ API verification successful');
});

test('should check CORS and network issues', async ({ page }) => {
  // Monitor console errors
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.error('🚨 Console error:', msg.text());
    }
  });
  
  // Monitor failed requests
  const failedRequests: string[] = [];
  page.on('requestfailed', request => {
    failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`);
    console.error('❌ Request failed:', request.url(), request.failure()?.errorText);
  });
  
  // Navigate to login page
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Try login
  await page.getByLabel('Email address').fill('cuongtranhung@gmail.com');
  await page.getByLabel('Password').fill('@Abcd6789');
  await page.getByRole('button', { name: /sign in/i }).click();
  
  // Wait for any network activity
  await page.waitForTimeout(3000);
  
  // Report findings
  console.log('📊 Console errors found:', consoleErrors.length);
  console.log('📊 Failed requests found:', failedRequests.length);
  
  if (consoleErrors.length > 0) {
    console.log('🚨 Console errors:', consoleErrors);
  }
  
  if (failedRequests.length > 0) {
    console.log('❌ Failed requests:', failedRequests);
  }
  
  // Take screenshot of final state
  await page.screenshot({ 
    path: 'test-results/network-check-result.png',
    fullPage: true 
  });
});