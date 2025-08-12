#!/usr/bin/env node

// Generate bcrypt hash for password update
const bcrypt = require('bcryptjs');

async function generatePasswordHash() {
    const password = '@Abcd6789';
    const saltRounds = 12; // Same as used in the application
    
    try {
        console.log('Generating bcrypt hash for password:', password);
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('\n✅ Generated hash:', hash);
        
        // Test the hash
        const isValid = await bcrypt.compare(password, hash);
        console.log('✅ Hash validation:', isValid ? 'PASS' : 'FAIL');
        
        return hash;
    } catch (error) {
        console.error('❌ Error generating hash:', error);
        throw error;
    }
}

generatePasswordHash().catch(console.error);