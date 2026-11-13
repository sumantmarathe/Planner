#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const androidAssetsDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets');

console.log('=== Synchronizing Web Assets to Native Android Project ===');
if (!fs.existsSync(androidAssetsDir)) {
  fs.mkdirSync(androidAssetsDir, { recursive: true });
}

// Sync web files (index.html, css, js, icons) to Android assets
const copyDirs = ['css', 'js', 'icons'];
copyDirs.forEach(dir => {
  const src = path.join(rootDir, dir);
  const dest = path.join(androidAssetsDir, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  }
});

const copyFiles = ['index.html', 'manifest.json', 'sw.js', 'capacitor.config.json'];
copyFiles.forEach(file => {
  const src = path.join(rootDir, file);
  const dest = path.join(androidAssetsDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
});

console.log('Assets synchronized to Android assets directory.');

const gradlewFile = path.join(rootDir, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
if (fs.existsSync(gradlewFile)) {
  console.log('Found Gradle wrapper. Running build...');
  const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat assembleRelease' : './gradlew assembleRelease';
  execSync(gradlewCmd, { cwd: path.join(rootDir, 'android'), stdio: 'inherit' });
  console.log('Android release bundle complete.');
} else {
  console.log('Android assets packaged. Ready for Android Studio / Capacitor build.');
  console.log('To generate AAB for Google Play Console: open the "android" folder in Android Studio or run "npx cap sync android && cd android && ./gradlew bundleRelease".');
}

