// Navigation Test for Comment System
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'cuongtranhung@gmail.com',
  password: '@Abcd6789'
};

test('should navigate to forms and find submissions', async ({ page }) => {
  console.log('🔍 Testing navigation to forms and submissions...');
  
  // Login first
  await page.goto(BASE_URL);
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  console.log('✅ Login successful');
  
  // Take screenshot of dashboard
  await page.screenshot({ path: 'test-results/navigation-01-dashboard.png', fullPage: true });
  
  // Try clicking the Forms button in navigation
  const formsButton = page.locator('button:has-text("Forms"), a:has-text("Forms")').first();
  if (await formsButton.count() > 0) {
    await formsButton.click();
    await page.waitForTimeout(2000);
    console.log('✅ Clicked Forms button');
    await page.screenshot({ path: 'test-results/navigation-02-forms-page.png', fullPage: true });
  } else {
    console.log('❌ Forms button not found in navigation');
  }
  
  // Try accessing Form Builder section
  const formBuilderSection = page.locator('text=Form Builder');
  if (await formBuilderSection.count() > 0) {
    await formBuilderSection.click();
    await page.waitForTimeout(2000);
    console.log('✅ Clicked Form Builder section');
    await page.screenshot({ path: 'test-results/navigation-03-form-builder.png', fullPage: true });
  }
  
  // Look for any forms on the page
  const formElements = await page.locator('[class*="form"], [class*="Form"], [data-testid*="form"]').count();
  console.log('📋 Form elements found:', formElements);
  
  // Look for "Danh sách nhân viên" specifically
  const employeeListForm = page.locator('text=Danh sách nhân viên');
  if (await employeeListForm.count() > 0) {
    console.log('✅ Found "Danh sách nhân viên" form');
    await employeeListForm.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/navigation-04-employee-form.png', fullPage: true });
    
    // Look for table or submissions
    const hasTable = await page.locator('table').count() > 0;
    const hasSubmissions = await page.locator('text=submissions, text=Submissions').count() > 0;
    console.log('📊 Has table:', hasTable);
    console.log('📝 Has submissions text:', hasSubmissions);
    
  } else {
    console.log('❌ "Danh sách nhân viên" form not found');
  }
  
  // Try direct navigation to form-related URLs
  const testUrls = [
    '/forms',
    '/form-builder', 
    '/submissions',
    '/forms/submissions',
    '/dashboard/forms'
  ];
  
  for (const url of testUrls) {
    try {
      console.log(`🔗 Trying URL: ${url}`);
      await page.goto(`${BASE_URL}${url}`);
      await page.waitForTimeout(1000);
      
      const pageTitle = await page.title();
      const currentUrl = page.url();
      console.log(`  📄 Title: "${pageTitle}"`);
      console.log(`  📍 Current URL: "${currentUrl}"`);
      
      // Check if page has any forms or form-related content
      const hasFormContent = await page.locator('[class*="form"], [class*="Form"], table, [class*="table"]').count() > 0;
      if (hasFormContent) {
        console.log(`  ✅ Found form-related content at ${url}`);
        await page.screenshot({ path: `test-results/navigation-url-${url.replace(/\//g, '-')}.png`, fullPage: true });
        
        // Look for employee list form specifically
        if (await page.locator('text=Danh sách nhân viên').count() > 0) {
          console.log(`  🎯 "Danh sách nhân viên" found at ${url}!`);
          break;
        }
      }
    } catch (error) {
      console.log(`  ❌ Error accessing ${url}:`, error.message);
    }
  }
  
  console.log('🏁 Navigation test completed');
});