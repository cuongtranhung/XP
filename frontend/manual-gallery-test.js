import { chromium } from 'playwright';

(async () => {
  console.log('🔧 Starting Manual Gallery Test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  // Show all console logs for debugging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🖼️') || text.includes('📸') || text.includes('🎭') || text.includes('Gallery')) {
      console.log(`🎯 GALLERY DEBUG: ${text}`);
    }
  });
  
  try {
    console.log('📍 Loading and logging in...');
    await page.goto('http://localhost:3001/login');
    
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'admin@fullstackauth.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    console.log('📍 Navigate to form submissions...');
    await page.goto('http://localhost:3001/forms/e5b13cb9-56b6-4ae4-bdfd-533370a5c049/submissions');
    await page.waitForTimeout(3000);
    
    console.log('✅ Ready for manual testing!');
    console.log('📋 Manual Test Steps:');
    console.log('1. Look for submissions in the table');
    console.log('2. Click on a View Comments button or similar');
    console.log('3. Look for image attachments in comments');
    console.log('4. Click on an image attachment');
    console.log('5. Check if Gallery opens');
    console.log('6. Look for console messages starting with 🖼️ or 🎭');
    console.log('');
    console.log('⏳ Browser will stay open for manual testing...');
    
    // Keep browser open for 5 minutes for manual testing
    await page.waitForTimeout(300000);
    
  } catch (error) {
    console.error('🚨 Test setup failed:', error.message);
  }
  
  console.log('✅ Test session ended');
})();