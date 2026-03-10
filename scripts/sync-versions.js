#!/usr/bin/env node
const fs = require('fs');
const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/sync-versions.js <version>');
  process.exit(1);
}

const files = [
  'package.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/shared/package.json',
];

for (const file of files) {
  try {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    pkg.version = version;
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ${file} → ${version}`);
  } catch {
    // skip missing files
  }
}
