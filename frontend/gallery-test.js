import { chromium } from 'playwright';

async function testGalleryComponent() {
  console.log('🚀 Starting Gallery Component Test...');
  
  const browser = await chromium.launch({ 
    headless: false, // Show browser for debugging
    slowMo: 1000 // Slow down for better observation
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 1. Navigate to login page
    console.log('📍 Step 1: Navigating to login page...');
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    
    // 2. Login with provided credentials
    console.log('🔐 Step 2: Logging in...');
    await page.fill('input[type="email"]', 'cuongtranhung@gmail.com');
    await page.fill('input[type="password"]', '@Abcd6789');
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Login successful!');
    
    // 3. Navigate to Dynamic Forms
    console.log('📋 Step 3: Navigating to Dynamic Forms...');
    await page.goto('http://localhost:3000/dashboard/forms');
    await page.waitForLoadState('networkidle');
    
    // 4. Find a form and view submissions
    console.log('🔍 Step 4: Looking for forms with submissions...');
    const formsExist = await page.locator('table tbody tr').count();
    console.log(`Found ${formsExist} forms`);
    
    if (formsExist > 0) {
      // Click on first form's "View Submissions" button
      await page.click('table tbody tr:first-child td:last-child button:has-text("View")');
      await page.waitForLoadState('networkidle');
      console.log('✅ Opened form submissions');
      
      // 5. Look for Comments button in submissions
      console.log('💬 Step 5: Looking for Comments button...');
      const commentsButtons = await page.locator('button:has-text("Comments")').count();
      console.log(`Found ${commentsButtons} Comments buttons`);
      
      if (commentsButtons > 0) {
        // Click on first Comments button
        await page.click('button:has-text("Comments"):first');
        await page.waitForTimeout(2000); // Wait for modal to open
        console.log('✅ Comments panel opened');
        
        // 6. Look for image attachments in comments
        console.log('🖼️ Step 6: Looking for image attachments...');
        
        // Wait for comments to load
        await page.waitForSelector('.cursor-pointer', { timeout: 5000 });
        
        const imageAttachments = await page.locator('.cursor-pointer img').count();
        console.log(`Found ${imageAttachments} image attachments`);
        
        if (imageAttachments > 0) {
          console.log('📸 Step 7: Testing Gallery functionality...');
          
          // Click on first image attachment
          console.log('👆 Clicking on first image attachment...');
          await page.click('.cursor-pointer:first');
          await page.waitForTimeout(1000);
          
          // 7. Check if Gallery modal opened
          const galleryModal = await page.locator('[data-theme="dark"]').count();
          console.log(`Gallery modals found: ${galleryModal}`);
          
          if (galleryModal > 0) {
            console.log('🎉 SUCCESS: Gallery modal opened!');
            
            // Test Gallery features
            console.log('🧪 Testing Gallery features...');
            
            // Test navigation buttons
            const prevButton = await page.locator('button:has-text("❮")').count();
            const nextButton = await page.locator('button:has-text("❯")').count();
            console.log(`Navigation buttons: Previous=${prevButton}, Next=${nextButton}`);
            
            // Test control buttons
            const zoomInBtn = await page.locator('button[title*="Zoom In"]').count();
            const zoomOutBtn = await page.locator('button[title*="Zoom Out"]').count();
            const rotateBtn = await page.locator('button[title*="Rotate"]').count();
            const resetBtn = await page.locator('button:has-text("Reset")').count();
            
            console.log(`Control buttons: ZoomIn=${zoomInBtn}, ZoomOut=${zoomOutBtn}, Rotate=${rotateBtn}, Reset=${resetBtn}`);
            
            // Test thumbnails
            const thumbnails = await page.locator('.thumbnail, [class*="thumbnail"]').count();
            console.log(`Thumbnails found: ${thumbnails}`);
            
            // Test close button
            const closeBtn = await page.locator('button[title*="Close"]').count();
            console.log(`Close button found: ${closeBtn}`);
            
            if (closeBtn > 0) {
              console.log('🚪 Testing close functionality...');
              await page.click('button[title*="Close"]:first');
              await page.waitForTimeout(1000);
              
              const galleryStillOpen = await page.locator('[data-theme="dark"]').count();
              if (galleryStillOpen === 0) {
                console.log('✅ Gallery closed successfully!');
              } else {
                console.log('❌ Gallery did not close properly');
              }
            }
            
            // Test keyboard shortcuts
            console.log('⌨️ Testing keyboard shortcuts...');
            
            // Open gallery again
            await page.click('.cursor-pointer:first');
            await page.waitForTimeout(1000);
            
            // Test ESC key
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            
            const galleryClosedByEsc = await page.locator('[data-theme="dark"]').count();
            if (galleryClosedByEsc === 0) {
              console.log('✅ ESC key works!');
            } else {
              console.log('❌ ESC key not working');
            }
            
            console.log('🎊 GALLERY COMPONENT TEST COMPLETED!');
            
          } else {
            console.log('❌ FAIL: Gallery modal did not open');
            
            // Debug: Check what happened
            console.log('🔍 Debugging: Checking page content...');
            const pageContent = await page.content();
            console.log('Current page contains Gallery:', pageContent.includes('ImageGallery'));
            console.log('Current page contains gallery class:', pageContent.includes('gallery'));
            
            // Check for JavaScript errors
            page.on('pageerror', error => {
              console.log('❌ JavaScript Error:', error.message);
            });
            
            // Check console logs
            page.on('console', msg => {
              if (msg.type() === 'error') {
                console.log('❌ Console Error:', msg.text());
              }
            });
          }
          
        } else {
          console.log('⚠️ No image attachments found in comments');
        }
        
      } else {
        console.log('⚠️ No Comments buttons found');
      }
      
    } else {
      console.log('⚠️ No forms found');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

// Run the test
testGalleryComponent().catch(console.error);