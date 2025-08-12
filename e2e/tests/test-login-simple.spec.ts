import { test, expect } from '@playwright/test';

test('Login với user cuongtranhung@gmail.com', async ({ page }) => {
  // Navigate to login page
  console.log('1. Đang truy cập trang login...');
  await page.goto('http://localhost:3000/login');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  console.log('2. Trang login đã tải xong');
  
  // Take screenshot
  await page.screenshot({ path: 'login-page.png' });
  
  // Fill login form
  console.log('3. Điền thông tin đăng nhập...');
  await page.fill('input[type="email"]', 'cuongtranhung@gmail.com');
  await page.fill('input[type="password"]', '@Abcd6789');
  
  // Take screenshot after filling
  await page.screenshot({ path: 'login-filled.png' });
  
  // Click submit button
  console.log('4. Click nút Sign In...');
  await page.click('button[type="submit"]');
  
  // Wait for response
  await page.waitForTimeout(3000);
  
  // Check result
  const currentUrl = page.url();
  console.log('5. URL hiện tại:', currentUrl);
  
  if (currentUrl.includes('/dashboard')) {
    console.log('✅ LOGIN THÀNH CÔNG - Đã chuyển đến dashboard');
    await page.screenshot({ path: 'dashboard.png' });
  } else if (currentUrl.includes('/login')) {
    console.log('❌ LOGIN THẤT BẠI - Vẫn ở trang login');
    
    // Check for error messages
    const errorElement = await page.$('.text-red-500, .text-red-600, .error-message');
    if (errorElement) {
      const errorText = await errorElement.textContent();
      console.log('Lỗi:', errorText);
    }
    await page.screenshot({ path: 'login-failed.png' });
  } else {
    console.log('📍 Đã chuyển đến:', currentUrl);
    await page.screenshot({ path: 'after-login.png' });
  }
});