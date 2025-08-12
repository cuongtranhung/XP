const { test, expect } = require('@playwright/test');

// Simple manual test to check current state
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'cuongtranhung@gmail.com',
  password: '@Abcd6789'
};

test('Manual inspection of comment upload functionality', async ({ page }) => {
  console.log('🔍 Starting manual inspection...');
  
  // Step 1: Login
  await page.goto(BASE_URL);
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  console.log('✅ Login successful');
  
  // Take screenshot of dashboard
  await page.screenshot({ path: 'test-results/manual-01-dashboard.png', fullPage: true });
  
  // Step 2: Navigate to Forms
  await page.click('text=Forms');
  await page.waitForTimeout(2000);
  console.log('✅ Navigated to Forms');
  
  // Take screenshot of forms page
  await page.screenshot({ path: 'test-results/manual-02-forms-page.png', fullPage: true });
  
  // Step 3: Look for any existing comments or upload functionality
  const commentButtons = await page.locator('button[class*="comment"], .comment-button, [data-testid*="comment"]').count();
  console.log('💬 Comment buttons found:', commentButtons);
  
  const fileInputs = await page.locator('input[type="file"]').count();
  console.log('📁 File inputs found:', fileInputs);
  
  const toastContainers = await page.locator('.toast, .notification, [data-testid="toast"]').count();
  console.log('🍞 Toast containers found:', toastContainers);
  
  // Step 4: Check for any comment attachments or images
  const commentImages = await page.locator('img[src*="comment-attachments"], img[src*="uploads"]').count();
  console.log('🖼️ Comment images found:', commentImages);
  
  // Step 5: Look for form submissions to interact with
  const submissionElements = await page.locator('.submission, .card, [data-testid*="submission"]').count();
  console.log('📋 Submission elements found:', submissionElements);
  
  // Take final screenshot
  await page.screenshot({ path: 'test-results/manual-03-final-analysis.png', fullPage: true });
  
  console.log('🏁 Manual inspection complete. Check screenshots for visual analysis.');
});