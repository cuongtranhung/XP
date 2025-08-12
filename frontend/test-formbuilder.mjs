import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.log(`[Page Error]`, error.message);
  });

  try {
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    
    console.log('2. Logging in...');
    await page.fill('input[name="email"]', 'cuongtranhung@gmail.com');
    await page.fill('input[name="password"]', '@Abcd6789');
    await page.click('button[type="submit"]');
    
    console.log('3. Waiting for dashboard and navigating to forms...');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    console.log('3.1. Navigating to forms page...');
    await page.goto('http://localhost:3000/forms');
    await page.waitForLoadState('networkidle');
    
    console.log('4. Looking for "Danh sách nhân viên" form...');
    // Find the row with "Danh sách nhân viên"
    const formRow = await page.locator('tr:has-text("Danh sách nhân viên")').first();
    
    if (await formRow.count() > 0) {
      console.log('5. Found form, clicking dropdown menu...');
      // Click the dropdown menu (3 dots)
      const dropdownButton = await formRow.locator('button:has(svg)').last();
      await dropdownButton.click();
      
      // Wait for dropdown to appear
      await page.waitForTimeout(500);
      
      console.log('6. Looking for "Design New" option...');
      // Click "Design New" option
      const designNewOption = await page.locator('text="Design New"').first();
      
      if (await designNewOption.count() > 0) {
        console.log('7. Clicking "Design New"...');
        await designNewOption.click();
        
        console.log('8. Waiting for Form Builder to load...');
        await page.waitForURL('**/edit', { timeout: 10000 });
        await page.waitForLoadState('networkidle');
        
        // Force reload to clear cache
        console.log('8.1. Force reloading page to clear cache...');
        await page.reload({ waitUntil: 'networkidle' });
        
        // Wait for console logs
        await page.waitForTimeout(3000);
        
        // Wait a bit for React to render
        await page.waitForTimeout(2000);
        
        console.log('9. Checking page content...');
        
        // Get current URL
        const currentUrl = page.url();
        console.log(`   - Current URL: ${currentUrl}`);
        
        // Extract form ID from URL
        const urlMatch = currentUrl.match(/forms\/([^\/]+)\/edit/);
        const formIdFromUrl = urlMatch ? urlMatch[1] : null;
        console.log(`   - Form ID from URL: ${formIdFromUrl}`);
        
        // Check if form title is displayed
        const formTitle = await page.locator('h1, h2').first();
        if (await formTitle.count() > 0) {
          const titleText = await formTitle.textContent();
          console.log(`   - Page title found: ${titleText}`);
        }
        
        // Check for fields count in header
        const fieldsInfo = await page.locator('text=/Fields: \\d+/').first();
        if (await fieldsInfo.count() > 0) {
          const fieldsText = await fieldsInfo.textContent();
          console.log(`   - Fields info: ${fieldsText}`);
        }
        
        // Check for form fields in canvas
        const formFields = await page.locator('[data-testid="form-field"], .form-field, [class*="field"]').all();
        console.log(`   - Found ${formFields.length} field elements in DOM`);
        
        // Check for "No fields yet" message
        const noFieldsMessage = await page.locator('text="No fields yet"').first();
        if (await noFieldsMessage.count() > 0) {
          console.log('   - WARNING: "No fields yet" message is displayed!');
        }
        
        // Take a screenshot
        await page.screenshot({ path: 'formbuilder-test.png', fullPage: true });
        console.log('10. Screenshot saved as formbuilder-test.png');
        
        // Get all console logs from the page
        const logs = await page.evaluate(() => {
          return window.console.logs || [];
        });
        
      } else {
        console.log('ERROR: "Design New" option not found in dropdown!');
      }
    } else {
      console.log('ERROR: Form "Danh sách nhân viên" not found!');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'error-screenshot.png' });
  }
  
  // Keep browser open for manual inspection
  console.log('\nTest completed. Browser will stay open for 30 seconds...');
  await page.waitForTimeout(30000);
  
  await browser.close();
})();