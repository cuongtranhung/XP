import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

// Circuit breaker implementation
interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

class CircuitBreaker {
  private static instance: CircuitBreaker;
  private state: CircuitBreakerState = {
    state: 'CLOSED',
    failureCount: 0,
    lastFailureTime: 0,
    successCount: 0
  };
  
  private readonly failureThreshold = 5; // failures before opening
  private readonly recoveryTimeout = 30000; // 30 seconds
  private readonly successThreshold = 2; // successes before closing from half-open

  static getInstance(): CircuitBreaker {
    if (!CircuitBreaker.instance) {
      CircuitBreaker.instance = new CircuitBreaker();
    }
    return CircuitBreaker.instance;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.state === 'OPEN') {
      if (Date.now() - this.state.lastFailureTime < this.recoveryTimeout) {
        throw new Error('Circuit breaker is OPEN - operation blocked');
      } else {
        this.state.state = 'HALF_OPEN';
        this.state.successCount = 0;
        logger.info('Circuit breaker moving to HALF_OPEN state');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.state.failureCount = 0;
    
    if (this.state.state === 'HALF_OPEN') {
      this.state.successCount++;
      if (this.state.successCount >= this.successThreshold) {
        this.state.state = 'CLOSED';
        logger.info('Circuit breaker CLOSED - service recovered');
      }
    }
  }

  private onFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    
    if (this.state.state === 'HALF_OPEN') {
      this.state.state = 'OPEN';
      logger.warn('Circuit breaker OPEN - service still failing');
    } else if (this.state.failureCount >= this.failureThreshold) {
      this.state.state = 'OPEN';
      logger.warn(`Circuit breaker OPEN - ${this.state.failureCount} consecutive failures`);
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = CircuitBreaker.getInstance();
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,   // 10 seconds
      socketTimeout: 15000     // 15 seconds
    });

    // Verify connection configuration
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    // Skip email verification in development to avoid startup delays
    if (process.env.NODE_ENV === 'development') {
      logger.info('📧 Email service verification skipped in development mode');
      return;
    }

    try {
      await this.transporter.verify();
      logger.info('✅ Email service connected successfully');
    } catch (error) {
      logger.error('❌ Email service connection failed', { error });
    }
  }

  // Send email helper with circuit breaker
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<boolean> {
    try {
      const info = await this.circuitBreaker.execute(async () => {
        return await this.transporter.sendMail({
          from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
          to,
          subject,
          html,
          text: text || this.stripHtml(html)
        });
      });

      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: info.messageId,
        circuitBreakerState: this.circuitBreaker.getState().state
      });

      return true;
    } catch (error) {
      const breakerState = this.circuitBreaker.getState();
      logger.error('Failed to send email', {
        to,
        subject,
        error: error instanceof Error ? error.message : 'Unknown error',
        circuitBreakerState: breakerState.state,
        failureCount: breakerState.failureCount
      });
      return false;
    }
  }

  // Strip HTML tags for plain text version
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  }

  // Send welcome email
  async sendWelcomeEmail(email: string, fullName: string): Promise<boolean> {
    const subject = 'Welcome to Our Platform!';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to ${process.env.FROM_NAME}!</h1>
        </div>
        <div class="content">
          <h2>Hello ${fullName}!</h2>
          <p>Thank you for creating an account with us. We're excited to have you on board!</p>
          <p>Your account has been successfully created with the email address: <strong>${email}</strong></p>
          <p>You can now log in and start using our platform.</p>
          <a href="${process.env.FRONTEND_URL}/login" class="button">Login to Your Account</a>
          <p>If you have any questions or need help getting started, don't hesitate to contact our support team.</p>
          <p>Best regards,<br>The ${process.env.FROM_NAME} Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${email}. If you didn't create an account, please ignore this email.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, html);
  }

  // Send password reset email
  async sendPasswordResetEmail(
    email: string,
    fullName: string,
    resetToken: string
  ): Promise<boolean> {
    const subject = 'Password Reset Request';
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hello ${fullName}!</h2>
          <p>We received a request to reset your password for your ${process.env.FROM_NAME} account.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" class="button">Reset Your Password</a>
          <p>If the button doesn't work, you can copy and paste the following link into your browser:</p>
          <p style="word-break: break-all; color: #4f46e5;">${resetUrl}</p>
          
          <div class="warning">
            <strong>Important:</strong>
            <ul>
              <li>This link will expire in 1 hour for security reasons</li>
              <li>If you didn't request this password reset, you can safely ignore this email</li>
              <li>Your password will not be changed unless you click the link above</li>
            </ul>
          </div>
          
          <p>For security reasons, we recommend choosing a strong password that:</p>
          <ul>
            <li>Is at least 8 characters long</li>
            <li>Contains uppercase and lowercase letters</li>
            <li>Includes at least one number</li>
            <li>Uses special characters</li>
          </ul>
          
          <p>If you need further assistance, please contact our support team.</p>
          <p>Best regards,<br>The ${process.env.FROM_NAME} Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${email}. If you didn't request a password reset, please ignore this email.</p>
          <p>For security, this link will expire in 1 hour.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, html);
  }

  // Send password reset confirmation email
  async sendPasswordResetConfirmationEmail(
    email: string,
    fullName: string
  ): Promise<boolean> {
    const subject = 'Password Successfully Reset';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          .security-note { background: #dbeafe; border: 1px solid #3b82f6; padding: 15px; border-radius: 4px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>✅ Password Successfully Reset</h1>
        </div>
        <div class="content">
          <h2>Hello ${fullName}!</h2>
          <p>This is a confirmation that your password has been successfully reset for your ${process.env.FROM_NAME} account.</p>
          
          <div class="security-note">
            <strong>Security Information:</strong>
            <ul>
              <li>Password reset completed at: ${new Date().toLocaleString()}</li>
              <li>All active sessions have been logged out for security</li>
              <li>All password reset tokens have been invalidated</li>
            </ul>
          </div>
          
          <p>You can now log in with your new password:</p>
          <a href="${process.env.FRONTEND_URL}/login" class="button">Login to Your Account</a>
          
          <p><strong>If you did not reset your password:</strong></p>
          <p>If you did not request this password reset, please contact our support team immediately as your account may have been compromised.</p>
          
          <p>For your security, we recommend:</p>
          <ul>
            <li>Using a unique password that you don't use elsewhere</li>
            <li>Enabling two-factor authentication if available</li>
            <li>Regularly updating your password</li>
            <li>Not sharing your login credentials with anyone</li>
          </ul>
          
          <p>Thank you for keeping your account secure!</p>
          <p>Best regards,<br>The ${process.env.FROM_NAME} Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${email} for security notification purposes.</p>
          <p>If you have concerns about your account security, please contact support immediately.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, html);
  }

  // Send email verification email
  async sendEmailVerificationEmail(
    email: string,
    fullName: string,
    verificationToken: string
  ): Promise<boolean> {
    const subject = 'Please Verify Your Email Address';
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Verify Your Email Address</h1>
        </div>
        <div class="content">
          <h2>Hello ${fullName}!</h2>
          <p>Thank you for signing up with ${process.env.FROM_NAME}! To complete your registration, please verify your email address.</p>
          <p>Click the button below to verify your email:</p>
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
          <p>If the button doesn't work, you can copy and paste the following link into your browser:</p>
          <p style="word-break: break-all; color: #7c3aed;">${verificationUrl}</p>
          <p>This verification link will expire in 24 hours for security reasons.</p>
          <p>If you didn't create an account with us, you can safely ignore this email.</p>
          <p>Best regards,<br>The ${process.env.FROM_NAME} Team</p>
        </div>
        <div class="footer">
          <p>This email was sent to ${email}. If you didn't request this verification, please ignore this email.</p>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(email, subject, html);
  }

  // Test email configuration with circuit breaker
  async testConnection(): Promise<boolean> {
    try {
      await this.circuitBreaker.execute(async () => {
        return await this.transporter.verify();
      });
      return true;
    } catch (error) {
      logger.error('Email connection test failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        circuitBreakerState: this.circuitBreaker.getState().state
      });
      return false;
    }
  }

  // Get circuit breaker status
  getCircuitBreakerStatus(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }
}

// Export singleton instance
export const emailService = new EmailService();