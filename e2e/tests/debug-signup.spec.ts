import { test, expect } from '@playwright/test';

test('Debug signup form validation', async ({ page }) => {
  await page.goto('/register');
  
  // Take screenshot of empty form
  await page.screenshot({ path: 'signup-empty-form.png' });
  
  // Submit empty form to see validation errors
  await page.getByRole('button', { name: /create account/i }).click();
  
  // Wait a moment for validation
  await page.waitForTimeout(1000);
  
  // Take screenshot after submission
  await page.screenshot({ path: 'signup-validation-errors.png' });
  
  // Print page content for debugging
  const content = await page.content();
  console.log('Page content after empty form submission:');
  console.log(content.substring(0, 2000));
  
  // Check what error messages actually exist
  const errors = await page.locator('.text-red-600, .text-red-500, [class*="error"]').all();
  console.log(`Found ${errors.length} error elements`);
  
  for (let i = 0; i < errors.length; i++) {
    const text = await errors[i].textContent();
    console.log(`Error ${i + 1}: "${text}"`);
  }
});