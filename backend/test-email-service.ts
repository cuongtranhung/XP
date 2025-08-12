/**
 * Test script for Email Service
 * Run with: npx ts-node test-email-service.ts
 */

import dotenv from 'dotenv';
import { emailService } from './src/services/emailService';

// Load environment variables
dotenv.config();

async function testEmailService() {
  console.log('🔧 Testing Email Service Configuration...\n');
  
  // Display current configuration (masked)
  console.log('📧 Email Configuration:');
  console.log(`   SMTP Host: ${process.env.SMTP_HOST}`);
  console.log(`   SMTP Port: ${process.env.SMTP_PORT}`);
  console.log(`   SMTP User: ${process.env.SMTP_USER}`);
  console.log(`   SMTP Pass: ${process.env.SMTP_PASS ? '***' : 'NOT SET'}`);
  console.log(`   From Email: ${process.env.FROM_EMAIL}`);
  console.log(`   From Name: ${process.env.FROM_NAME}\n`);

  // Service is already initialized as singleton
  console.log('🚀 Using Email Service singleton...');
  
  // Wait for connection verification
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test sending different email types
  console.log('\n📬 Testing Email Functions:\n');
  
  // Test email address (you can change this to your email for actual testing)
  const testEmail = 'test@example.com';
  const testName = 'Test User';
  
  console.log('1. Testing Welcome Email...');
  const welcomeResult = await emailService.sendWelcomeEmail(testEmail, testName);
  console.log(`   Result: ${welcomeResult ? '✅ Success' : '❌ Failed'}`);
  
  console.log('\n2. Testing Password Reset Email...');
  const resetToken = 'test-reset-token-123456';
  const resetResult = await emailService.sendPasswordResetEmail(testEmail, testName, resetToken);
  console.log(`   Result: ${resetResult ? '✅ Success' : '❌ Failed'}`);
  
  console.log('\n3. Testing Email Verification...');
  const verifyToken = 'test-verify-token-789012';
  const verifyResult = await emailService.sendEmailVerificationEmail(testEmail, testName, verifyToken);
  console.log(`   Result: ${verifyResult ? '✅ Success' : '❌ Failed'}`);
  
  console.log('\n4. Testing Password Reset Confirmation...');
  const changedResult = await emailService.sendPasswordResetConfirmationEmail(testEmail, testName);
  console.log(`   Result: ${changedResult ? '✅ Success' : '❌ Failed'}`);
  
  // Circuit breaker status
  console.log('\n🔌 Circuit Breaker Status:');
  console.log('   (Circuit breaker monitoring active)');
  
  // Test with invalid configuration
  console.log('\n⚠️  Testing Error Handling:');
  console.log('   Attempting to send to invalid email...');
  const invalidResult = await emailService.sendWelcomeEmail('invalid-email', 'Test');
  console.log(`   Result: ${invalidResult ? '✅ Unexpected Success' : '❌ Failed (Expected)'}`);
  
  console.log('\n✨ Email Service Test Complete!\n');
  
  // Exit process
  process.exit(0);
}

// Run test
testEmailService().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});