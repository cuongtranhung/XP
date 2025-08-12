import { test, expect } from '@playwright/test';

test('Debug login với user cuongtranhung@gmail.com', async ({ page }) => {
  // Listen for network requests
  page.on('request', request => {
    if (request.url().includes('/api/auth')) {
      console.log('>> Request:', request.method(), request.url());
      console.log('   Headers:', request.headers());
      console.log('   Post data:', request.postData());
    }
  });

  page.on('response', response => {
    if (response.url().includes('/api/auth')) {
      console.log('<< Response:', response.status(), response.url());
      response.text().then(body => {
        console.log('   Body:', body);
      }).catch(() => {});
    }
  });

  // Navigate to login page
  console.log('1. Đang truy cập trang login...');
  await page.goto('http://localhost:3000/login');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  console.log('2. Trang login đã tải xong');
  
  // Fill login form
  console.log('3. Điền thông tin đăng nhập...');
  await page.fill('input[type="email"]', 'cuongtranhung@gmail.com');
  await page.fill('input[type="password"]', '@Abcd6789');
  
  // Click submit button
  console.log('4. Click nút Sign In...');
  await page.click('button[type="submit"]');
  
  // Wait for response
  await page.waitForTimeout(5000);
  
  // Check result
  const currentUrl = page.url();
  console.log('5. URL hiện tại:', currentUrl);
  
  // Check for any error messages
  const errorElements = await page.$$('.text-red-500, .text-red-600, .error-message, [role="alert"]');
  for (const element of errorElements) {
    const text = await element.textContent();
    if (text && text.trim()) {
      console.log('Error found:', text);
    }
  }

  // Check console logs
  const consoleLogs = await page.evaluate(() => {
    return (window as any).consoleLogs || [];
  });
  
  if (consoleLogs.length > 0) {
    console.log('Console logs:', consoleLogs);
  }
});