const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const electronAppSrc = path.join(
  rootDir,
  'node_modules',
  'electron',
  'dist',
  'Electron.app'
);
const releaseDir = path.join(rootDir, 'release');
const targetAppPath = path.join(releaseDir, 'Gemini Notes.app');
const tempAppPath = path.join(os.tmpdir(), 'Gemini Notes.app');

if (!fs.existsSync(electronAppSrc)) {
  console.error('Could not find Electron.app at:', electronAppSrc);
  process.exit(1);
}

console.log('Packaging standalone macOS app: Gemini Notes.app...');

// 1. Clean previous builds in /tmp and release/
if (fs.existsSync(tempAppPath)) {
  fs.rmSync(tempAppPath, { recursive: true, force: true });
}
if (fs.existsSync(targetAppPath)) {
  fs.rmSync(targetAppPath, { recursive: true, force: true });
}
fs.mkdirSync(releaseDir, { recursive: true });

// 2. Copy Electron.app template to /tmp without extended attributes (-R -X)
execFileSync('cp', ['-R', '-X', electronAppSrc, tempAppPath]);

// 3. Copy app files (package.json, electron/, dist/) into Contents/Resources/app
const resourcesAppDir = path.join(
  tempAppPath,
  'Contents',
  'Resources',
  'app'
);
fs.mkdirSync(resourcesAppDir, { recursive: true });

fs.copyFileSync(
  path.join(rootDir, 'package.json'),
  path.join(resourcesAppDir, 'package.json')
);
execFileSync('cp', [
  '-R',
  '-X',
  path.join(rootDir, 'electron'),
  path.join(resourcesAppDir, 'electron'),
]);
execFileSync('cp', [
  '-R',
  '-X',
  path.join(rootDir, 'dist'),
  path.join(resourcesAppDir, 'dist'),
]);

// 4. Update Info.plist metadata
const infoPlistPath = path.join(tempAppPath, 'Contents', 'Info.plist');
try {
  execFileSync('plutil', [
    '-replace',
    'CFBundleDisplayName',
    '-string',
    'Gemini Notes',
    infoPlistPath,
  ]);
  execFileSync('plutil', [
    '-replace',
    'CFBundleName',
    '-string',
    'Gemini Notes',
    infoPlistPath,
  ]);
  execFileSync('plutil', [
    '-replace',
    'CFBundleIdentifier',
    '-string',
    'com.gemininotes.app',
    infoPlistPath,
  ]);
} catch (err) {
  console.warn('Warning updating Info.plist:', err.message);
}

// 5. Strip extended attributes and ad-hoc codesign in /tmp, then copy to release/
execFileSync('xattr', ['-cr', tempAppPath]);
execFileSync('codesign', ['--force', '--deep', '--sign', '-', tempAppPath]);
execFileSync('cp', ['-R', tempAppPath, targetAppPath]);
fs.rmSync(tempAppPath, { recursive: true, force: true });

console.log(`\n✅ Standalone app created and signed at:\n   ${targetAppPath}`);
