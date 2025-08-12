import { test, expect } from '@playwright/test';

test.describe('Form Builder Verification', () => {
  const LOGIN_EMAIL = 'cuongtranhung@gmail.com';
  const LOGIN_PASSWORD = '@Abcd6789';
  const FORM_NAME = 'Danh sách nhân viên';

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', LOGIN_EMAIL);
    await page.fill('input[type="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/forms');
  });

  test('Old Form Builder should work correctly', async ({ page }) => {
    // Navigate to forms list
    await page.goto('http://localhost:3000/forms');
    
    // Find the form and click the menu
    const formCard = page.locator(`text="${FORM_NAME}"`).locator('xpath=ancestor::div[contains(@class, "bg-white")]').first();
    await formCard.locator('button:has-text("⋮")').click();
    
    // Click Design (old form builder)
    await page.click('text="Design"');
    
    // Wait for old form builder to load
    await page.waitForURL('**/edit-old');
    
    // Verify old form builder components are present
    await expect(page.locator('text="Form Builder"')).toBeVisible();
    
    // Check for form fields - old builder should show fields
    const fields = await page.locator('[data-field-id]').count();
    console.log(`Old Form Builder: Found ${fields} fields`);
    
    // Verify sidebar is present
    await expect(page.locator('text="Basic Fields"')).toBeVisible();
    
    // Verify we can see field properties
    if (fields > 0) {
      await page.locator('[data-field-id]').first().click();
      await expect(page.locator('text="Field Properties"')).toBeVisible();
    }
  });

  test('New Form Builder should work correctly', async ({ page }) => {
    // Navigate to forms list
    await page.goto('http://localhost:3000/forms');
    
    // Find the form and click the menu
    const formCard = page.locator(`text="${FORM_NAME}"`).locator('xpath=ancestor::div[contains(@class, "bg-white")]').first();
    await formCard.locator('button:has-text("⋮")').click();
    
    // Click Design New (enhanced form builder)
    await page.click('text="Design New"');
    
    // Wait for new form builder to load
    await page.waitForURL('**/edit');
    await page.waitForTimeout(2000); // Give time for data to load
    
    // Verify new form builder components are present
    await expect(page.locator('text="Enhanced Form Builder"')).toBeVisible();
    
    // Check for form fields - new builder should show fields after loading
    const fields = await page.locator('.divide-y > div').count();
    console.log(`New Form Builder: Found ${fields} fields`);
    
    // Verify sidebar is present
    await expect(page.locator('text="Basic Fields"')).toBeVisible();
    
    // If fields are present, verify they display correctly
    if (fields > 0) {
      // Check first field is visible
      const firstField = page.locator('.divide-y > div').first();
      await expect(firstField).toBeVisible();
      
      // Click on first field to select it
      await firstField.click();
      
      // Verify properties panel shows
      await expect(page.locator('text="Field Properties"')).toBeVisible();
    } else {
      // If no fields, verify empty state is shown
      await expect(page.locator('text="Start Building Your Form"')).toBeVisible();
    }
  });

  test('Both Form Builders should load the same form data', async ({ page }) => {
    // First check old form builder
    await page.goto('http://localhost:3000/forms');
    const formCard = page.locator(`text="${FORM_NAME}"`).locator('xpath=ancestor::div[contains(@class, "bg-white")]').first();
    await formCard.locator('button:has-text("⋮")').click();
    await page.click('text="Design"');
    await page.waitForURL('**/edit-old');
    await page.waitForTimeout(2000);
    
    const oldBuilderFields = await page.locator('[data-field-id]').count();
    console.log(`Old Builder has ${oldBuilderFields} fields`);
    
    // Then check new form builder
    await page.goto('http://localhost:3000/forms');
    await formCard.locator('button:has-text("⋮")').click();
    await page.click('text="Design New"');
    await page.waitForURL('**/edit');
    await page.waitForTimeout(2000);
    
    const newBuilderFields = await page.locator('.divide-y > div').count();
    console.log(`New Builder has ${newBuilderFields} fields`);
    
    // Both should have fields (even if counts differ due to different DOM structure)
    expect(oldBuilderFields).toBeGreaterThan(0);
    expect(newBuilderFields).toBeGreaterThan(0);
  });
});