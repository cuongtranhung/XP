/**
 * End-to-End Tests for Multi-User Workflow
 * Tests complete user journeys and real-world scenarios
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Multi-User Form Builder Workflow', () => {
  let ownerPage: Page;
  let userPage: Page;
  let formId: string;
  let formName: string;

  test.beforeAll(async ({ browser }) => {
    // Create two browser contexts for different users
    const ownerContext = await browser.newContext();
    const userContext = await browser.newContext();
    
    ownerPage = await ownerContext.newPage();
    userPage = await userContext.newPage();
    
    formName = `Test Form ${Date.now()}`;
  });

  test.afterAll(async () => {
    await ownerPage.close();
    await userPage.close();
  });

  test('Complete multi-user workflow', async () => {
    // Step 1: Form Owner logs in and creates a form
    await test.step('Form owner creates and publishes a form', async () => {
      await ownerPage.goto('/login');
      
      // Login as form owner
      await ownerPage.fill('[data-testid="email-input"]', 'owner@test.com');
      await ownerPage.fill('[data-testid="password-input"]', 'owner123');
      await ownerPage.click('[data-testid="login-button"]');
      
      // Wait for login to complete
      await expect(ownerPage).toHaveURL('/forms');
      
      // Create new form
      await ownerPage.click('[data-testid="create-form-button"]');
      
      // Fill form details
      await ownerPage.fill('[data-testid="form-name-input"]', formName);
      await ownerPage.fill('[data-testid="form-description-input"]', 'A test form for multi-user workflow');
      
      // Add form fields
      await ownerPage.click('[data-testid="add-field-button"]');
      await ownerPage.selectOption('[data-testid="field-type-select"]', 'text');
      await ownerPage.fill('[data-testid="field-label-input"]', 'Full Name');
      await ownerPage.click('[data-testid="field-required-checkbox"]');
      await ownerPage.click('[data-testid="save-field-button"]');
      
      // Add email field
      await ownerPage.click('[data-testid="add-field-button"]');
      await ownerPage.selectOption('[data-testid="field-type-select"]', 'email');
      await ownerPage.fill('[data-testid="field-label-input"]', 'Email Address');
      await ownerPage.click('[data-testid="field-required-checkbox"]');
      await ownerPage.click('[data-testid="save-field-button"]');
      
      // Save and publish form
      await ownerPage.click('[data-testid="save-form-button"]');
      await ownerPage.click('[data-testid="publish-form-button"]');
      
      // Confirm publication
      await ownerPage.click('[data-testid="confirm-publish-button"]');
      
      // Verify form is published
      await expect(ownerPage.locator('[data-testid="form-status"]')).toContainText('Published');
      
      // Extract form ID from URL
      const url = ownerPage.url();
      const match = url.match(/\/forms\/([a-f0-9-]+)/);
      if (match) {
        formId = match[1];
      }
    });

    // Step 2: Other user logs in and sees the form
    await test.step('Other user can view the published form', async () => {
      await userPage.goto('/login');
      
      // Login as other user
      await userPage.fill('[data-testid="email-input"]', 'user@test.com');
      await userPage.fill('[data-testid="password-input"]', 'user123');
      await userPage.click('[data-testid="login-button"]');
      
      // Wait for login to complete
      await expect(userPage).toHaveURL('/forms');
      
      // Check that the published form is visible
      await expect(userPage.locator(`[data-testid="form-card-${formId}"]`)).toBeVisible();
      await expect(userPage.locator(`[data-testid="form-name-${formId}"]`)).toContainText(formName);
      
      // Verify ownership indicator
      await expect(userPage.locator(`[data-testid="form-owner-${formId}"]`)).toContainText('owner@test.com');
      await expect(userPage.locator(`[data-testid="ownership-badge-${formId}"]`)).toContainText('Other User');
    });

    // Step 3: Other user submits to the form
    await test.step('Other user submits form data', async () => {
      // Click on the form to view it
      await userPage.click(`[data-testid="form-card-${formId}"]`);
      
      // Fill form submission
      await userPage.fill('[data-testid="form-field-full-name"]', 'John Doe');
      await userPage.fill('[data-testid="form-field-email-address"]', 'john.doe@example.com');
      
      // Submit the form
      await userPage.click('[data-testid="submit-form-button"]');
      
      // Verify submission success
      await expect(userPage.locator('[data-testid="submission-success"]')).toBeVisible();
      await expect(userPage.locator('[data-testid="submission-success"]')).toContainText('Form submitted successfully');
    });

    // Step 4: Other user views submissions (should only see their own)
    await test.step('Other user can only see their own submissions', async () => {
      // Navigate to form submissions
      await userPage.click('[data-testid="view-submissions-button"]');
      
      // Verify access type is limited
      await expect(userPage.locator('[data-testid="access-type-banner"]')).toContainText('Limited Access');
      await expect(userPage.locator('[data-testid="access-description"]')).toContainText('You can only view your own submissions');
      
      // Check submissions table
      await expect(userPage.locator('[data-testid="submissions-table"]')).toBeVisible();
      await expect(userPage.locator('[data-testid="submission-row"]')).toHaveCount(1);
      
      // Verify the submission data
      await expect(userPage.locator('[data-testid="submission-data-full-name"]')).toContainText('John Doe');
      await expect(userPage.locator('[data-testid="submission-data-email-address"]')).toContainText('john.doe@example.com');
      
      // Verify export is not available
      await expect(userPage.locator('[data-testid="export-button"]')).not.toBeVisible();
    });

    // Step 5: Form owner sees all submissions
    await test.step('Form owner can see all submissions with full access', async () => {
      // Switch back to owner page
      await ownerPage.goto(`/forms/${formId}/submissions`);
      
      // Verify access type is full
      await expect(ownerPage.locator('[data-testid="access-type-banner"]')).toContainText('Full Access');
      await expect(ownerPage.locator('[data-testid="access-description"]')).toContainText('You can view all submissions');
      
      // Check submissions table
      await expect(ownerPage.locator('[data-testid="submissions-table"]')).toBeVisible();
      await expect(ownerPage.locator('[data-testid="submission-row"]')).toHaveCount(1);
      
      // Verify owner can see submitter information
      await expect(ownerPage.locator('[data-testid="submission-submitter"]')).toContainText('user@test.com');
      
      // Verify export functionality is available
      await expect(ownerPage.locator('[data-testid="export-button"]')).toBeVisible();
      await expect(ownerPage.locator('[data-testid="import-button"]')).toBeVisible();
    });

    // Step 6: Other user clones the form
    await test.step('Other user can clone the published form', async () => {
      // Go back to forms list
      await userPage.goto('/forms');
      
      // Click on form options menu
      await userPage.click(`[data-testid="form-menu-${formId}"]`);
      
      // Click clone option
      await userPage.click(`[data-testid="clone-form-${formId}"]`);
      
      // Fill clone dialog
      await userPage.fill('[data-testid="clone-form-name"]', `${formName} - Cloned`);
      await userPage.click('[data-testid="confirm-clone-button"]');
      
      // Wait for clone to complete
      await expect(userPage.locator('[data-testid="clone-success"]')).toBeVisible();
      
      // Verify cloned form appears in list
      await expect(userPage.locator(`[data-testid*="form-name"]`)).toContainText(`${formName} - Cloned`);
      
      // Verify user is owner of cloned form
      const clonedFormCard = userPage.locator(`text="${formName} - Cloned"`).locator('..').locator('..');
      await expect(clonedFormCard.locator('[data-testid*="ownership-badge"]')).toContainText('Your Form');
    });

    // Step 7: Verify public statistics
    await test.step('Public statistics are available to all users', async () => {
      // Check public stats as non-owner
      await userPage.goto(`/forms/${formId}/public-stats`);
      
      // Verify public stats are displayed
      await expect(userPage.locator('[data-testid="public-stats-container"]')).toBeVisible();
      await expect(userPage.locator('[data-testid="total-submissions"]')).toContainText('1');
      await expect(userPage.locator('[data-testid="completion-rate"]')).toBeVisible();
      
      // Verify sensitive data is not exposed
      await expect(userPage.locator('[data-testid="submission-details"]')).not.toBeVisible();
      await expect(userPage.locator('[data-testid="user-data"]')).not.toBeVisible();
    });

    // Step 8: Test permissions restrictions
    await test.step('Verify permission restrictions are enforced', async () => {
      // Try to edit form as non-owner (should fail)
      await userPage.goto(`/forms/${formId}/edit`);
      await expect(userPage.locator('[data-testid="permission-denied"]')).toBeVisible();
      await expect(userPage.locator('[data-testid="error-message"]')).toContainText('You do not have permission to edit this form');
      
      // Try to delete form as non-owner (should not show delete option)
      await userPage.goto('/forms');
      await userPage.click(`[data-testid="form-menu-${formId}"]`);
      await expect(userPage.locator(`[data-testid="delete-form-${formId}"]`)).not.toBeVisible();
    });

    // Step 9: Test form filtering
    await test.step('Form filtering works correctly', async () => {
      await userPage.goto('/forms');
      
      // Filter to show only own forms
      await userPage.selectOption('[data-testid="ownership-filter"]', 'mine');
      
      // Should see only cloned form
      await expect(userPage.locator('[data-testid="form-card"]')).toHaveCount(1);
      await expect(userPage.locator(`[data-testid*="form-name"]`)).toContainText(`${formName} - Cloned`);
      
      // Filter to show others' forms
      await userPage.selectOption('[data-testid="ownership-filter"]', 'others');
      
      // Should see only original form
      await expect(userPage.locator('[data-testid="form-card"]')).toHaveCount(1);
      await expect(userPage.locator(`[data-testid*="form-name"]`)).toContainText(formName);
      await expect(userPage.locator(`[data-testid*="form-name"]`)).not.toContainText('Cloned');
      
      // Show all forms
      await userPage.selectOption('[data-testid="ownership-filter"]', 'all');
      await expect(userPage.locator('[data-testid="form-card"]')).toHaveCount(2);
    });

    // Step 10: Security validation
    await test.step('Security measures are working', async () => {
      // Test XSS prevention in form creation
      await ownerPage.goto('/forms/new');
      
      const maliciousScript = '<script>alert("xss")</script>Malicious Form';
      await ownerPage.fill('[data-testid="form-name-input"]', maliciousScript);
      await ownerPage.click('[data-testid="save-form-button"]');
      
      // Should show error for malicious content
      await expect(ownerPage.locator('[data-testid="error-message"]')).toContainText('Invalid content');
      
      // Test rate limiting (if applicable in UI)
      // This would require multiple rapid requests which might be difficult in E2E
      // Could be covered better in API tests
    });
  });

  test('Mobile responsiveness', async ({ browser }) => {
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 } // iPhone size
    });
    const mobilePage = await mobileContext.newPage();

    await test.step('Mobile form viewing works correctly', async () => {
      await mobilePage.goto('/login');
      
      // Login on mobile
      await mobilePage.fill('[data-testid="email-input"]', 'user@test.com');
      await mobilePage.fill('[data-testid="password-input"]', 'user123');
      await mobilePage.click('[data-testid="login-button"]');
      
      // Check forms list is mobile-friendly
      await expect(mobilePage).toHaveURL('/forms');
      await expect(mobilePage.locator('[data-testid="forms-grid"]')).toBeVisible();
      
      // Verify mobile menu works
      await mobilePage.click('[data-testid="mobile-menu-toggle"]');
      await expect(mobilePage.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      // Test form submission on mobile
      if (formId) {
        await mobilePage.goto(`/forms/${formId}`);
        await expect(mobilePage.locator('[data-testid="mobile-form-container"]')).toBeVisible();
        
        // Fill and submit form on mobile
        await mobilePage.fill('[data-testid="form-field-full-name"]', 'Mobile User');
        await mobilePage.fill('[data-testid="form-field-email-address"]', 'mobile@test.com');
        await mobilePage.click('[data-testid="submit-form-button"]');
        
        await expect(mobilePage.locator('[data-testid="submission-success"]')).toBeVisible();
      }
    });

    await mobileContext.close();
  });

  test('Accessibility compliance', async ({ page }) => {
    await test.step('Forms are accessible', async () => {
      await page.goto('/forms');
      
      // Check for proper heading structure
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);
      
      // Check for alt text on images
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const alt = await images.nth(i).getAttribute('alt');
        expect(alt).toBeTruthy();
      }
      
      // Check for proper form labels
      const inputs = page.locator('input[type="text"], input[type="email"], textarea, select');
      const inputCount = await inputs.count();
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const label = page.locator(`label[for="${id}"]`);
        
        if (id) {
          await expect(label).toBeVisible();
        }
      }
      
      // Check for keyboard navigation
      await page.keyboard.press('Tab');
      const activeElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA']).toContain(activeElement);
    });
  });
});