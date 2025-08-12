const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'cuongtranhung@gmail.com',
  password: '@Abcd6789'
};

test('Find and test actual form submissions with comments', async ({ page }) => {
  console.log('🔍 Finding form submissions with comment functionality...');
  
  // Login
  await page.goto(BASE_URL);
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  console.log('✅ Login successful');
  
  // Take screenshot of dashboard
  await page.screenshot({ path: 'test-results/find-01-dashboard.png', fullPage: true });
  
  // Look for different navigation options
  const navOptions = [
    'text=Submissions',
    'text=Form Submissions', 
    'text=Data',
    'text=Table View',
    'text=View Submissions',
    'a[href*="submission"]',
    'button:has-text("View")',
    'button:has-text("Data")'
  ];
  
  let foundSubmissions = false;
  
  for (const selector of navOptions) {
    const count = await page.locator(selector).count();
    if (count > 0) {
      console.log(`📋 Found navigation option "${selector}":`, count);
      try {
        await page.click(selector);
        await page.waitForTimeout(3000);
        
        // Take screenshot after navigation
        await page.screenshot({ path: `test-results/find-02-nav-${selector.replace(/[^a-z0-9]/gi, '-')}.png`, fullPage: true });
        
        // Look for actual submission data
        const submissionElements = await page.locator('table tr, .submission-item, .data-row, [data-testid*="submission"]').count();
        console.log('📊 Submission elements found:', submissionElements);
        
        if (submissionElements > 2) { // More than just headers
          foundSubmissions = true;
          console.log('✅ Found submissions!');
          
          // Click on a submission if possible
          const clickableSubmission = page.locator('table tr:not(:first-child) td:first-child, .submission-item:first-child, .data-row:first-child').first();
          
          if (await clickableSubmission.isVisible()) {
            await clickableSubmission.click();
            await page.waitForTimeout(2000);
            
            // Take screenshot of submission detail
            await page.screenshot({ path: 'test-results/find-03-submission-detail.png', fullPage: true });
            
            // Now look for comment functionality
            await page.waitForTimeout(1000);
            
            const commentElements = [
              'input[type="file"]',
              'textarea[placeholder*="comment"]',
              'button:has-text("Comment")',
              'button:has-text("Add Comment")',
              '.comment-section',
              '[data-testid*="comment"]',
              '.toast',
              '.notification'
            ];
            
            for (const commentSelector of commentElements) {
              const commentCount = await page.locator(commentSelector).count();
              if (commentCount > 0) {
                console.log(`💬 Found comment element "${commentSelector}":`, commentCount);
              }
            }
            
            // Test file upload if available
            const fileInput = page.locator('input[type="file"]');
            if (await fileInput.isVisible()) {
              console.log('📁 Found file input! Testing upload...');
              
              // Create a simple test file
              const testFile = '/mnt/c/Users/Admin/source/repos/XP/test-images/toast-test-file.txt';
              
              try {
                await fileInput.setInputFiles(testFile);
                console.log('✅ File uploaded successfully');
                
                // Wait and look for toast notifications
                await page.waitForTimeout(3000);
                
                const toastElements = await page.locator('.toast, .notification, [data-testid="toast"], .upload-progress').count();
                console.log('🍞 Toast notifications found:', toastElements);
                
                // Take screenshot after upload
                await page.screenshot({ path: 'test-results/find-04-after-upload.png', fullPage: true });
                
              } catch (error) {
                console.log('⚠️ Upload failed:', error.message);
              }
            }
            
            // Take final screenshot
            await page.screenshot({ path: 'test-results/find-05-final.png', fullPage: true });
          }
        }
        break;
      } catch (error) {
        console.log(`⚠️ Could not navigate with "${selector}":`, error.message);
      }
    }
  }
  
  if (!foundSubmissions) {
    console.log('❌ No submissions found through navigation');
    
    // Try direct URL approach
    const potentialURLs = [
      '/submissions',
      '/form-submissions', 
      '/data',
      '/forms/submissions',
      '/dashboard/submissions'
    ];
    
    for (const url of potentialURLs) {
      try {
        await page.goto(BASE_URL + url);
        await page.waitForTimeout(2000);
        
        const elements = await page.locator('table, .submission, .data').count();
        if (elements > 0) {
          console.log(`✅ Found submissions at URL: ${url}`);
          await page.screenshot({ path: `test-results/find-url-${url.replace(/\//g, '-')}.png`, fullPage: true });
          break;
        }
      } catch (error) {
        console.log(`⚠️ URL ${url} not accessible`);
      }
    }
  }
  
  console.log('🏁 Submission finding test complete');
});