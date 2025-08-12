import { test, expect } from '@playwright/test';

/**
 * Debug Login Test - Investigate login flow issues
 * Testing specific user: cuongtranhung@gmail.com
 */

test.describe('🔍 Login Debug Tests', () => {
  const credentials = {
    email: 'cuongtranhung@gmail.com',
    password: '@Abcd6789'
  };

  test('should debug login flow step by step', async ({ page }) => {
    console.log('🔍 Starting debug login test...');
    
    // Enable request/response logging
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log('📤 Request:', request.method(), request.url());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log('📥 Response:', response.status(), response.url());
      }
    });
    
    // Navigate to login page
    console.log('🌐 Navigating to http://localhost:3001/');
    await page.goto('http://localhost:3001/');
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: 'test-results/debug-01-initial-page.png',
      fullPage: true 
    });
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded');
    
    // Check if login form is visible
    const emailField = page.getByLabel('Email address');
    const passwordField = page.getByLabel('Password');
    const submitButton = page.getByRole('button', { name: /sign in/i });
    
    await expect(emailField).toBeVisible();
    await expect(passwordField).toBeVisible();
    await expect(submitButton).toBeVisible();
    console.log('✅ Login form elements are visible');
    
    // Fill form
    console.log('📝 Filling login form...');
    await emailField.fill(credentials.email);
    await passwordField.fill(credentials.password);
    
    // Verify values are filled
    await expect(emailField).toHaveValue(credentials.email);
    await expect(passwordField).toHaveValue(credentials.password);
    console.log('✅ Form filled correctly');
    
    // Take screenshot before submit
    await page.screenshot({ 
      path: 'test-results/debug-02-form-filled.png',
      fullPage: true 
    });
    
    // Submit form and monitor network
    console.log('🚀 Submitting form...');
    
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/auth/login'),
      { timeout: 10000 }
    );
    
    await submitButton.click();
    console.log('🖱️ Submit button clicked');
    
    try {
      const response = await responsePromise;
      console.log('📥 Login response received:', response.status());
      
      const responseBody = await response.text();
      console.log('📄 Response body:', responseBody);
      
      // Parse response
      const data = JSON.parse(responseBody);
      console.log('✅ Login API success:', data.success);
      
      if (data.success) {
        console.log('👤 User:', data.data.user.email);
        console.log('🔐 Token received');
        
        // Wait for redirect
        await page.waitForURL(/dashboard/, { timeout: 10000 });
        console.log('🏠 Redirected to dashboard');
        
        // Take screenshot of dashboard
        await page.screenshot({ 
          path: 'test-results/debug-03-dashboard.png',
          fullPage: true 
        });
        
        // Verify dashboard elements
        await expect(page.locator('h1')).toContainText('Dashboard');
        console.log('✅ Dashboard loaded successfully');
        
      } else {
        console.error('❌ Login failed:', data.message);
        
        // Take screenshot of error
        await page.screenshot({ 
          path: 'test-results/debug-03-error.png',
          fullPage: true 
        });
      }
      
    } catch (error) {
      console.error('❌ Network error:', error.message);
      
      // Take screenshot of current state
      await page.screenshot({ 
        path: 'test-results/debug-03-network-error.png',
        fullPage: true 
      });
      
      // Check current URL
      const currentUrl = page.url();
      console.log('📍 Current URL:', currentUrl);
      
      // Check for error messages on page
      const errorMessages = await page.locator('*:has-text("error"), *:has-text("failed"), *:has-text("invalid")').allTextContents();
      if (errorMessages.length > 0) {
        console.log('⚠️ Error messages on page:', errorMessages);
      }
      
      throw error;
    }
  });

  test('should test form submission without API wait', async ({ page }) => {
    console.log('🔍 Testing form submission behavior...');
    
    await page.goto('http://localhost:3001/');
    await page.waitForLoadState('networkidle');
    
    // Fill form
    await page.getByLabel('Email address').fill(credentials.email);
    await page.getByLabel('Password').fill(credentials.password);
    
    // Submit and immediately check behavior
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait a bit to see what happens
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log('📍 URL after 3 seconds:', currentUrl);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/debug-form-behavior.png',
      fullPage: true 
    });
    
    // Check if still on login page or redirected
    if (currentUrl.includes('dashboard')) {
      console.log('✅ Redirected to dashboard');
    } else {
      console.log('⚠️ Still on login page');
      
      // Look for any error messages
      const pageContent = await page.content();
      if (pageContent.includes('error') || pageContent.includes('failed') || pageContent.includes('invalid')) {
        console.log('❌ Found error indicators on page');
      }
    }
  });

  test('should check CORS and network configuration', async ({ page }) => {
    console.log('🔍 Testing CORS and network configuration...');
    
    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('🚨 Console error:', msg.text());
      }
    });
    
    // Monitor failed requests
    page.on('requestfailed', request => {
      console.error('❌ Request failed:', request.url(), request.failure()?.errorText);
    });
    
    await page.goto('http://localhost:3001/');
    await page.waitForLoadState('networkidle');
    
    // Try a direct API call from browser context
    const apiResponse = await page.evaluate(async () => {
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
          error: null
        };
      } catch (error) {
        return {
          status: 'error',
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('🌐 Direct API call result:', apiResponse);
  });
});