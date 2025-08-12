// Check for JavaScript/React errors that might block rendering
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'cuongtranhung@gmail.com',
  password: '@Abcd6789'
};

test('Check Console Errors That Block Rendering', async ({ page }) => {
  console.log('🔍 Checking for console errors...');
  
  const errors = [];
  const warnings = [];
  const logs = [];
  
  // Capture all console messages
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    
    if (type === 'error') {
      errors.push(text);
      console.log('❌ CONSOLE ERROR:', text);
    } else if (type === 'warning') {
      warnings.push(text);
      console.log('⚠️ CONSOLE WARNING:', text);
    } else {
      logs.push(text);
      if (text.includes('CommentButton') || text.includes('CommentPanel') || text.includes('🔍') || text.includes('TestModal')) {
        console.log('🔍 RELEVANT LOG:', text);
      }
    }
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log('💥 PAGE ERROR:', error.message);
    errors.push(`PAGE ERROR: ${error.message}`);
  });
  
  // Login
  await page.goto(BASE_URL);
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  console.log('✅ Login successful');
  
  // Navigate to submissions
  const formId = 'e5b13cb9-56b6-4ae4-bdfd-533370a5c049';
  await page.goto(`${BASE_URL}/forms/${formId}/submissions`);
  await page.waitForTimeout(5000);
  console.log('✅ Navigation complete');
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/console-error-debug.png', fullPage: true });
  
  // Summary
  console.log('📊 ERROR SUMMARY:');
  console.log('   - Errors:', errors.length);
  console.log('   - Warnings:', warnings.length);
  console.log('   - Logs:', logs.length);
  
  if (errors.length > 0) {
    console.log('🚨 ERRORS FOUND:');
    errors.forEach((error, i) => console.log(`   ${i+1}. ${error}`));
  }
  
  if (warnings.length > 0) {
    console.log('⚠️ WARNINGS FOUND:');
    warnings.forEach((warning, i) => console.log(`   ${i+1}. ${warning}`));
  }
  
  console.log('🏁 Console error check complete');
});