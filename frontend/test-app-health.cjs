// Simple test to check if the app is loading
const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    console.log('🚀 Starting app health check...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        console.log('❌ Console Error:', msg.text());
      }
    });
    
    page.on('pageerror', error => {
      console.log('❌ Page Error:', error.message);
    });
    
    console.log('📱 Navigating to http://localhost:3000...');
    const response = await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    console.log('📊 Response status:', response.status());
    
    // Wait a bit for React to render
    await page.waitForTimeout(2000);
    
    // Check if login form exists
    const loginFormExists = await page.evaluate(() => {
      const form = document.querySelector('form');
      const emailInput = document.querySelector('input[type="email"]');
      const passwordInput = document.querySelector('input[type="password"]');
      const submitButton = document.querySelector('button[type="submit"]');
      
      return {
        hasForm: !!form,
        hasEmailInput: !!emailInput,
        hasPasswordInput: !!passwordInput,
        hasSubmitButton: !!submitButton,
        pageTitle: document.title,
        bodyText: document.body.innerText.substring(0, 200)
      };
    });
    
    console.log('\n📋 Page Analysis:');
    console.log('- Has login form:', loginFormExists.hasForm);
    console.log('- Has email input:', loginFormExists.hasEmailInput);
    console.log('- Has password input:', loginFormExists.hasPasswordInput);
    console.log('- Has submit button:', loginFormExists.hasSubmitButton);
    console.log('- Page title:', loginFormExists.pageTitle);
    console.log('- Body preview:', loginFormExists.bodyText);
    
    if (loginFormExists.hasForm && loginFormExists.hasEmailInput && loginFormExists.hasPasswordInput) {
      console.log('\n✅ App is healthy! Login form is displayed correctly.');
    } else {
      console.log('\n⚠️ App loaded but login form not found. Checking for errors...');
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'app-state.png' });
      console.log('📸 Screenshot saved as app-state.png');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();