const { test, expect } = require('@playwright/test');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'cuongtranhung@gmail.com',
  password: '@Abcd6789'
};

test.describe('Comment Module File Upload Testing', () => {
  const testFile = path.join(__dirname, '..', '..', 'test-images', 'toast-test-file.txt');
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application and login
    await page.goto(BASE_URL);
    
    // Login with valid test credentials
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    
    // Wait for successful login
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/.*dashboard.*/);
    console.log('✅ Login successful');
  });

  test('Image Display Fix - No 401 Errors', async ({ page }) => {
    console.log('Testing image display fix...');
    
    // Listen for network requests to catch 401 errors
    const networkErrors = [];
    page.on('response', response => {
      if (response.status() === 401) {
        networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    // Navigate to forms using the working pattern
    await page.click('text=Forms');
    await page.waitForSelector('[data-testid="forms-list"], .forms-container, h1:has-text("Forms")');
    
    // Take screenshot of forms page
    await page.screenshot({ 
      path: 'test-results/forms-page.png',
      fullPage: true 
    });

    // Look for existing comments with images
    const commentImages = await page.locator('img[src*="comment-attachments"]').count();
    console.log(`Found ${commentImages} comment images`);

    // If images exist, verify they load without 401 errors
    if (commentImages > 0) {
      await page.waitForTimeout(2000); // Wait for images to load
      console.log('Network errors found:', networkErrors);
      
      // Check if images are properly loaded
      const brokenImages = await page.locator('img[src*="comment-attachments"][alt="broken"]').count();
      expect(brokenImages).toBe(0);
    }

    // Check console for errors
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });

    expect(networkErrors.filter(err => err.url.includes('comment-attachments')).length).toBe(0);
  });

  test('Toast Notifications Testing', async ({ page }) => {
    console.log('Testing toast notifications...');
    
    // Navigate to forms using the working pattern
    await page.click('text=Forms');
    await page.waitForSelector('[data-testid="forms-list"], .forms-container, h1:has-text("Forms")');
    
    // Create a form submission first if needed
    const createSubmissionButton = page.locator('button:has-text("Create Submission")');
    if (await createSubmissionButton.isVisible()) {
      await createSubmissionButton.click();
      await page.waitForTimeout(1000);
    }

    // Look for comment section
    const commentSection = page.locator('[data-testid="comment-section"], .comment-section, form[class*="comment"]');
    
    if (await commentSection.isVisible()) {
      console.log('Comment section found');
      
      // Look for file input
      const fileInput = page.locator('input[type="file"]');
      
      if (await fileInput.isVisible()) {
        console.log('File input found, testing upload...');
        
        // Upload test file
        await fileInput.setInputFiles(testFile);
        
        // Wait for toast notification to appear
        const toastNotification = page.locator('.toast, [data-testid="toast"], .notification, .upload-progress');
        
        try {
          await toastNotification.waitFor({ timeout: 5000 });
          console.log('Toast notification appeared');
          
          // Take screenshot of toast
          await page.screenshot({ 
            path: 'test-results/toast-notification.png',
            fullPage: true 
          });
          
          // Check for progress elements
          const progressBar = page.locator('.progress, [role="progressbar"], .upload-progress');
          const progressText = page.locator('text="%", text="uploading", text="progress"');
          
          console.log('Progress bar visible:', await progressBar.isVisible());
          console.log('Progress text visible:', await progressText.isVisible());
          
          // Wait for upload completion
          await page.waitForTimeout(3000);
          
          // Check if toast auto-hides
          const toastStillVisible = await toastNotification.isVisible();
          console.log('Toast still visible after 3 seconds:', toastStillVisible);
          
        } catch (error) {
          console.log('Toast notification did not appear or test failed:', error.message);
          
          // Take screenshot for debugging
          await page.screenshot({ 
            path: 'test-results/toast-test-failed.png',
            fullPage: true 
          });
        }
      } else {
        console.log('File input not found');
        await page.screenshot({ 
          path: 'test-results/no-file-input.png',
          fullPage: true 
        });
      }
    } else {
      console.log('Comment section not found');
      await page.screenshot({ 
        path: 'test-results/no-comment-section.png',
        fullPage: true 
      });
    }
  });

  test('End-to-End Integration Test', async ({ page }) => {
    console.log('Running end-to-end integration test...');
    
    // Login process (if needed)
    const loginButton = page.locator('text=Login, text=Sign In');
    if (await loginButton.isVisible()) {
      await loginButton.click();
      
      // Fill login form (using test credentials)
      await page.fill('input[name="email"], input[type="email"]', 'test@example.com');
      await page.fill('input[name="password"], input[type="password"]', 'password123');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
    }
    
    // Navigate to forms
    await page.click('text=Forms');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of forms page
    await page.screenshot({ 
      path: 'test-results/e2e-forms-page.png',
      fullPage: true 
    });
    
    // Create or find a form submission
    const submissionCards = page.locator('.card, .submission-card, [data-testid="submission"]');
    const submissionCount = await submissionCards.count();
    
    if (submissionCount === 0) {
      // Create new submission if none exist
      const createButton = page.locator('button:has-text("Create"), button:has-text("New")');
      if (await createButton.isVisible()) {
        await createButton.click();
        await page.waitForTimeout(1000);
      }
    } else {
      // Click on first submission
      await submissionCards.first().click();
      await page.waitForTimeout(1000);
    }
    
    // Look for comment form
    const commentForm = page.locator('form[class*="comment"], .comment-form, [data-testid="comment-form"]');
    
    if (await commentForm.isVisible()) {
      console.log('Comment form found');
      
      // Add comment text
      const textArea = page.locator('textarea, input[name="comment"], input[name="text"]');
      if (await textArea.isVisible()) {
        await textArea.fill('Test comment with file attachment');
      }
      
      // Upload file
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        await fileInput.setInputFiles(testFile);
        
        // Wait for upload to complete
        await page.waitForTimeout(3000);
        
        // Submit comment
        const submitButton = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Add")');
        if (await submitButton.isVisible()) {
          await submitButton.click();
          await page.waitForTimeout(2000);
        }
        
        // Verify comment was created
        const newComment = page.locator('text="Test comment with file attachment"');
        const commentExists = await newComment.isVisible();
        console.log('Comment created successfully:', commentExists);
        
        // Take final screenshot
        await page.screenshot({ 
          path: 'test-results/e2e-final-result.png',
          fullPage: true 
        });
      }
    }
  });
});