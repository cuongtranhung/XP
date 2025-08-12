const { test, expect } = require('@playwright/test');

test.describe('Comment Reply Authentication Debug', () => {
  let page;
  let context;

  test.beforeAll(async ({ browser }) => {
    // Create a new context with detailed logging
    context = await browser.newContext({
      // Enable network capture
      recordVideo: {
        dir: 'tests/videos/',
        size: { width: 1280, height: 720 }
      }
    });
    
    page = await context.newPage();
    
    // Enable console and network logging
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`[NETWORK RESPONSE] ${response.status()} ${response.url()}`);
      }
    });
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log(`[NETWORK REQUEST] ${request.method()} ${request.url()}`);
        const headers = request.headers();
        console.log(`[REQUEST HEADERS]`, headers);
      }
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Debug comment reply authentication issue', async () => {
    console.log('🚀 Starting comment reply authentication debug test');

    // Step 1: Navigate to the application
    console.log('📍 Step 1: Navigating to application...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Step 2: Perform login
    console.log('🔐 Step 2: Performing login...');
    
    // Check if already logged in
    const loginButton = page.locator('button:has-text("Login"), a:has-text("Login")');
    if (await loginButton.isVisible()) {
      await loginButton.click();
      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
      
      // Fill login form
      await page.fill('input[type="email"], input[name="email"]', 'cuongtranhung@gmail.com');
      await page.fill('input[type="password"], input[name="password"]', '@Abcd6789');
      
      // Submit login form
      await page.click('button[type="submit"], button:has-text("Sign"), button:has-text("Login")');
      await page.waitForLoadState('networkidle');
    }

    // Verify login success
    console.log('✅ Step 3: Verifying login success...');
    await expect(page).toHaveURL(/dashboard|forms/, { timeout: 15000 });

    // Step 4: Navigate to forms and find the specific form
    console.log('📋 Step 4: Navigating to forms...');
    
    // Try different navigation paths
    let formsLink = page.locator('a:has-text("Forms"), nav a[href*="forms"]');
    if (await formsLink.isVisible()) {
      await formsLink.click();
    } else {
      // Try direct navigation
      await page.goto('http://localhost:3000/forms');
    }
    
    await page.waitForLoadState('networkidle');

    // Step 5: Find and click on a form
    console.log('🔍 Step 5: Finding and selecting a form...');
    
    // Look for form cards or links
    const formSelector = '.form-card, [data-testid="form-card"], a[href*="/forms/"]';
    await page.waitForSelector(formSelector, { timeout: 10000 });
    
    const formElements = page.locator(formSelector);
    const formCount = await formElements.count();
    console.log(`Found ${formCount} forms`);
    
    if (formCount > 0) {
      await formElements.first().click();
    } else {
      // Try direct navigation to known form
      await page.goto('http://localhost:3000/forms/e5b13cb9-56b6-4ae4-bdfd-533370a5c049');
    }
    
    await page.waitForLoadState('networkidle');

    // Step 6: Navigate to submissions
    console.log('📊 Step 6: Navigating to form submissions...');
    
    const submissionsLink = page.locator('a:has-text("Submissions"), button:has-text("Submissions"), [data-testid="submissions"]');
    if (await submissionsLink.isVisible()) {
      await submissionsLink.click();
    } else {
      // Try direct navigation
      await page.goto('http://localhost:3000/forms/e5b13cb9-56b6-4ae4-bdfd-533370a5c049/submissions');
    }
    
    await page.waitForLoadState('networkidle');

    // Step 7: Find the specific submission
    console.log('🎯 Step 7: Finding submission 123866b4-0c6d-448e-b4cb-bb78818de408...');
    
    const targetSubmissionId = '123866b4-0c6d-448e-b4cb-bb78818de408';
    
    // Look for the submission in different ways
    let submissionElement = page.locator(`[data-submission-id="${targetSubmissionId}"]`);
    
    if (!(await submissionElement.isVisible())) {
      // Try finding by partial ID
      submissionElement = page.locator(`text=${targetSubmissionId.substring(0, 8)}`);
    }
    
    if (!(await submissionElement.isVisible())) {
      // List all submissions for debugging
      const submissionElements = page.locator('.submission-row, [data-testid="submission"], .submission-card');
      const submissionCount = await submissionElements.count();
      console.log(`Found ${submissionCount} submissions`);
      
      // Use the first submission if target not found
      if (submissionCount > 0) {
        submissionElement = submissionElements.first();
      }
    }

    // Step 8: Click on Comments button for the submission
    console.log('💬 Step 8: Opening comment panel...');
    
    // Capture network requests for comment loading
    const commentRequestPromise = page.waitForResponse(response => 
      response.url().includes('/comments') && response.status() === 200
    );
    
    const commentsButton = page.locator('button:has-text("Comments"), [data-testid="comments-button"]').first();
    if (await commentsButton.isVisible()) {
      await commentsButton.click();
    } else {
      // Try finding within the submission row
      await submissionElement.locator('button:has-text("Comments"), [aria-label*="comment"]').first().click();
    }

    // Wait for comment panel to load
    const commentResponse = await commentRequestPromise;
    console.log(`✅ Comments loaded with status: ${commentResponse.status()}`);

    // Wait for comment panel to appear
    await page.waitForSelector('.comment-panel, [data-testid="comment-panel"], .comments-section', { timeout: 10000 });

    // Step 9: Test existing comments loading
    console.log('📝 Step 9: Verifying existing comments load...');
    
    const existingComments = page.locator('.comment-item, [data-testid="comment"], .comment');
    const commentCount = await existingComments.count();
    console.log(`Found ${commentCount} existing comments`);

    // Step 10: Capture current authentication state
    console.log('🔐 Step 10: Capturing authentication state...');
    
    // Get all cookies
    const cookies = await context.cookies();
    console.log('🍪 Current cookies:', cookies);
    
    // Check for session cookie specifically
    const sessionCookie = cookies.find(cookie => 
      cookie.name.includes('session') || 
      cookie.name.includes('auth') || 
      cookie.name.includes('token')
    );
    
    if (sessionCookie) {
      console.log('🔑 Session cookie found:', {
        name: sessionCookie.name,
        value: sessionCookie.value.substring(0, 20) + '...',
        domain: sessionCookie.domain,
        path: sessionCookie.path,
        secure: sessionCookie.secure,
        httpOnly: sessionCookie.httpOnly
      });
    } else {
      console.log('⚠️ No session cookie found');
    }

    // Step 11: Test reply functionality with network monitoring
    console.log('🔄 Step 11: Testing reply functionality...');
    
    // Find reply input or button
    const replyInput = page.locator('textarea[placeholder*="reply"], input[placeholder*="reply"], textarea.reply-input');
    const replyButton = page.locator('button:has-text("Reply"), button[data-testid="reply-button"]');
    
    if (await replyInput.isVisible()) {
      // Monitor the request that will be made
      let requestDetails = null;
      let responseDetails = null;
      
      page.on('request', request => {
        if (request.url().includes('/comments') && request.method() === 'POST') {
          requestDetails = {
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: request.postData()
          };
          console.log('🔍 REPLY REQUEST DETAILS:', requestDetails);
        }
      });
      
      page.on('response', response => {
        if (response.url().includes('/comments') && response.request().method() === 'POST') {
          responseDetails = {
            url: response.url(),
            status: response.status(),
            statusText: response.statusText(),
            headers: response.headers()
          };
          console.log('🔍 REPLY RESPONSE DETAILS:', responseDetails);
        }
      });

      // Fill and submit reply
      await replyInput.fill('This is a test reply for debugging authentication issues.');
      
      if (await replyButton.isVisible()) {
        await replyButton.click();
      } else {
        // Try pressing Enter
        await replyInput.press('Enter');
      }

      // Wait for the response
      try {
        await page.waitForResponse(response => 
          response.url().includes('/comments') && 
          response.request().method() === 'POST',
          { timeout: 10000 }
        );
        
        console.log('✅ Reply request completed');
        
        // Check if error occurred
        const errorMessage = page.locator('.error, [data-testid="error"], .alert-danger');
        if (await errorMessage.isVisible()) {
          const errorText = await errorMessage.textContent();
          console.log('❌ Error message displayed:', errorText);
        }
        
      } catch (timeoutError) {
        console.log('⏱️ Reply request timed out');
      }

      // Step 12: Analyze the captured request/response
      console.log('🔬 Step 12: Analyzing request/response details...');
      
      if (requestDetails) {
        console.log('📤 REQUEST ANALYSIS:');
        console.log('  URL:', requestDetails.url);
        console.log('  Method:', requestDetails.method);
        console.log('  Headers:', JSON.stringify(requestDetails.headers, null, 2));
        console.log('  Body:', requestDetails.postData);
        
        // Check for authentication headers
        const authHeaders = ['cookie', 'authorization', 'x-auth-token', 'x-session-id'];
        authHeaders.forEach(header => {
          if (requestDetails.headers[header]) {
            console.log(`  🔑 ${header.toUpperCase()}:`, requestDetails.headers[header]);
          }
        });
      }
      
      if (responseDetails) {
        console.log('📥 RESPONSE ANALYSIS:');
        console.log('  Status:', responseDetails.status, responseDetails.statusText);
        console.log('  Headers:', JSON.stringify(responseDetails.headers, null, 2));
        
        // If it's a 400 error, get the response body
        if (responseDetails.status === 400) {
          try {
            const response = await page.waitForResponse(response => 
              response.url().includes('/comments') && 
              response.request().method() === 'POST',
              { timeout: 1000 }
            );
            const responseBody = await response.text();
            console.log('  ❌ ERROR BODY:', responseBody);
          } catch (e) {
            console.log('  Could not capture error body');
          }
        }
      }

    } else {
      console.log('⚠️ Reply input not found, checking for other interaction elements...');
      
      // Look for other comment interaction elements
      const commentActions = page.locator('button[data-testid*="comment"], .comment-actions button');
      const actionCount = await commentActions.count();
      console.log(`Found ${actionCount} comment action elements`);
      
      if (actionCount > 0) {
        // Try clicking the first action (might be reply)
        await commentActions.first().click();
        await page.waitForTimeout(2000); // Wait for any modal or input to appear
        
        // Now look for reply input again
        const modalReplyInput = page.locator('textarea, input[type="text"]').last();
        if (await modalReplyInput.isVisible()) {
          await modalReplyInput.fill('Test reply from modal');
          await page.locator('button:has-text("Submit"), button:has-text("Reply")').click();
        }
      }
    }

    // Step 13: Final state capture
    console.log('📊 Step 13: Final state capture...');
    
    // Take screenshot for visual debugging
    await page.screenshot({ path: 'tests/debug-screenshot.png', fullPage: true });
    
    // Capture final network activity
    await page.waitForTimeout(3000);
    
    console.log('🏁 Debug test completed');
  });

  test('Direct API authentication test', async () => {
    console.log('🔬 Testing direct API authentication...');
    
    // First login through UI to get session
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Login if needed
    const loginButton = page.locator('button:has-text("Login"), a:has-text("Login")');
    if (await loginButton.isVisible()) {
      await loginButton.click();
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await page.fill('input[type="email"]', 'cuongtranhung@gmail.com');
      await page.fill('input[type="password"]', '@Abcd6789');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
    }

    // Get cookies after login
    const cookies = await context.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    console.log('🍪 Cookies for API test:', cookieString);

    // Test direct API call using evaluate to make fetch request
    const apiTestResult = await page.evaluate(async (cookieHeader) => {
      try {
        console.log('Making direct API call with cookies:', cookieHeader);
        
        const response = await fetch('http://localhost:5000/api/submissions/123866b4-0c6d-448e-b4cb-bb78818de408/comments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader
          },
          credentials: 'include',
          body: JSON.stringify({
            content: 'Direct API test comment',
            parent_id: null
          })
        });

        const responseText = await response.text();
        
        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseText,
          url: response.url
        };
      } catch (error) {
        return {
          error: error.message,
          stack: error.stack
        };
      }
    }, cookieString);

    console.log('🔍 Direct API test result:', JSON.stringify(apiTestResult, null, 2));
  });
});