/**
 * E2E tests for Form Builder workflows
 */

import { test, expect, Page } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:5000';

// Test user credentials
const testUser = {
  email: `test-${uuidv4()}@example.com`,
  password: 'Test123456!',
  name: 'Test User',
};

// Helper functions
async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

async function createTestUser(page: Page) {
  await page.goto(`${BASE_URL}/register`);
  await page.fill('input[name="name"]', testUser.name);
  await page.fill('input[name="email"]', testUser.email);
  await page.fill('input[name="password"]', testUser.password);
  await page.fill('input[name="confirmPassword"]', testUser.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

test.describe('Form Builder E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Create and login test user
    await createTestUser(page);
  });

  test('should create a new form with multiple field types', async ({ page }) => {
    // Navigate to form builder
    await page.click('a[href="/forms/new"]');
    await page.waitForURL(`${BASE_URL}/forms/new`);

    // Set form title and description
    await page.fill('input[placeholder="Untitled Form"]', 'Contact Form');
    await page.fill('textarea[placeholder="Add a description..."]', 'Please fill out this form to contact us');

    // Add text field
    await page.click('button:has-text("Text Input")');
    await page.click('.form-field:last-child');
    await page.fill('input[name="label"]', 'Full Name');
    await page.fill('input[name="key"]', 'full_name');
    await page.check('input[name="required"]');

    // Add email field
    await page.click('button:has-text("Email")');
    await page.click('.form-field:last-child');
    await page.fill('input[name="label"]', 'Email Address');
    await page.fill('input[name="key"]', 'email_address');
    await page.check('input[name="required"]');

    // Add textarea field
    await page.click('button:has-text("Textarea")');
    await page.click('.form-field:last-child');
    await page.fill('input[name="label"]', 'Message');
    await page.fill('input[name="key"]', 'message');
    await page.fill('input[name="placeholder"]', 'Enter your message here...');
    await page.check('input[name="required"]');

    // Save form
    await page.click('button:has-text("Save")');
    await page.waitForSelector('text=Form saved successfully');

    // Verify form was created
    expect(page.url()).toMatch(/\/forms\/[a-f0-9-]+\/edit$/);
  });

  test('should preview and test form submission', async ({ page }) => {
    // Create a simple form first
    await page.goto(`${BASE_URL}/forms/new`);
    await page.fill('input[placeholder="Untitled Form"]', 'Test Form');
    
    // Add fields
    await page.click('button:has-text("Text Input")');
    await page.click('.form-field:last-child');
    await page.fill('input[name="label"]', 'Name');
    await page.check('input[name="required"]');

    await page.click('button:has-text("Email")');
    await page.click('.form-field:last-child');
    await page.fill('input[name="label"]', 'Email');
    await page.check('input[name="required"]');

    // Save form
    await page.click('button:has-text("Save")');
    await page.waitForSelector('text=Form saved successfully');

    // Switch to preview mode
    await page.click('button:has-text("Preview")');
    await page.waitForSelector('h2:has-text("Form Preview")');

    // Test form validation
    await page.click('button:has-text("Submit")');
    await expect(page.locator('text=Name is required')).toBeVisible();
    await expect(page.locator('text=Email is required')).toBeVisible();

    // Fill form correctly
    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="email"]', 'john@example.com');
    await page.click('button:has-text("Submit")');

    // Verify submission success
    await expect(page.locator('text=Thank you for your submission!')).toBeVisible();
  });

  test('should handle conditional logic', async ({ page }) => {
    await page.goto(`${BASE_URL}/forms/new`);
    await page.fill('input[placeholder="Untitled Form"]', 'Conditional Logic Form');

    // Add radio field
    await page.click('button:has-text("Radio")');
    await page.click('.form-field:last-child');
    await page.fill('input[name="label"]', 'Are you a student?');
    await page.fill('input[name="key"]', 'is_student');
    
    // Add radio options
    await page.click('button:has-text("Add Option")');
    await page.fill('.option-input:nth-child(1) input[name="label"]', 'Yes');
    await page.fill('.option-input:nth-child(1) input[name="value"]', 'yes');
    
    await page.click('button:has-text("Add Option")');
    await page.fill('.option-input:nth-child(2) input[name="label"]', 'No');
    await page.fill('.option-input:nth-child(2) input[name="value"]', 'no');

    // Add text field with conditional logic
    await page.click('button:has-text("Text Input")');
    await page.click('.form-field:last-child');
    await page.fill('input[name="label"]', 'School Name');
    await page.fill('input[name="key"]', 'school_name');
    
    // Enable conditional logic
    await page.check('input[name="enableConditionalLogic"]');
    await page.selectOption('select[name="conditionalField"]', 'is_student');
    await page.selectOption('select[name="conditionalOperator"]', 'equals');
    await page.selectOption('select[name="conditionalValue"]', 'yes');

    // Save and preview
    await page.click('button:has-text("Save")');
    await page.waitForSelector('text=Form saved successfully');
    await page.click('button:has-text("Preview")');

    // Test conditional logic
    expect(await page.isVisible('label:has-text("School Name")')).toBe(false);
    
    await page.check('input[value="yes"]');
    expect(await page.isVisible('label:has-text("School Name")')).toBe(true);
    
    await page.check('input[value="no"]');
    expect(await page.isVisible('label:has-text("School Name")')).toBe(false);
  });

  test('should duplicate and manage forms', async ({ page }) => {
    // Create a form
    await page.goto(`${BASE_URL}/forms/new`);
    await page.fill('input[placeholder="Untitled Form"]', 'Original Form');
    await page.click('button:has-text("Text Input")');
    await page.click('button:has-text("Save")');
    await page.waitForSelector('text=Form saved successfully');

    // Go to forms list
    await page.goto(`${BASE_URL}/forms`);
    
    // Duplicate the form
    await page.click('.form-card:has-text("Original Form") button[aria-label="More options"]');
    await page.click('button:has-text("Duplicate")');
    await page.waitForSelector('text=Form duplicated successfully');

    // Verify duplicate exists
    await expect(page.locator('.form-card:has-text("Original Form (Copy)")')).toBeVisible();

    // Delete the duplicate
    await page.click('.form-card:has-text("Original Form (Copy)") button[aria-label="More options"]');
    await page.click('button:has-text("Delete")');
    await page.click('button:has-text("Confirm Delete")');
    await page.waitForSelector('text=Form deleted successfully');

    // Verify duplicate is gone
    await expect(page.locator('.form-card:has-text("Original Form (Copy)")')).not.toBeVisible();
  });

  test('should export form submissions', async ({ page }) => {
    // Create and publish a form
    await page.goto(`${BASE_URL}/forms/new`);
    await page.fill('input[placeholder="Untitled Form"]', 'Export Test Form');
    
    await page.click('button:has-text("Text Input")');
    await page.click('.form-field:last-child');
    await page.fill('input[name="label"]', 'Name');

    await page.click('button:has-text("Save")');
    await page.waitForSelector('text=Form saved successfully');
    
    await page.click('button:has-text("Publish")');
    await page.waitForSelector('text=Form published successfully');

    // Get form URL and submit some data
    const formUrl = page.url().replace('/edit', '/submit');
    
    // Submit form multiple times
    for (let i = 1; i <= 3; i++) {
      await page.goto(formUrl);
      await page.fill('input[name="name"]', `Test User ${i}`);
      await page.click('button:has-text("Submit")');
      await page.waitForSelector('text=Thank you for your submission!');
    }

    // Go to submissions page
    await page.goto(page.url().replace('/submit', '/submissions'));

    // Export as CSV
    await page.click('button:has-text("Export")');
    await page.click('button:has-text("Export as CSV")');
    
    // Wait for download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Download CSV")'),
    ]);

    // Verify download
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should handle form validation rules', async ({ page }) => {
    await page.goto(`${BASE_URL}/forms/new`);
    await page.fill('input[placeholder="Untitled Form"]', 'Validation Test Form');

    // Add text field with validation
    await page.click('button:has-text("Text Input")');
    await page.click('.form-field:last-child');
    await page.fill('input[name="label"]', 'Username');
    await page.fill('input[name="minLength"]', '3');
    await page.fill('input[name="maxLength"]', '20');
    await page.fill('input[name="pattern"]', '^[a-zA-Z0-9_]+$');

    // Add number field with validation
    await page.click('button:has-text("Number")');
    await page.click('.form-field:last-child');
    await page.fill('input[name="label"]', 'Age');
    await page.fill('input[name="min"]', '18');
    await page.fill('input[name="max"]', '100');

    // Save and preview
    await page.click('button:has-text("Save")');
    await page.waitForSelector('text=Form saved successfully');
    await page.click('button:has-text("Preview")');

    // Test validations
    await page.fill('input[name="username"]', 'ab');
    await page.fill('input[name="age"]', '15');
    await page.click('button:has-text("Submit")');

    await expect(page.locator('text=Must be at least 3 characters')).toBeVisible();
    await expect(page.locator('text=Must be at least 18')).toBeVisible();

    // Test pattern validation
    await page.fill('input[name="username"]', 'user@name');
    await page.click('button:has-text("Submit")');
    await expect(page.locator('text=Invalid format')).toBeVisible();

    // Fill correctly
    await page.fill('input[name="username"]', 'john_doe');
    await page.fill('input[name="age"]', '25');
    await page.click('button:has-text("Submit")');
    await expect(page.locator('text=Thank you for your submission!')).toBeVisible();
  });

  test('should handle real-time collaboration', async ({ page, browser }) => {
    // Create a form
    await page.goto(`${BASE_URL}/forms/new`);
    await page.fill('input[placeholder="Untitled Form"]', 'Collaboration Test');
    await page.click('button:has-text("Save")');
    await page.waitForSelector('text=Form saved successfully');
    
    const formUrl = page.url();

    // Open second browser session
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    // Login as same user in second session
    await login(page2, testUser.email, testUser.password);
    await page2.goto(formUrl);

    // Add field in first session
    await page.click('button:has-text("Text Input")');
    
    // Verify field appears in second session
    await page2.waitForSelector('.form-field:has-text("Text Field")');

    // Edit field in second session
    await page2.click('.form-field:has-text("Text Field")');
    await page2.fill('input[name="label"]', 'Collaborative Field');

    // Verify change appears in first session
    await page.waitForSelector('.form-field:has-text("Collaborative Field")');

    // Check collaboration indicators
    await expect(page.locator('.collaborator-presence')).toBeVisible();
    await expect(page2.locator('.collaborator-presence')).toBeVisible();

    await context2.close();
  });

  test('should handle file upload fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/forms/new`);
    await page.fill('input[placeholder="Untitled Form"]', 'File Upload Test');

    // Add file upload field
    await page.click('button:has-text("File Upload")');
    await page.click('.form-field:last-child');
    await page.fill('input[name="label"]', 'Resume');
    await page.fill('input[name="allowedTypes"]', 'pdf,doc,docx');
    await page.fill('input[name="maxSize"]', '5');

    // Save and preview
    await page.click('button:has-text("Save")');
    await page.waitForSelector('text=Form saved successfully');
    await page.click('button:has-text("Preview")');

    // Test file upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('PDF content'),
    });

    // Verify file is selected
    await expect(page.locator('text=test.pdf')).toBeVisible();
  });
});