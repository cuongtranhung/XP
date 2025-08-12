const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Verifying Import Button After Restart\n');
  console.log('='.repeat(60));
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 200
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    }
  });
  
  try {
    console.log('📍 Step 1: Check frontend is running');
    await page.goto('http://localhost:3000', {
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    console.log('✅ Frontend is running on port 3000');
    
    console.log('\n📍 Step 2: Navigate to login');
    await page.goto('http://localhost:3000/login', {
      waitUntil: 'networkidle'
    });
    
    // Take screenshot of login page
    await page.screenshot({ 
      path: '/tmp/after-restart-login.png', 
      fullPage: false 
    });
    console.log('📸 Login page screenshot saved');
    
    // Try to login
    const emailInput = await page.locator('input[type="email"]').first();
    const passwordInput = await page.locator('input[type="password"]').first();
    
    if (await emailInput.isVisible()) {
      console.log('\n📍 Step 3: Attempting login...');
      await emailInput.fill('admin@example.com');
      await passwordInput.fill('admin123');
      
      const loginButton = await page.locator('button[type="submit"]').first();
      await loginButton.click();
      
      await page.waitForTimeout(3000);
      console.log('Login attempted');
    }
    
    // Try to navigate to Table View
    console.log('\n📍 Step 4: Navigate to Table View');
    const formId = '675e9a7a3f41b96e3cd186cc';
    
    await page.goto(`http://localhost:3000/forms/${formId}/submissions/table`, {
      timeout: 10000
    }).catch(async (e) => {
      console.log('⚠️ Direct navigation failed, checking current page...');
      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);
    });
    
    await page.waitForTimeout(2000);
    
    // Check what's on the page
    console.log('\n📍 Step 5: Analyzing page content...');
    
    // Look for Table View header
    const tableViewHeader = await page.locator('h1:has-text("Table View")').isVisible().catch(() => false);
    console.log(`Table View header: ${tableViewHeader ? 'FOUND' : 'NOT FOUND'}`);
    
    // Look for all buttons
    const buttons = await page.locator('button').all();
    console.log(`\nTotal buttons found: ${buttons.length}`);
    
    let buttonInfo = [];
    for (let i = 0; i < buttons.length; i++) {
      const text = await buttons[i].textContent().catch(() => '');
      const classes = await buttons[i].getAttribute('class').catch(() => '');
      const isVisible = await buttons[i].isVisible().catch(() => false);
      
      if (text && text.trim()) {
        buttonInfo.push({
          index: i + 1,
          text: text.trim(),
          visible: isVisible,
          hasBlueClass: classes && classes.includes('bg-blue'),
          hasGreenClass: classes && classes.includes('bg-green')
        });
      }
    }
    
    console.log('\n📊 Buttons found on page:');
    buttonInfo.forEach(btn => {
      let color = '';
      if (btn.hasBlueClass) color = ' (BLUE)';
      if (btn.hasGreenClass) color = ' (GREEN)';
      console.log(`  ${btn.index}. "${btn.text}"${color} - Visible: ${btn.visible}`);
    });
    
    // Specifically look for Import button
    console.log('\n📍 Step 6: Searching for Import button...');
    
    const importByText = await page.locator('button:has-text("Import")').isVisible().catch(() => false);
    const importByClass = await page.locator('button.bg-blue-600').isVisible().catch(() => false);
    const importByAria = await page.locator('button[aria-label*="Import"]').isVisible().catch(() => false);
    
    console.log(`  By text "Import": ${importByText ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`  By blue class: ${importByClass ? 'FOUND' : 'NOT FOUND'}`);
    console.log(`  By aria-label: ${importByAria ? 'FOUND' : 'NOT FOUND'}`);
    
    // Check page source
    const pageContent = await page.content();
    const hasImportInSource = pageContent.includes('Import');
    const hasUploadIcon = pageContent.includes('Upload');
    
    console.log(`  "Import" in page source: ${hasImportInSource ? 'YES' : 'NO'}`);
    console.log(`  "Upload" icon in source: ${hasUploadIcon ? 'YES' : 'NO'}`);
    
    // Take final screenshot
    await page.screenshot({ 
      path: '/tmp/after-restart-final.png', 
      fullPage: false 
    });
    console.log('\n📸 Final screenshot saved to /tmp/after-restart-final.png');
    
    // Final analysis
    console.log('\n' + '='.repeat(60));
    console.log('🎯 FINAL RESULTS:');
    console.log('='.repeat(60));
    
    if (tableViewHeader) {
      console.log('✅ Table View page loaded successfully');
      
      const importFound = buttonInfo.some(btn => btn.text.includes('Import'));
      if (importFound) {
        console.log('✅ Import button IS VISIBLE on the page!');
      } else {
        console.log('❌ Import button NOT FOUND on Table View');
        console.log('\nButtons that WERE found:');
        buttonInfo.forEach(btn => {
          console.log(`  - ${btn.text}`);
        });
      }
    } else {
      console.log('⚠️ Not on Table View page');
      console.log('Current page may be login or dashboard');
      console.log('\nTo see Import button:');
      console.log('1. Login with valid credentials');
      console.log('2. Navigate to a form');
      console.log('3. Click on "Table View" or go to /forms/[id]/submissions/table');
    }
    
    console.log('\n💡 Frontend is now running on: http://localhost:3000');
    console.log('   (Previously was on port 5173)');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ 
      path: '/tmp/after-restart-error.png', 
      fullPage: false 
    });
  }
  
  await browser.close();
  console.log('\n✅ Verification complete');
})();