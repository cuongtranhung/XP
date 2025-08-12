#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript/React files
const files = glob.sync('src/**/*.{ts,tsx}', {
  ignore: ['src/components/icons/index.ts']
});

let totalReplaced = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  
  // Match import statements from 'lucide-react'
  const importRegex = /import\s*{([^}]+)}\s*from\s*['"]lucide-react['"]/g;
  
  if (importRegex.test(content)) {
    // Replace with optimized import
    content = content.replace(importRegex, (match, icons) => {
      totalReplaced++;
      // Calculate relative path from file to icons/index
      const fromPath = path.dirname(file);
      const toPath = 'src/components/icons';
      let relativePath = path.relative(fromPath, toPath);
      
      // Convert to forward slashes and ensure it starts with ./
      relativePath = relativePath.replace(/\\/g, '/');
      if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath;
      }
      
      return `import {${icons}} from '${relativePath}'`;
    });
    
    if (content !== originalContent) {
      fs.writeFileSync(file, content);
      console.log(`✅ Updated: ${file}`);
    }
  }
});

console.log(`\n🎉 Optimization complete! Replaced ${totalReplaced} import statements.`);
console.log('📦 This should reduce bundle size by ~200-300KB\n');