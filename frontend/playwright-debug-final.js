import { chromium } from 'playwright';

async function finalAvatarDebug() {
  console.log('🔍 Final avatar debug test...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable all console logging
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  page.on('response', response => {
    if (response.url().includes('/api/user-management/users')) {
      console.log(`[API] ${response.status()} ${response.url()}`);
    }
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

    console.log('\n📋 Step 2: Navigate to User Management');
    await page.goto('http://localhost:3000/user-management');
    
    // Wait for either success or error
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(5000); // Wait 5 seconds

    console.log('\n📋 Step 3: Check DOM elements');
    const pageInfo = await page.evaluate(() => {
      return {
        hasTable: document.querySelector('table') ? true : false,
        hasUserRows: document.querySelectorAll('table tbody tr').length,
        hasImages: document.querySelectorAll('img').length,
        loadingSpinners: document.querySelectorAll('.animate-spin').length,
        errorMessages: Array.from(document.querySelectorAll('*')).filter(el => 
          el.textContent && (el.textContent.includes('error') || el.textContent.includes('Error'))
        ).map(el => el.textContent),
        bodyContent: document.body.innerText.substring(0, 1000)
      };
    });

    console.log('📊 Page DOM Analysis:');
    console.log(`  Has Table: ${pageInfo.hasTable}`);
    console.log(`  User Rows: ${pageInfo.hasUserRows}`);
    console.log(`  Images: ${pageInfo.hasImages}`);
    console.log(`  Loading Spinners: ${pageInfo.loadingSpinners}`);
    console.log(`  Error Messages: ${JSON.stringify(pageInfo.errorMessages)}`);
    console.log(`  Body Content Preview: ${pageInfo.bodyContent}`);

    // Take a screenshot
    await page.screenshot({ path: 'final-avatar-debug.png', fullPage: true });
    console.log('📸 Screenshot saved: final-avatar-debug.png');

    if (pageInfo.hasImages > 0) {
      console.log('\n📋 Step 4: Analyze images');
      const imageAnalysis = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        return images.map((img, index) => ({
          index,
          src: img.src.length > 100 ? `${img.src.substring(0, 100)}...` : img.src,
          alt: img.alt,
          width: img.width,
          height: img.height,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight
        }));
      });

      console.log('🖼️ Image Analysis:');
      imageAnalysis.forEach(img => {
        console.log(`  Image ${img.index}:`);
        console.log(`    Alt: ${img.alt}`);
        console.log(`    Src: ${img.src}`);
        console.log(`    Size: ${img.width}x${img.height}`);
        console.log(`    Natural: ${img.naturalWidth}x${img.naturalHeight}`);
        console.log(`    Complete: ${img.complete}`);
        console.log('');
      });
    }

    console.log('\n🔍 Debug completed. Check browser console and screenshot.');
    console.log('Press Enter to close...');

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

finalAvatarDebug().catch(console.error);