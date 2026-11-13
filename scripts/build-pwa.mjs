#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

console.log('=== Verifying PWA & GitHub Pages Production Bundle ===');

const requiredFiles = [
  'index.html',
  'manifest.json',
  'sw.js',
  'css/style.css',
  'js/ui/app.mjs',
  'js/core/activity.mjs',
  'js/core/calendar-utils.mjs',
  'js/core/store.mjs',
  'js/core/gdrive-sync.mjs',
  'icons/icon.svg'
];

let missing = 0;
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`[FAIL] Missing required static asset: ${file}`);
    missing++;
  } else {
    console.log(`[PASS] ${file}`);
  }
}

if (missing > 0) {
  process.exit(1);
}

console.log('\nRunning automated test suite...');
execSync('npm test', { stdio: 'inherit' });

console.log('\n[SUCCESS] PWA bundle verified and ready for GitHub Pages deployment.');

