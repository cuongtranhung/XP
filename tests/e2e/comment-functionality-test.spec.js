const { test, expect } = require('@playwright/test');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
  email: 'cuongtranhung@gmail.com',
  password: '@Abcd6789'
};

test.describe('Comment Upload Functionality Tests', () => {
  const testFile = path.join(__dirname, '..', '..', 'test-images', 'toast-test-file.txt');
  
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(BASE_URL);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    console.log('✅ Login successful');
  });

  test('Test 1: Image Display Fix - Check for 401 Errors', async ({ page }) => {
    console.log('🔍 Testing image display fix...');
    
    // Listen for network errors
    const networkErrors = [];
    page.on('response', response => {
      if (response.status() === 401 && response.url().includes('comment-attachments')) {
        networkErrors.push({
          url: response.url(),
          status: response.status()
        });
      }
    });
    
    // Navigate to forms
    await page.click('text=Forms');
    await page.waitForSelector('[data-testid="forms-list"], .forms-container, h1:has-text("Forms")');
    
    // Take screenshot of forms page
    await page.screenshot({ path: 'test-results/test1-forms-page.png', fullPage: true });
    
    // Click on "Danh sách Nhân viên" form
    const employeeForm = page.locator('text=Danh sách Nhân viên');
    if (await employeeForm.isVisible()) {
      await employeeForm.click();
      await page.waitForTimeout(2000);
      
      // Take screenshot of form detail page
      await page.screenshot({ path: 'test-results/test1-form-detail.png', fullPage: true });
      
      // Look for comment images
      const commentImages = await page.locator('img[src*="comment-attachments"]').count();
      console.log('🖼️ Comment images found:', commentImages);
      
      // Check for 401 errors
      await page.waitForTimeout(3000); // Wait for any image loading
      console.log('📊 Network 401 errors on comment images:', networkErrors.length);
      
      // Assert no 401 errors
      expect(networkErrors.length).toBe(0);
      
      // Take final screenshot
      await page.screenshot({ path: 'test-results/test1-final.png', fullPage: true });
    } else {
      console.log('⚠️ Employee form not found');
      await page.screenshot({ path: 'test-results/test1-no-form.png', fullPage: true });
    }
  });

  test('Test 2: Toast Notification Testing', async ({ page }) => {
    console.log('🍞 Testing toast notifications...');
    
    // Navigate to forms
    await page.click('text=Forms');
    await page.waitForSelector('[data-testid="forms-list"], .forms-container, h1:has-text("Forms")');
    
    // Click on "Danh sách Nhân viên" form
    const employeeForm = page.locator('text=Danh sách Nhân viên');
    if (await employeeForm.isVisible()) {
      await employeeForm.click();
      await page.waitForTimeout(2000);
      
      // Take screenshot of form page
      await page.screenshot({ path: 'test-results/test2-form-page.png', fullPage: true });
      
      // Look for file input or upload button
      const fileInput = page.locator('input[type="file"]');
      const uploadButton = page.locator('button:has-text("Upload"), button:has-text("Add File"), [data-testid*="upload"]');
      
      const fileInputCount = await fileInput.count();
      const uploadButtonCount = await uploadButton.count();
      
      console.log('📁 File inputs found:', fileInputCount);
      console.log('⬆️ Upload buttons found:', uploadButtonCount);
      
      if (fileInputCount > 0) {
        console.log('✅ Found file input, testing upload...');
        
        // Upload the test file
        await fileInput.first().setInputFiles(testFile);
        
        // Wait for potential toast notification
        await page.waitForTimeout(2000);
        
        // Look for toast notifications
        const toastSelectors = [
          '.toast',
          '[data-testid="toast"]',
          '.notification',
          '.upload-progress',
          '.progress-toast',
          '[class*="toast"]',
          '[class*="notification"]'
        ];
        
        let toastFound = false;
        for (const selector of toastSelectors) {
          const toastCount = await page.locator(selector).count();
          if (toastCount > 0) {
            console.log(`🍞 Toast found with selector "${selector}":`, toastCount);
            toastFound = true;
            break;
          }
        }
        
        if (!toastFound) {
          console.log('⚠️ No toast notifications found');
        }
        
        // Take screenshot after upload attempt
        await page.screenshot({ path: 'test-results/test2-after-upload.png', fullPage: true });
        
      } else if (uploadButtonCount > 0) {
        console.log('✅ Found upload button, clicking...');
        await uploadButton.first().click();
        await page.waitForTimeout(1000);
        
        // Look for file input that appeared after clicking
        const newFileInput = page.locator('input[type="file"]');
        if (await newFileInput.isVisible()) {
          await newFileInput.setInputFiles(testFile);
          await page.waitForTimeout(2000);
        }
        
        await page.screenshot({ path: 'test-results/test2-upload-button-clicked.png', fullPage: true });
      } else {
        console.log('❌ No file upload functionality found');
        await page.screenshot({ path: 'test-results/test2-no-upload.png', fullPage: true });
      }
    }
  });

  test('Test 3: End-to-End Comment Creation', async ({ page }) => {
    console.log('🔄 Testing end-to-end comment creation...');
    
    // Navigate to forms
    await page.click('text=Forms');
    await page.waitForSelector('[data-testid="forms-list"], .forms-container, h1:has-text("Forms")');
    
    // Click on "Danh sách Nhân viên" form
    const employeeForm = page.locator('text=Danh sách Nhân viên');
    if (await employeeForm.isVisible()) {
      await employeeForm.click();
      await page.waitForTimeout(2000);
      
      // Take screenshot of form page
      await page.screenshot({ path: 'test-results/test3-form-page.png', fullPage: true });
      
      // Look for comment form or comment button
      const commentSelectors = [
        'textarea[placeholder*="comment"]',
        'input[placeholder*="comment"]',
        'button:has-text("Add Comment")',
        'button:has-text("Comment")',
        '[data-testid*="comment"]',
        '.comment-form',
        '.add-comment'
      ];
      
      let commentFormFound = false;
      for (const selector of commentSelectors) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          console.log(`💬 Comment element found with selector "${selector}":`, count);
          commentFormFound = true;
          
          // Try to interact with it
          try {
            if (selector.includes('textarea') || selector.includes('input')) {
              await page.fill(selector, 'Test comment with file attachment');
            } else if (selector.includes('button')) {
              await page.click(selector);
              await page.waitForTimeout(1000);
            }
          } catch (error) {
            console.log('⚠️ Could not interact with comment element:', error.message);
          }
          
          break;
        }
      }
      
      if (!commentFormFound) {
        console.log('❌ No comment functionality found');
      }
      
      // Take final screenshot
      await page.screenshot({ path: 'test-results/test3-final.png', fullPage: true });
    }
  });
});