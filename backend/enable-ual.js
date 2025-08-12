#!/usr/bin/env node

// Enable UAL and test profile update
const { MinimalActivityLogger } = require('./dist/services/minimalActivityLogger');

console.log('🔧 Enabling UAL...');
MinimalActivityLogger.setEnabled(true);
console.log('✅ UAL enabled!');
console.log('Current UAL status:', MinimalActivityLogger.isEnabled());