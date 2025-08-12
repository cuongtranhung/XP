import { chromium } from 'playwright';

async function testAvatarDisplayFixed() {
  console.log('🔧 Testing Avatar Display Fix...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.text().includes('Loading users') || 
        msg.text().includes('Users loaded') || 
        msg.text().includes('Avatar check') ||
        msg.text().includes('failed to load')) {
      console.log(`[BROWSER] ${msg.text()}`);
    }
  });

  try {
    console.log('📋 Step 1: Login');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    await page.fill('input[name="email"]', 'cuongtranhung@gmail.com');
    await page.fill('input[name="password"]', '@Abcd6789');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    console.log('✅ Login successful');

    console.log('\n📋 Step 2: Navigate to User Management (now using normal table mode)');
    await page.goto('http://localhost:3000/user-management');
    
    // Wait for table to load
    console.log('⏳ Waiting for table...');
    await page.waitForSelector('table', { timeout: 10000 });
    console.log('✅ Table found!');

    // Wait a bit more for data to load
    await page.waitForTimeout(3000);

    console.log('\n📋 Step 3: Check for avatars');
    const avatarCount = await page.locator('img').count();
    console.log(`Found ${avatarCount} images on page`);

    const userRows = await page.locator('table tbody tr').count();
    console.log(`Found ${userRows} user rows`);

    if (avatarCount > 0) {
      console.log('\n🖼️ Analyzing avatar images:');
      const avatarData = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'));
        return images.map((img, i) => ({
          index: i,
          src: img.src.substring(0, 50) + (img.src.length > 50 ? '...' : ''),
          alt: img.alt,
          width: img.width,
          height: img.height,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight
        }));
      });

      avatarData.forEach(img => {
        console.log(`  Image ${img.index}: ${img.alt}`);
        console.log(`    Src: ${img.src}`);
        console.log(`    Size: ${img.width}x${img.height}, Natural: ${img.naturalWidth}x${img.naturalHeight}`);
        console.log(`    Complete: ${img.complete}`);
        console.log('');
      });
    }

    // Take screenshot
    await page.screenshot({ path: 'avatar-fix-verification.png', fullPage: true });
    console.log('📸 Screenshot saved: avatar-fix-verification.png');

    console.log('\n🎉 Results:');
    console.log(`✅ Table Mode: normal (UserManagementTable with Avatar support)`);
    console.log(`✅ User Rows: ${userRows}`);
    console.log(`✅ Avatar Images: ${avatarCount}`);
    
    if (avatarCount >= 3) {
      console.log('🎊 SUCCESS: Avatars are now displaying!');
    } else {
      console.log('❌ Issue: Expected at least 3 avatar images');
    }

    console.log('\nPress Enter to close browser...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ path: 'avatar-test-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

testAvatarDisplayFixed().catch(console.error);