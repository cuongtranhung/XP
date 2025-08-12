const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'cuongtranhung@gmail.com',
  password: '@Abcd6789'
};

test('Create submission and test comment functionality', async ({ page }) => {
  console.log('🔄 Creating submission and testing comments...');
  
  // Login
  await page.goto(BASE_URL);
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  console.log('✅ Login successful');
  
  // Navigate to forms
  await page.click('text=Forms');
  await page.waitForSelector('[data-testid="forms-list"], .forms-container, h1:has-text("Forms")');
  
  // Take screenshot of forms page
  await page.screenshot({ path: 'test-results/submission-01-forms.png', fullPage: true });
  
  // Click on "Danh sách Nhân viên" form to view/edit it
  const employeeForm = page.locator('text=Danh sách Nhân viên');
  if (await employeeForm.isVisible()) {
    await employeeForm.click();
    await page.waitForTimeout(3000); // Wait for form to load
    
    // Take screenshot after clicking form
    await page.screenshot({ path: 'test-results/submission-02-form-page.png', fullPage: true });
    
    // Look for ways to create submissions or view submissions
    const createButtons = [
      'button:has-text("Create")',
      'button:has-text("Add")',
      'button:has-text("New")',
      'button:has-text("Submit")',
      'a:has-text("Submit")',
      'a:has-text("Create")',
      '[data-testid*="create"]',
      '[data-testid*="submit"]'
    ];
    
    let buttonFound = false;
    for (const selector of createButtons) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`🔘 Found button with selector "${selector}":`, count);
        buttonFound = true;
        
        try {
          await page.click(selector);
          await page.waitForTimeout(2000);
          console.log('✅ Clicked button successfully');
          
          // Take screenshot after clicking
          await page.screenshot({ path: 'test-results/submission-03-after-button.png', fullPage: true });
          break;
        } catch (error) {
          console.log('⚠️ Could not click button:', error.message);
        }
      }
    }
    
    if (!buttonFound) {
      console.log('❌ No create/submit buttons found');
    }
    
    // Look for form fields to fill
    const formFields = await page.locator('input[type="text"], input[type="email"], textarea, select').count();
    console.log('📝 Form fields found:', formFields);
    
    if (formFields > 0) {
      console.log('✅ Found form fields, attempting to fill...');
      
      // Fill any text inputs
      const textInputs = page.locator('input[type="text"], input[name*="name"], input[placeholder*="name"]');
      const textInputCount = await textInputs.count();
      
      if (textInputCount > 0) {
        await textInputs.first().fill('Test Employee Name');
        console.log('✅ Filled name field');
      }
      
      // Fill any email inputs
      const emailInputs = page.locator('input[type="email"], input[name*="email"]');
      const emailInputCount = await emailInputs.count();
      
      if (emailInputCount > 0) {
        await emailInputs.first().fill('test.employee@example.com');
        console.log('✅ Filled email field');
      }
      
      // Fill any textareas
      const textareas = page.locator('textarea');
      const textareaCount = await textareas.count();
      
      if (textareaCount > 0) {
        await textareas.first().fill('Test employee description');
        console.log('✅ Filled textarea');
      }
      
      // Take screenshot after filling fields
      await page.screenshot({ path: 'test-results/submission-04-filled-form.png', fullPage: true });
      
      // Look for submit button
      const submitButtons = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Save")');
      const submitCount = await submitButtons.count();
      
      if (submitCount > 0) {
        console.log('✅ Found submit button, submitting form...');
        await submitButtons.first().click();
        await page.waitForTimeout(3000);
        
        // Take screenshot after submission
        await page.screenshot({ path: 'test-results/submission-05-after-submit.png', fullPage: true });
        
        // Now look for comment functionality
        await page.waitForTimeout(2000);
        
        // Look for comment sections
        const commentSelectors = [
          '.comment-section',
          '[data-testid*="comment"]',
          'textarea[placeholder*="comment"]',
          'button:has-text("Comment")',
          'button:has-text("Add Comment")',
          '.add-comment',
          'input[type="file"]'
        ];
        
        for (const selector of commentSelectors) {
          const count = await page.locator(selector).count();
          if (count > 0) {
            console.log(`💬 Found comment element "${selector}":`, count);
          }
        }
        
        // Take final screenshot
        await page.screenshot({ path: 'test-results/submission-06-final.png', fullPage: true });
      }
    }
  }
  
  console.log('🏁 Submission creation test complete');
});