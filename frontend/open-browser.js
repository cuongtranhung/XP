import { chromium } from 'playwright';

async function openBrowserForTesting() {
  console.log('🌐 Opening browser for Gallery testing...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500,
    args: ['--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: null
  });
  
  const page = await context.newPage();
  
  // Listen for Gallery-related console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('🖱️') || text.includes('🚀') || text.includes('Gallery') || 
        text.includes('openGallery') || text.includes('🎬') || text.includes('📸')) {
      console.log('🎯 GALLERY LOG:', text);
    }
  });
  
  page.on('pageerror', error => {
    console.log('❌ JavaScript Error:', error.message);
  });
  
  try {
    console.log('🔗 Navigating to login...');
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    
    console.log('🔐 Auto-logging in...');
    await page.fill('input[type="email"]', 'cuongtranhung@gmail.com');
    await page.fill('input[type="password"]', '@Abcd6789');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ Login successful!');
    
    console.log('📋 Navigating to Dynamic Forms...');
    await page.goto('http://localhost:3000/dashboard/forms');
    await page.waitForTimeout(2000);
    
    console.log(`
🎯 BROWSER IS NOW OPEN FOR TESTING!

📍 Manual Testing Steps:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Look for any forms in the table
2. Click "View" button on any form
3. Click "Comments" button on any submission
4. Look for image attachments (small squares with images)
5. CLICK ON ANY IMAGE → Gallery should open!

🔍 What to Check:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Gallery modal opens with dark background
✓ Image displays in center
✓ Navigation arrows (← →) appear
✓ Control buttons at bottom (Zoom In/Out, Rotate, Reset)
✓ Thumbnails strip at bottom (if multiple images)
✓ Close button (X) in top right

⌨️ Keyboard Shortcuts to Test:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• ← → : Navigate between images
• + - : Zoom in/out
• R : Rotate right
• Shift+R : Rotate left
• F : Fullscreen
• Space : Reset transform
• ESC : Close gallery

📱 Console Logs:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Watch this terminal for Gallery-related logs when you click!

🚨 If Gallery DOESN'T work:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Check browser console (F12) for errors
2. Try hard refresh (Ctrl+Shift+R)
3. Look for debug logs in this terminal

Browser will stay open for 10 minutes...
    `);
    
    // Keep browser open for 10 minutes
    await page.waitForTimeout(600000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('🏁 Closing browser...');
    await browser.close();
  }
}

openBrowserForTesting().catch(console.error);