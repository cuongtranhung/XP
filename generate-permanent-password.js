#!/usr/bin/env node

const bcrypt = require('bcryptjs');

async function generatePermanentPasswordHash() {
  console.log('🔐 Generating Permanent Password Hash');
  console.log('=====================================');
  
  const email = 'cuongtranhung@gmail.com';
  const permanentPassword = '@Abcd6789';  // PERMANENT PASSWORD - DO NOT CHANGE
  
  console.log(`Email: ${email}`);
  console.log(`Permanent Password: ${permanentPassword}`);
  console.log('\n⚠️  WARNING: This is the PERMANENT TEST PASSWORD. DO NOT CHANGE IT!');
  
  try {
    // Generate hash with 12 rounds (secure)
    console.log('\n🔧 Generating bcrypt hash...');
    const hash = await bcrypt.hash(permanentPassword, 12);
    
    console.log(`Generated Hash: ${hash}`);
    
    // Verify the hash works
    console.log('\n🧪 Verifying hash...');
    const isValid = await bcrypt.compare(permanentPassword, hash);
    
    if (isValid) {
      console.log('✅ Hash verification successful!');
      
      console.log('\n📝 SQL Command to Update Password:');
      console.log('===================================');
      console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = '${email}';`);
      
      console.log('\n🔑 Test Credentials:');
      console.log('====================');
      console.log(`Email: ${email}`);
      console.log(`Password: ${permanentPassword}`);
      
      console.log('\n⚠️  IMPORTANT NOTES:');
      console.log('• This password is PERMANENT for testing');
      console.log('• DO NOT change this password');
      console.log('• Use for all future tests');
      console.log('• Password: @Abcd6789');
      
      return hash;
    } else {
      console.log('❌ Hash verification failed!');
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

generatePermanentPasswordHash().catch(console.error);