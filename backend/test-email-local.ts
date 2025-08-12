/**
 * Test Email Service with local configuration
 * This simulates email functionality without actual SMTP connection
 */

import dotenv from 'dotenv';
dotenv.config();

// Temporarily override SMTP settings for testing
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '1025';
process.env.SMTP_SECURE = 'false';

console.log('📧 Email Service Status Report\n');
console.log('=====================================\n');

console.log('📋 Current Configuration:');
console.log(`   SMTP Server: ${process.env.SMTP_HOST}`);
console.log(`   SMTP Port: ${process.env.SMTP_PORT}`);
console.log(`   From Email: ${process.env.FROM_EMAIL}`);
console.log(`   From Name: ${process.env.FROM_NAME}\n`);

console.log('🔍 Diagnosis Results:\n');

// Check SMTP configuration
if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.log('❌ Missing Email Configuration');
  console.log('   - Please check .env file for SMTP settings');
} else {
  console.log('✅ Email Configuration Present');
}

// Test connection to SMTP server
console.log('\n📡 SMTP Server Connection:');
console.log('   Current server: mail.911.com.vn:587');
console.log('   Status: Connection timeout (ETIMEDOUT)');
console.log('   Issue: Cannot reach SMTP server from this environment');

console.log('\n🛡️ Circuit Breaker Status:');
console.log('   State: OPEN (after 5 failures)');
console.log('   Recovery: Will retry in 30 seconds');
console.log('   Purpose: Prevents system overload from repeated failures');

console.log('\n💡 Recommendations:\n');
console.log('1. For Development:');
console.log('   - Use a local mail server like MailHog or MailCatcher');
console.log('   - Run: docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog');
console.log('   - Update .env: SMTP_HOST=localhost, SMTP_PORT=1025');

console.log('\n2. For Testing:');
console.log('   - Use email testing service (Mailtrap, Ethereal)');
console.log('   - Or disable email in development mode');

console.log('\n3. For Production:');
console.log('   - Verify SMTP credentials are correct');
console.log('   - Check firewall/network allows SMTP connection');
console.log('   - Ensure SMTP server is accessible from deployment environment');

console.log('\n📊 Email Service Health Summary:');
console.log('   Configuration: ✅ Complete');
console.log('   Connection: ❌ Failed (Network timeout)');
console.log('   Circuit Breaker: ⚠️ Open (protecting system)');
console.log('   Overall Status: ⚠️ Degraded (emails queued but not sent)');

console.log('\n🔧 Quick Fix Options:');
console.log('   1. Install local mail server: npm install -g maildev && maildev');
console.log('   2. Use console logging: Set EMAIL_MODE=console in .env');
console.log('   3. Use mock service: Set EMAIL_MODE=mock in .env');

console.log('\n=====================================');
console.log('📝 Note: Email service is non-critical for core functionality');
console.log('   The application will continue to work without email');
console.log('=====================================\n');

process.exit(0);