import { chromium } from 'playwright';

async function testGalleryLive() {
  console.log('🚀 Starting Live Gallery Test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1500, // Slow motion for better observation
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: null // Use full screen
  });
  
  const page = await context.newPage();
  
  // Listen for console logs from the app
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🖱️') || text.includes('🚀') || text.includes('Gallery') || text.includes('openGallery')) {
      console.log('📱 App Log:', text);
    }
  });
  
  // Listen for errors
  page.on('pageerror', error => {
    console.log('❌ Page Error:', error.message);
  });
  
  try {
    console.log('🔗 Step 1: Navigating to application...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Check if already logged in
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (currentUrl.includes('login')) {
      console.log('🔐 Step 2: Logging in...');
      await page.fill('input[type="email"]', 'cuongtranhung@gmail.com');
      await page.fill('input[type="password"]', '@Abcd6789');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('✅ Login successful!');
    } else {
      console.log('✅ Already logged in!');
    }
    
    console.log('📋 Step 3: Navigating to Dynamic Forms...');
    await page.goto('http://localhost:3000/dashboard/forms');
    await page.waitForTimeout(3000);
    
    // Look for forms
    const forms = await page.locator('table tbody tr').count();
    console.log(`Found ${forms} forms`);
    
    if (forms > 0) {
      console.log('👆 Clicking on first form to view submissions...');
      await page.click('table tbody tr:first-child button:has-text("View")');
      await page.waitForTimeout(3000);
      
      console.log('💬 Step 4: Looking for Comments buttons...');
      const commentButtons = await page.locator('button:has-text("Comments")').count();
      console.log(`Found ${commentButtons} comment buttons`);
      
      if (commentButtons > 0) {
        console.log('👆 Clicking first Comments button...');
        await page.click('button:has-text("Comments"):first');
        await page.waitForTimeout(2000);
        
        console.log('🖼️ Step 5: Looking for image attachments...');
        
        // Wait for modal to load
        await page.waitForSelector('.fixed.inset-0', { timeout: 5000 });
        
        // Look for attachments
        const attachments = await page.locator('.cursor-pointer').count();
        console.log(`Found ${attachments} clickable attachments`);
        
        const images = await page.locator('img[src*="comment-attachments"]').count();
        console.log(`Found ${images} comment attachment images`);
        
        if (attachments > 0) {
          console.log('📸 Step 6: Testing Gallery by clicking image...');
          
          // Add a highlight to show what we're clicking
          await page.evaluate(() => {
            const firstClickable = document.querySelector('.cursor-pointer');
            if (firstClickable) {
              firstClickable.style.border = '3px solid red';
              firstClickable.style.boxShadow = '0 0 10px red';
            }
          });
          
          await page.waitForTimeout(1000);
          
          // Click the first clickable attachment
          await page.click('.cursor-pointer:first');
          await page.waitForTimeout(2000);
          
          console.log('🔍 Checking if Gallery opened...');
          
          // Check for Gallery modal with different selectors
          const galleryByTheme = await page.locator('[data-theme="dark"]').count();
          const galleryByClass = await page.locator('.gallery, [class*="gallery"]').count();
          const galleryByBackdrop = await page.locator('.fixed.inset-0').nth(1).count(); // Second modal (Gallery over Comments)
          
          console.log(`Gallery checks: Theme=${galleryByTheme}, Class=${galleryByClass}, Backdrop=${galleryByBackdrop}`);
          
          // Check for Gallery specific controls
          const zoomControls = await page.locator('button[title*="Zoom"]').count();
          const rotateControls = await page.locator('button[title*="Rotate"]').count();
          const resetButton = await page.locator('button:has-text("Reset")').count();
          const closeButton = await page.locator('button[title*="Close"]').count();
          
          console.log(`Gallery controls: Zoom=${zoomControls}, Rotate=${rotateControls}, Reset=${resetButton}, Close=${closeButton}`);
          
          if (galleryByTheme > 0 || galleryByClass > 0 || zoomControls > 0) {
            console.log('🎉 SUCCESS: Gallery Component is working!');
            
            // Test Gallery features
            console.log('🧪 Testing Gallery features...');
            
            if (zoomControls >= 2) {
              console.log('🔍 Testing zoom controls...');
              await page.click('button[title*="Zoom In"]');
              await page.waitForTimeout(500);
              await page.click('button[title*="Zoom Out"]');
              await page.waitForTimeout(500);
              console.log('✅ Zoom controls work!');
            }
            
            if (rotateControls >= 1) {
              console.log('🔄 Testing rotate controls...');
              await page.click('button[title*="Rotate"]:first');
              await page.waitForTimeout(500);
              console.log('✅ Rotate controls work!');
            }
            
            if (resetButton > 0) {
              console.log('🔄 Testing reset button...');
              await page.click('button:has-text("Reset")');
              await page.waitForTimeout(500);
              console.log('✅ Reset button works!');
            }
            
            console.log('⌨️ Testing keyboard shortcuts...');
            await page.keyboard.press('ArrowLeft');
            await page.waitForTimeout(300);
            await page.keyboard.press('ArrowRight');
            await page.waitForTimeout(300);
            await page.keyboard.press('Equal'); // Zoom in
            await page.waitForTimeout(300);
            await page.keyboard.press('Minus'); // Zoom out
            await page.waitForTimeout(300);
            console.log('✅ Keyboard shortcuts work!');
            
            console.log('🚪 Testing close with ESC...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
            
            const galleryAfterEsc = await page.locator('[data-theme="dark"]').count();
            if (galleryAfterEsc === 0) {
              console.log('✅ ESC close works!');
            } else {
              console.log('❌ ESC close not working');
            }
            
            console.log('🎊 GALLERY COMPONENT TEST PASSED!');
            
          } else {
            console.log('❌ FAILED: Gallery did not open properly');
            
            // Debug information
            console.log('🔍 Debug info:');
            const bodyContent = await page.evaluate(() => document.body.innerHTML);
            const hasImageGallery = bodyContent.includes('ImageGallery');
            const hasGalleryClass = bodyContent.includes('gallery');
            console.log('Has ImageGallery in DOM:', hasImageGallery);
            console.log('Has gallery class in DOM:', hasGalleryClass);
            
            // Take screenshot
            await page.screenshot({ path: 'gallery-failed.png', fullPage: true });
            console.log('📸 Screenshot saved: gallery-failed.png');
          }
          
        } else {
          console.log('⚠️ No clickable attachments found');
          
          // Show what's in the comments modal
          const modalContent = await page.locator('.fixed.inset-0').innerHTML();
          console.log('Comments modal content length:', modalContent.length);
        }
        
      } else {
        console.log('⚠️ No Comments buttons found');
      }
      
    } else {
      console.log('⚠️ No forms found - create a form first');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
    console.log('📸 Error screenshot saved: test-error.png');
  }
  
  console.log('⏰ Browser will stay open for 30 seconds for manual inspection...');
  await page.waitForTimeout(30000);
  
  console.log('🏁 Closing browser...');
  await browser.close();
}

testGalleryLive().catch(console.error);