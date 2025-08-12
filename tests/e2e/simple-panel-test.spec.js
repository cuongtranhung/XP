// Simple test to debug CommentPanel opening
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'cuongtranhung@gmail.com',
  password: '@Abcd6789'
};

test('Debug CommentPanel opening', async ({ page }) => {
  console.log('🔍 Testing CommentPanel opening...');
  
  // Login
  await page.goto(BASE_URL);
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  
  // Navigate to submissions
  const formId = 'e5b13cb9-56b6-4ae4-bdfd-533370a5c049';
  await page.goto(`${BASE_URL}/forms/${formId}/submissions`);
  await page.waitForTimeout(3000);
  
  console.log('✅ Navigated to submissions page');
  
  // Check for buttons
  const buttons = await page.locator('[data-testid="comment-button"]').count();
  console.log('💬 Found', buttons, 'comment buttons with data-testid');
  
  if (buttons > 0) {
    // Click first button
    console.log('🖱️ Clicking first comment button...');
    await page.locator('[data-testid="comment-button"]').first().click();
    
    // Wait and check for panel
    await page.waitForTimeout(2000);
    
    // Check if panel exists
    const panel = await page.locator('[data-testid="comment-panel"]').count();
    console.log('📱 Panel with data-testid found:', panel);
    
    // Check for any modal or dialog
    const dialog = await page.locator('[role="dialog"]').count();
    console.log('🗨️ Dialog elements found:', dialog);
    
    // Check for text content
    const commentText = await page.locator('text=Comments for Submission').count();
    console.log('📝 Comment text found:', commentText);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/debug-panel.png', fullPage: true });
    console.log('📸 Debug screenshot saved');
    
    // Check console errors
    page.on('console', msg => console.log('BROWSER:', msg.text()));
  }
});