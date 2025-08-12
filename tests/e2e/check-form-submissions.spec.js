// Check basic form submissions page loading
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'cuongtranhung@gmail.com',
  password: '@Abcd6789'
};

test('Check Form Submissions Page Elements', async ({ page }) => {
  console.log('🔍 Checking Form Submissions page elements...');
  
  // Login
  await page.goto(BASE_URL);
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  console.log('✅ Login successful');
  
  // Navigate to specific form
  const formId = 'e5b13cb9-56b6-4ae4-bdfd-533370a5c049';
  await page.goto(`${BASE_URL}/forms/${formId}/submissions`);
  await page.waitForTimeout(5000); // Wait longer for data to load
  
  // Take full screenshot
  await page.screenshot({ path: 'test-results/form-submissions-check.png', fullPage: true });
  console.log('📸 Form submissions screenshot saved');
  
  // Check for table
  const table = await page.locator('table').count();
  console.log('📊 Tables found:', table);
  
  // Check for rows
  const rows = await page.locator('tbody tr').count();
  console.log('📋 Data rows found:', rows);
  
  // Check for Comments header
  const commentsHeader = await page.locator('th:has-text("COMMENTS"), th:has-text("Comments")').count();
  console.log('💬 Comments column header:', commentsHeader);
  
  // Check for any buttons with comment-related content
  const commentButtons1 = await page.locator('[data-testid="comment-button"]').count();
  const commentButtons2 = await page.locator('button:has-text("💬")').count();
  const commentButtons3 = await page.locator('button:has-text("0")').count();
  const commentButtons4 = await page.locator('text=💬').count();
  
  console.log('🔍 Button search results:');
  console.log('   - [data-testid="comment-button"]:', commentButtons1);
  console.log('   - button:has-text("💬"):', commentButtons2);
  console.log('   - button:has-text("0"):', commentButtons3);
  console.log('   - text=💬 (any element):', commentButtons4);
  
  // Check page title
  const title = await page.title();
  console.log('📄 Page title:', title);
  
  // Check URL
  const url = page.url();
  console.log('🌐 Current URL:', url);
  
  console.log('🏁 Form submissions check complete');
});