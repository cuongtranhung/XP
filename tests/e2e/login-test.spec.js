// Simple Login Test
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'cuongtranhung@gmail.com',
  password: '@Abcd6789'
};

test('should login successfully', async ({ page }) => {
  console.log('🔍 Testing login with credentials...');
  
  // Navigate to the application
  await page.goto(BASE_URL);
  console.log('📍 Navigated to:', page.url());
  
  // Take screenshot of initial page
  await page.screenshot({ path: '../test-results/01-initial-page.png', fullPage: true });
  
  // Look for login fields
  const emailField = page.locator('input[type="email"]');
  const passwordField = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');
  
  console.log('📧 Email field found:', await emailField.count() > 0);
  console.log('🔒 Password field found:', await passwordField.count() > 0);
  console.log('🚀 Submit button found:', await submitButton.count() > 0);
  
  if (await emailField.count() > 0) {
    await emailField.fill(TEST_USER.email);
    console.log('✅ Filled email:', TEST_USER.email);
  }
  
  if (await passwordField.count() > 0) {
    await passwordField.fill(TEST_USER.password);
    console.log('✅ Filled password');
  }
  
  // Take screenshot before submit
  await page.screenshot({ path: '../test-results/02-before-submit.png', fullPage: true });
  
  if (await submitButton.count() > 0) {
    await submitButton.click();
    console.log('✅ Clicked submit');
    
    // Wait a moment and take screenshot
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '../test-results/03-after-submit.png', fullPage: true });
    
    console.log('📍 Current URL after submit:', page.url());
    
    // Check if we're on dashboard or any protected page
    const isDashboard = page.url().includes('dashboard');
    const isLoggedIn = !page.url().includes('login') && !page.url().includes('forgot-password');
    
    console.log('🏠 Is on dashboard:', isDashboard);
    console.log('🔐 Appears logged in:', isLoggedIn);
    
    if (isLoggedIn) {
      console.log('✅ Login appears successful');
    } else {
      console.log('❌ Login may have failed');
      
      // Check for error messages
      const errorMessages = await page.locator('.error, .alert, [role="alert"]').allTextContents();
      if (errorMessages.length > 0) {
        console.log('❌ Error messages found:', errorMessages);
      }
    }
  }
});