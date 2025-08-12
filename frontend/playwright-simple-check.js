import { chromium } from 'playwright';

async function simpleAvatarCheck() {
  console.log('🔍 Simple avatar check...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
  });

  try {
    console.log('📋 Step 1: Navigate and login');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="email"]', 'cuongtranhung@gmail.com');
    await page.fill('input[name="password"]', '@Abcd6789');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/dashboard');
    console.log('✅ Login successful');

    console.log('📋 Step 2: Go to User Management');
    await page.goto('http://localhost:3000/user-management');
    await page.waitForTimeout(3000); // Wait 3 seconds

    console.log('📋 Step 3: Take screenshot');
    await page.screenshot({ path: 'user-management-page.png', fullPage: true });
    console.log('✅ Screenshot saved: user-management-page.png');

    console.log('📋 Step 4: Check page content');
    const pageContent = await page.evaluate(() => {
      return {
        title: document.title,
        hasTable: document.querySelector('table') ? true : false,
        hasUserRows: document.querySelectorAll('table tbody tr').length,
        hasAvatars: document.querySelectorAll('img').length,
        errorMessages: Array.from(document.querySelectorAll('[class*="error"]')).map(el => el.textContent),
        loadingElements: document.querySelectorAll('[class*="loading"]').length
      };
    });

    console.log('📊 Page Analysis:');
    console.log(`  Title: ${pageContent.title}`);
    console.log(`  Has Table: ${pageContent.hasTable}`);
    console.log(`  User Rows: ${pageContent.hasUserRows}`);
    console.log(`  Avatar Images: ${pageContent.hasAvatars}`);
    console.log(`  Loading Elements: ${pageContent.loadingElements}`);
    console.log(`  Error Messages: ${pageContent.errorMessages.join(', ')}`);

    // Try avatar test page
    console.log('\n📋 Step 5: Try avatar test page');
    await page.goto('http://localhost:3000/avatar-test');
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 'avatar-test-page.png', fullPage: true });
    console.log('✅ Avatar test page screenshot saved');

    // Keep browser open for manual inspection
    console.log('\n🔍 Browser kept open for manual inspection...');
    console.log('Press Enter to close browser');
    
    // Wait for user input
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

simpleAvatarCheck().catch(console.error);