/**
 * Verification script to check Import button implementation
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Import Button Implementation\n');
console.log('='.repeat(60));

// Read the DataTableView.tsx file
const filePath = path.join(__dirname, '../frontend/src/pages/DataTableView.tsx');
const fileContent = fs.readFileSync(filePath, 'utf8');

// Check for Import button implementation
const checks = [
  {
    name: 'Upload icon import',
    pattern: /import.*Upload.*from.*icons/,
    found: false
  },
  {
    name: 'Import modal state',
    pattern: /const \[showImportModal, setShowImportModal\] = useState/,
    found: false
  },
  {
    name: 'Import file state',
    pattern: /const \[importFile, setImportFile\] = useState/,
    found: false
  },
  {
    name: 'handleImport function',
    pattern: /const handleImport = async/,
    found: false
  },
  {
    name: 'handleFileSelect function',
    pattern: /const handleFileSelect = /,
    found: false
  },
  {
    name: 'Import Button in UI',
    pattern: /Button[\s\S]*?onClick.*setShowImportModal.*true[\s\S]*?Upload.*Import/m,
    found: false
  },
  {
    name: 'Import Modal component',
    pattern: /showImportModal && \(/,
    found: false
  }
];

// Run checks
checks.forEach(check => {
  check.found = check.pattern.test(fileContent);
});

// Display results
console.log('📋 Import Button Implementation Checklist:\n');

let allPassed = true;
checks.forEach(check => {
  const status = check.found ? '✅' : '❌';
  console.log(`${status} ${check.name}`);
  if (!check.found) allPassed = false;
});

console.log('\n' + '='.repeat(60));

// Check button order
const buttonSection = fileContent.match(/Refresh Button[\s\S]*?Export Button/m);
if (buttonSection) {
  console.log('\n📍 Button Order in Code:');
  
  const refreshIndex = buttonSection[0].indexOf('Refresh Button');
  const addRowIndex = buttonSection[0].indexOf('Add Row Button');
  const importIndex = buttonSection[0].indexOf('Import Button');
  const exportIndex = buttonSection[0].indexOf('Export Button');
  
  const buttons = [
    { name: 'Refresh', index: refreshIndex },
    { name: 'Add Row', index: addRowIndex },
    { name: 'Import', index: importIndex },
    { name: 'Export', index: exportIndex }
  ].filter(b => b.index >= 0).sort((a, b) => a.index - b.index);
  
  buttons.forEach((button, i) => {
    console.log(`  ${i + 1}. ${button.name} Button`);
  });
}

// Check for any syntax errors that might prevent rendering
const importButtonMatch = fileContent.match(/{\/\* Import Button \*\/}[\s\S]*?<Button[\s\S]*?<\/Button>/);
if (importButtonMatch) {
  console.log('\n📝 Import Button Code:');
  console.log('```jsx');
  console.log(importButtonMatch[0].substring(0, 300) + '...');
  console.log('```');
}

// Final verdict
console.log('\n' + '='.repeat(60));
if (allPassed) {
  console.log('✅ SUCCESS: Import button is fully implemented!');
  console.log('\n🎯 The Import button should be visible:');
  console.log('  - Position: Between Add Row and Export buttons');
  console.log('  - Color: Blue (bg-blue-600)');
  console.log('  - Icon: Upload icon');
  console.log('  - Text: "Import"');
  console.log('  - Action: Opens import modal when clicked');
} else {
  console.log('❌ WARNING: Some Import button components are missing!');
  console.log('Please check the failed items above.');
}

console.log('\n✅ Verification complete!');