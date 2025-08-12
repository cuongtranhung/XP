import { chromium } from 'playwright';

async function debugAvatarDisplay() {
  console.log('🔍 Starting Playwright avatar debug test...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`);
  });
  
  // Enable error logging
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  try {
    console.log('📋 Step 1: Navigate to login page');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    console.log('📋 Step 2: Login');
    await page.fill('input[name="email"]', 'cuongtranhung@gmail.com');
    await page.fill('input[name="password"]', '@Abcd6789');
    await page.click('button[type="submit"]');
    
    // Wait for navigation after login
    await page.waitForURL('**/dashboard');
    console.log('✅ Login successful');

    console.log('📋 Step 3: Navigate to User Management');
    await page.goto('http://localhost:3000/user-management');
    await page.waitForLoadState('networkidle');

    console.log('📋 Step 4: Wait for user table to load');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    console.log('📋 Step 5: Analyze avatar elements');
    const avatarElements = await page.locator('img').count();
    console.log(`Found ${avatarElements} img elements`);

    // Check each avatar
    const avatarData = await page.evaluate(() => {
      const avatarImages = Array.from(document.querySelectorAll('img'));
      return avatarImages.map((img, index) => ({
        index,
        src: img.src ? img.src.substring(0, 100) + '...' : 'No src',
        alt: img.alt,
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        classList: Array.from(img.classList),
        parentClass: img.parentElement ? Array.from(img.parentElement.classList) : []
      }));
    });

    console.log('\n📸 Avatar Analysis:');
    avatarData.forEach(data => {
      console.log(`\n  Avatar ${data.index}:`);
      console.log(`    Alt: ${data.alt}`);
      console.log(`    Src: ${data.src}`);
      console.log(`    Size: ${data.width}x${data.height}`);
      console.log(`    Natural Size: ${data.naturalWidth}x${data.naturalHeight}`);
      console.log(`    Complete: ${data.complete}`);
      console.log(`    Classes: ${data.classList.join(' ')}`);
      console.log(`    Parent Classes: ${data.parentClass.join(' ')}`);
    });

    // Check for specific avatar containers
    console.log('\n📋 Step 6: Check avatar containers');
    const avatarContainers = await page.evaluate(() => {
      const containers = Array.from(document.querySelectorAll('div')).filter(div => 
        div.className.includes('rounded-full') || div.className.includes('avatar')
      );
      return containers.map((container, index) => ({
        index,
        className: container.className,
        innerHTML: container.innerHTML.substring(0, 200) + '...',
        hasImage: container.querySelector('img') ? true : false
      }));
    });

    console.log('🔘 Avatar Containers:');
    avatarContainers.forEach(container => {
      console.log(`\n  Container ${container.index}:`);
      console.log(`    Classes: ${container.className}`);
      console.log(`    Has Image: ${container.hasImage}`);
      console.log(`    Content: ${container.innerHTML}`);
    });

    // Take screenshot for visual inspection
    console.log('\n📋 Step 7: Taking screenshot');
    await page.screenshot({ path: 'avatar-debug-screenshot.png', fullPage: true });
    console.log('✅ Screenshot saved as avatar-debug-screenshot.png');

    // Test the dedicated avatar test page
    console.log('\n📋 Step 8: Testing dedicated avatar page');
    await page.goto('http://localhost:3000/avatar-test');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ path: 'avatar-test-page-screenshot.png', fullPage: true });
    console.log('✅ Avatar test page screenshot saved');

    console.log('\n✅ Playwright avatar debug complete!');
    console.log('Check the screenshots and console output above for issues.');

  } catch (error) {
    console.error('❌ Error during avatar debug:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the debug
debugAvatarDisplay().catch(console.error);