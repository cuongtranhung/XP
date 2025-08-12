// Test for Form Submissions View and Comment Integration
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'cuongtranhung@gmail.com',
  password: '@Abcd6789'
};

test('should access form submissions view and check for comment integration', async ({ page }) => {
  console.log('🔍 Testing form submissions view and comment integration...');
  
  // Login and navigate to forms
  await page.goto(BASE_URL);
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  
  // Go to forms page
  await page.goto(`${BASE_URL}/forms`);
  await page.waitForTimeout(2000);
  console.log('✅ Navigated to forms page');
  
  // Take screenshot of forms page
  await page.screenshot({ path: 'test-results/form-subs-01-forms-list.png', fullPage: true });
  
  // Click on "Danh sách Nhân viên" form
  const employeeForm = page.locator('text=Danh sách Nhân viên').first();
  if (await employeeForm.count() > 0) {
    await employeeForm.click();
    await page.waitForTimeout(3000);
    console.log('✅ Clicked on "Danh sách Nhân viên" form');
    
    // Take screenshot after clicking
    await page.screenshot({ path: 'test-results/form-subs-02-form-details.png', fullPage: true });
    
    console.log('📍 Current URL after clicking form:', page.url());
    
    // Look for various navigation options that might lead to submissions
    const navigationOptions = [
      'text=Submissions',
      'text=Data',
      'text=Responses', 
      'text=View Submissions',
      'text=Table View',
      'button:has-text("Submissions")',
      'a[href*="submission"]',
      '[data-testid*="submission"]',
      'text=💬', // Comment buttons
      '[data-testid="comment-button"]'
    ];
    
    let foundSubmissionsAccess = false;
    for (const selector of navigationOptions) {
      const element = page.locator(selector).first();
      if (await element.count() > 0) {
        console.log(`✅ Found navigation option: ${selector}`);
        foundSubmissionsAccess = true;
        
        // Try clicking it
        try {
          await element.click();
          await page.waitForTimeout(2000);
          console.log(`✅ Successfully clicked: ${selector}`);
          await page.screenshot({ path: `test-results/form-subs-03-after-${selector.replace(/[^a-zA-Z0-9]/g, '')}.png`, fullPage: true });
          
          // Check if we're now on a submissions/table view
          const hasTable = await page.locator('table, .table').count() > 0;
          const hasSubmissionsView = page.url().includes('submission') || 
                                   await page.locator('text=submissions, text=Submissions').count() > 0;
          
          if (hasTable || hasSubmissionsView) {
            console.log('🎯 Successfully accessed submissions view!');
            
            // Look for comment-related elements
            const commentElements = await page.locator('[data-testid*="comment"], button:has-text("💬"), .comment-button').count();
            console.log('💬 Comment elements found:', commentElements);
            
            // Test creating a dummy submission if there's an option
            const addSubmissionBtn = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
            if (await addSubmissionBtn.count() > 0) {
              console.log('➕ Found "Add/Create/New" button - could create test data');
            }
            
            break;
          }
        } catch (error) {
          console.log(`❌ Error clicking ${selector}:`, error.message);
        }
      }
    }
    
    if (!foundSubmissionsAccess) {
      console.log('❌ No submissions access found');
      
      // Try direct URL navigation to form submissions
      const formId = page.url().split('/').pop();
      if (formId) {
        const submissionUrls = [
          `/forms/${formId}/submissions`,
          `/form-builder/${formId}/submissions`,
          `/forms/${formId}/data`,
          `/submissions?form=${formId}`
        ];
        
        for (const url of submissionUrls) {
          try {
            console.log(`🔗 Trying direct URL: ${url}`);
            await page.goto(`${BASE_URL}${url}`);
            await page.waitForTimeout(2000);
            
            const hasContent = await page.locator('table, .table, [class*="submission"]').count() > 0;
            if (hasContent) {
              console.log(`✅ Found submissions content at: ${url}`);
              await page.screenshot({ path: `test-results/form-subs-04-direct-url.png`, fullPage: true });
              break;
            }
          } catch (error) {
            console.log(`❌ Error accessing ${url}`);
          }
        }
      }
    }
    
  } else {
    console.log('❌ "Danh sách Nhân viên" form not found');
  }
  
  console.log('🏁 Form submissions test completed');
});