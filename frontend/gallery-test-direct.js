import { chromium } from 'playwright';

async function testGalleryDirect() {
  console.log('🚀 Starting Direct Gallery Component Test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Listen for console logs and errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    } else if (msg.text().includes('Gallery') || msg.text().includes('🖱️') || msg.text().includes('🚀')) {
      console.log('📝 App Log:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    console.log('❌ JavaScript Error:', error.message);
  });
  
  try {
    // 1. Login first
    console.log('🔐 Step 1: Logging in...');
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'cuongtranhung@gmail.com');
    await page.fill('input[type="password"]', '@Abcd6789');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Login successful!');
    
    // 2. Navigate directly to a form submissions page
    console.log('📋 Step 2: Navigating to specific form submissions...');
    
    // Try to find a form first
    await page.goto('http://localhost:3000/dashboard/forms');
    await page.waitForTimeout(3000);
    
    // Check if there are any forms
    const formRows = await page.locator('table tbody tr').count();
    console.log(`Found ${formRows} forms`);
    
    if (formRows > 0) {
      // Get the first form ID from the URL or form data
      const firstFormButton = await page.locator('table tbody tr:first-child button:has-text("View")').first();
      await firstFormButton.click();
      await page.waitForTimeout(3000);
      
      console.log('✅ Opened form submissions page');
      
      // 3. Look for comment buttons
      console.log('💬 Step 3: Looking for Comments buttons...');
      
      // Wait for the page to fully load
      await page.waitForSelector('table', { timeout: 10000 });
      
      const commentButtons = await page.locator('button:has-text("Comments")').count();
      console.log(`Found ${commentButtons} Comments buttons`);
      
      if (commentButtons > 0) {
        // Click the first comment button
        console.log('👆 Clicking first Comments button...');
        await page.click('button:has-text("Comments"):first');
        await page.waitForTimeout(2000);
        
        console.log('✅ Comments modal should be open');
        
        // 4. Look for image attachments
        console.log('🖼️ Step 4: Looking for image attachments...');
        
        // Check if comments modal is open
        const modalOpen = await page.locator('.fixed.inset-0').count();
        console.log(`Modals found: ${modalOpen}`);
        
        if (modalOpen > 0) {
          // Look for clickable image containers
          const imageContainers = await page.locator('.cursor-pointer').count();
          console.log(`Clickable containers found: ${imageContainers}`);
          
          // Look for actual images
          const images = await page.locator('img').count();
          console.log(`Images found: ${images}`);
          
          if (imageContainers > 0) {
            console.log('📸 Step 5: Testing Gallery trigger...');
            
            // Click on the first clickable image container
            await page.click('.cursor-pointer:first');
            await page.waitForTimeout(2000);
            
            // Check if Gallery opened
            const galleryElements = await page.locator('[data-theme="dark"], .gallery, [class*="gallery"]').count();
            console.log(`Gallery elements found: ${galleryElements}`);
            
            // Check for specific Gallery components
            const galleryModals = await page.locator('.fixed.inset-0[data-theme]').count();
            console.log(`Gallery modals found: ${galleryModals}`);
            
            // Check for Gallery controls
            const controls = await page.locator('button[title*="Zoom"], button[title*="Rotate"], button:has-text("Reset")').count();
            console.log(`Gallery controls found: ${controls}`);
            
            if (galleryElements > 0 || galleryModals > 0) {
              console.log('🎉 SUCCESS: Gallery component is working!');
              
              // Test closing with ESC
              console.log('⌨️ Testing ESC key...');
              await page.keyboard.press('Escape');
              await page.waitForTimeout(1000);
              
              const galleryAfterEsc = await page.locator('[data-theme="dark"]').count();
              if (galleryAfterEsc === 0) {
                console.log('✅ ESC key works!');
              } else {
                console.log('❌ ESC key not working');
              }
              
            } else {
              console.log('❌ FAIL: Gallery did not open');
              
              // Take screenshot for debugging
              await page.screenshot({ path: 'gallery-debug.png' });
              console.log('📸 Screenshot saved as gallery-debug.png');
              
              // Check page content
              const hasGalleryCode = await page.evaluate(() => {
                return document.body.innerHTML.includes('ImageGallery') || 
                       document.body.innerHTML.includes('gallery') ||
                       window.React !== undefined;
              });
              console.log('Has Gallery code in DOM:', hasGalleryCode);
            }
            
          } else {
            console.log('⚠️ No clickable image containers found');
            
            // Debug: show what's in the comments modal
            const modalContent = await page.locator('.fixed.inset-0').innerHTML();
            console.log('Modal content preview:', modalContent.substring(0, 200) + '...');
          }
          
        } else {
          console.log('❌ Comments modal did not open');
        }
        
      } else {
        console.log('⚠️ No Comments buttons found in submissions');
      }
      
    } else {
      console.log('⚠️ No forms found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    // Take error screenshot
    await page.screenshot({ path: 'error-debug.png' });
    console.log('📸 Error screenshot saved as error-debug.png');
    
  } finally {
    console.log('🏁 Test completed. Browser will close in 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

testGalleryDirect().catch(console.error);