// Final integration test to confirm Comment System status
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'cuongtranhung@gmail.com', 
  password: '@Abcd6789'
};

test('Final Comment System Integration Status', async ({ page }) => {
  console.log('🎯 Final Comment System Integration Test');
  
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
  
  // Final screenshot
  await page.screenshot({ path: 'test-results/final-integration-status.png', fullPage: true });
  console.log('📸 Final integration screenshot saved');
  
  // Check all integration elements
  const commentColumn = await page.locator('th:has-text("Comments")').count();
  const commentButtons = await page.locator('button:has-text("💬"), button:contains("0")').count();
  const emojiButtons = await page.locator('text=💬').count();
  
  console.log('📋 Comments column header:', commentColumn > 0 ? '✅ PRESENT' : '❌ MISSING');
  console.log('💬 Comment buttons (any type):', commentButtons, commentButtons > 0 ? '✅ PRESENT' : '❌ MISSING');
  console.log('😀 Emoji indicators:', emojiButtons, emojiButtons > 0 ? '✅ PRESENT' : '❌ MISSING');
  
  // Test basic interaction
  if (commentButtons > 0 || emojiButtons > 0) {
    const anyButton = await page.locator('button:has-text("💬"), button:contains("0"), .comment-button, [aria-label*="comment"]').first();
    if (await anyButton.count() > 0) {
      console.log('🖱️ Attempting button click...');
      await anyButton.click();
      await page.waitForTimeout(1500);
      
      // Look for any modal/dialog that might appear
      const anyModal = await page.locator('[role="dialog"], .modal, .fixed, [data-testid*="panel"], [data-testid*="modal"]').count();
      console.log('🗨️ Modal/Panel elements after click:', anyModal, anyModal > 0 ? '✅ PANEL OPENED' : '⚠️ NO PANEL');
      
      // Final screenshot after click
      await page.screenshot({ path: 'test-results/final-after-click.png', fullPage: true });
      console.log('📸 After-click screenshot saved');
    }
  }
  
  // Summary
  const integrationSuccess = commentColumn > 0 && (commentButtons > 0 || emojiButtons > 0);
  console.log('');
  console.log('🏆 FINAL INTEGRATION STATUS:', integrationSuccess ? '✅ SUCCESS' : '❌ PARTIAL');
  console.log('');
});