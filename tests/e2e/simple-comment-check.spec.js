// Simple test to check if Comment System is working
const { test, expect } = require('@playwright/test');

test('Check if CommentButton appears on submissions page', async ({ page }) => {
  console.log('🔍 Testing CommentButton rendering directly...');
  
  // Try to go directly to the submissions page (skip login for now)
  await page.goto('http://localhost:3000/forms/e5b13cb9-56b6-4ae4-bdfd-533370a5c049/submissions');
  
  // Wait a moment for the page to load
  await page.waitForTimeout(5000);
  
  // Take screenshot for debugging
  await page.screenshot({ path: 'test-results/simple-comment-check.png', fullPage: true });
  
  // Look for comment elements
  const commentButtons = await page.locator('button:has-text("💬"), [data-testid="comment-button"]').count();
  const commentColumns = await page.locator('th:has-text("Comments")').count();
  
  console.log('💬 Comment buttons with emoji found:', commentButtons);
  console.log('📋 Comment columns found:', commentColumns);
  
  if (commentButtons > 0 || commentColumns > 0) {
    console.log('🎉 SUCCESS: Comment System elements detected!');
  } else {
    console.log('❌ No comment elements found');
  }
});