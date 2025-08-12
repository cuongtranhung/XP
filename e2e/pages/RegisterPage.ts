import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Registration Page
 * 
 * Best Practices:
 * - Encapsulates page interactions
 * - Uses semantic selectors
 * - Provides reusable methods
 * - Includes validation helpers
 */
export class RegisterPage {
  readonly page: Page;
  
  // Form elements using semantic selectors
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly termsCheckbox: Locator;
  readonly submitButton: Locator;
  readonly loginLink: Locator;
  
  // Error message locators
  readonly errorMessages: Locator;
  
  constructor(page: Page) {
    this.page = page;
    
    // Use semantic, accessible selectors
    this.fullNameInput = page.getByRole('textbox', { name: 'Full Name*' });
    this.emailInput = page.getByRole('textbox', { name: 'Email Address*' });
    this.passwordInput = page.getByLabel('Password');
    this.confirmPasswordInput = page.getByLabel('Confirm Password');
    this.termsCheckbox = page.getByRole('checkbox', { name: /Terms of Service/i });
    this.submitButton = page.getByRole('button', { name: /create account/i });
    this.loginLink = page.getByText('Sign in here');
    
    this.errorMessages = page.locator('.text-red-600, .text-red-500');
  }
  
  /**
   * Navigate to registration page
   */
  async goto(): Promise<void> {
    await this.page.goto('/register');
    await this.waitForPageLoad();
  }
  
  /**
   * Wait for page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await expect(this.page.locator('h2')).toContainText('Create Account');
    await expect(this.submitButton).toBeVisible();
  }
  
  /**
   * Fill registration form with provided data
   */
  async fillForm(data: {
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    acceptTerms?: boolean;
  }): Promise<void> {
    if (data.fullName) {
      await this.fullNameInput.fill(data.fullName);
    }
    
    if (data.email) {
      await this.emailInput.fill(data.email);
    }
    
    if (data.password) {
      await this.passwordInput.fill(data.password);
    }
    
    if (data.confirmPassword) {
      await this.confirmPasswordInput.fill(data.confirmPassword);
    }
    
    if (data.acceptTerms) {
      await this.termsCheckbox.check();
    }
  }
  
  /**
   * Submit the registration form
   */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }
  
  /**
   * Fill form and submit with valid data
   */
  async registerUser(userData: {
    fullName: string;
    email: string;
    password: string;
  }): Promise<void> {
    await this.fillForm({
      fullName: userData.fullName,
      email: userData.email,
      password: userData.password,
      confirmPassword: userData.password,
      acceptTerms: true
    });
    
    await this.submit();
  }
  
  /**
   * Get all visible error messages
   */
  async getErrorMessages(): Promise<string[]> {
    const errors = await this.errorMessages.all();
    const messages: string[] = [];
    
    for (const error of errors) {
      const text = await error.textContent();
      if (text) {
        messages.push(text);
      }
    }
    
    return messages;
  }
  
  /**
   * Wait for validation errors to appear
   */
  async waitForValidationErrors(): Promise<void> {
    await this.page.waitForSelector('.text-red-600', { timeout: 5000 });
  }
  
  /**
   * Check if specific error message is visible
   */
  async hasErrorMessage(message: string): Promise<boolean> {
    return await this.page.getByText(message).isVisible();
  }
  
  /**
   * Navigate to login page
   */
  async goToLogin(): Promise<void> {
    await this.loginLink.click();
    await expect(this.page).toHaveURL('/login');
  }
  
  /**
   * Verify page elements are present
   */
  async verifyPageElements(): Promise<void> {
    await expect(this.page).toHaveTitle(/Fullstack Auth App/);
    await expect(this.page.locator('h2')).toContainText('Create Account');
    await expect(this.fullNameInput).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.termsCheckbox).toBeVisible();
    await expect(this.submitButton).toBeVisible();
    await expect(this.loginLink).toBeVisible();
  }
}