const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { downloadArtifact } = require('@electron/get');
const extract = require('extract-zip');
const { makeUniversalApp } = require('@electron/universal');

const rootDir = path.resolve(__dirname, '..');
const electronPkgPath = path.join(rootDir, 'node_modules', 'electron', 'package.json');
const electronChecksumsPath = path.join(rootDir, 'node_modules', 'electron', 'checksums.json');
const electronAppSrc = path.join(
  rootDir,
  'node_modules',
  'electron',
  'dist',
  'Electron.app'
);
const releaseDir = path.join(rootDir, 'release');
const targetAppPath = path.join(releaseDir, 'Gemini Notes.app');
const tempAppPath = '/tmp/Gemini Notes.app';
const templateCacheRoot = '/tmp/gemini-notes-electron-cache';

function parseTargetArch() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--arch=')) {
      return arg.split('=')[1].trim().toLowerCase();
    }
    if (arg === '--arch' && args[i + 1]) {
      return args[i + 1].trim().toLowerCase();
    }
    if (['arm64', 'x64', 'universal'].includes(arg.toLowerCase())) {
      return arg.toLowerCase();
    }
  }
  const envArch = (process.env.TARGET_ARCH || process.env.ARCH || '').trim().toLowerCase();
  if (['arm64', 'x64', 'universal'].includes(envArch)) {
    return envArch;
  }
  return 'universal';
}

function getBinaryArchDescription(appBundlePath) {
  const binPath = path.join(appBundlePath, 'Contents', 'MacOS', 'Electron');
  if (!fs.existsSync(binPath)) return '';
  try {
    return execFileSync('file', ['-b', binPath], { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function bundleMatchesArch(appBundlePath, arch) {
  const desc = getBinaryArchDescription(appBundlePath);
  if (!desc) return false;
  if (arch === 'arm64') {
    return desc.includes('arm64') && !desc.includes('universal');
  }
  if (arch === 'x64') {
    return desc.includes('x86_64') && !desc.includes('universal');
  }
  if (arch === 'universal') {
    return desc.includes('universal') && desc.includes('arm64') && desc.includes('x86_64');
  }
  return false;
}

async function getElectronTemplateApp(arch, electronVersion, checksums) {
  const cacheDir = path.join(templateCacheRoot, `v${electronVersion}-${arch}`);
  const cachedAppPath = path.join(cacheDir, 'Electron.app');

  if (bundleMatchesArch(cachedAppPath, arch)) {
    console.log(`   • Using cached Electron ${electronVersion} (${arch}) template`);
    return cachedAppPath;
  }

  fs.rmSync(cacheDir, { recursive: true, force: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  console.log(`   • Resolving Electron v${electronVersion} (darwin-${arch}) artifact via @electron/get...`);
  try {
    const zipPath = await downloadArtifact({
      version: electronVersion,
      artifactName: 'electron',
      platform: 'darwin',
      arch,
      checksums,
    });
    console.log(`   • Extracting ${path.basename(zipPath)} to template cache...`);
    await extract(zipPath, { dir: cacheDir });
    if (bundleMatchesArch(cachedAppPath, arch)) {
      return cachedAppPath;
    }
  } catch (err) {
    if (bundleMatchesArch(electronAppSrc, arch)) {
      console.warn(
        `   • Warning: @electron/get failed (${err.message}); falling back to local node_modules Electron.app (${arch}).`
      );
      execFileSync('cp', ['-R', '-X', electronAppSrc, cachedAppPath]);
      return cachedAppPath;
    }
    throw err;
  }

  if (!fs.existsSync(cachedAppPath)) {
    throw new Error(`Failed to prepare Electron.app template for darwin-${arch}`);
  }
  return cachedAppPath;
}

function updateInfoPlist(appBundlePath) {
  const infoPlistPath = path.join(appBundlePath, 'Contents', 'Info.plist');
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
    execFileSync('plutil', [
      '-replace',
      'LSArchitecturePriority',
      '-json',
      JSON.stringify(['arm64', 'x86_64']),
      infoPlistPath,
    ]);
  } catch (err) {
    console.warn('Warning updating Info.plist:', err.message);
  }
}

function populateAppBundle(templateAppPath, destAppPath) {
  if (fs.existsSync(destAppPath)) {
    fs.rmSync(destAppPath, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(destAppPath), { recursive: true });

  // Copy Electron.app template without extended attributes (-R -X)
  execFileSync('cp', ['-R', '-X', templateAppPath, destAppPath]);

  // Copy app files (package.json, electron/, dist/) into Contents/Resources/app
  const resourcesAppDir = path.join(
    destAppPath,
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

  // Replace default Electron icon with custom AI icon (.icns) if present
  const customIcnsPath = path.join(rootDir, 'public', 'app-icon.icns');
  const bundleIcnsPath = path.join(
    destAppPath,
    'Contents',
    'Resources',
    'electron.icns'
  );
  if (fs.existsSync(customIcnsPath)) {
    fs.copyFileSync(customIcnsPath, bundleIcnsPath);
  }

  // Update Info.plist metadata
  updateInfoPlist(destAppPath);
}

async function main() {
  const targetArch = parseTargetArch();
  if (!['arm64', 'x64', 'universal'].includes(targetArch)) {
    console.error(
      `Unsupported target architecture "${targetArch}". Expected one of: arm64, x64, universal.`
    );
    process.exit(1);
  }

  const electronVersion = fs.existsSync(electronPkgPath)
    ? JSON.parse(fs.readFileSync(electronPkgPath, 'utf-8')).version
    : '33.4.11';
  const checksums = fs.existsSync(electronChecksumsPath)
    ? JSON.parse(fs.readFileSync(electronChecksumsPath, 'utf-8'))
    : undefined;

  console.log(
    `Packaging standalone macOS app: Gemini Notes.app (target: ${targetArch}, Electron v${electronVersion})...`
  );

  // 1. Clean previous builds in /tmp and release/
  if (fs.existsSync(tempAppPath)) {
    fs.rmSync(tempAppPath, { recursive: true, force: true });
  }
  if (fs.existsSync(targetAppPath)) {
    fs.rmSync(targetAppPath, { recursive: true, force: true });
  }
  fs.mkdirSync(releaseDir, { recursive: true });

  // 2. Stage requested architecture(s) into /tmp/Gemini Notes.app
  if (targetArch === 'universal') {
    const stageArm64Dir = '/tmp/gemini-notes-stage-arm64';
    const stageX64Dir = '/tmp/gemini-notes-stage-x64';
    const arm64AppPath = path.join(stageArm64Dir, 'Gemini Notes.app');
    const x64AppPath = path.join(stageX64Dir, 'Gemini Notes.app');

    try {
      const [arm64Template, x64Template] = await Promise.all([
        getElectronTemplateApp('arm64', electronVersion, checksums),
        getElectronTemplateApp('x64', electronVersion, checksums),
      ]);

      console.log('   • Staging arm64 and x64 app bundles...');
      populateAppBundle(arm64Template, arm64AppPath);
      populateAppBundle(x64Template, x64AppPath);

      console.log('   • Merging arm64 + x64 bundles with @electron/universal...');
      await makeUniversalApp({
        x64AppPath,
        arm64AppPath,
        outAppPath: tempAppPath,
        force: true,
      });
    } finally {
      fs.rmSync(stageArm64Dir, { recursive: true, force: true });
      fs.rmSync(stageX64Dir, { recursive: true, force: true });
    }
  } else {
    const templateAppPath = await getElectronTemplateApp(
      targetArch,
      electronVersion,
      checksums
    );
    populateAppBundle(templateAppPath, tempAppPath);
  }

  // 3. Ensure Info.plist metadata on staged /tmp/Gemini Notes.app
  updateInfoPlist(tempAppPath);

  // 4. Strip extended attributes, ad-hoc codesign & strict-verify in /tmp, copy via ditto --norsrc, and verify
  execFileSync('xattr', ['-cr', tempAppPath]);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', tempAppPath]);
  execFileSync('codesign', ['--verify', '--deep', '--strict', tempAppPath]);
  execFileSync('ditto', ['--norsrc', '--noextattr', tempAppPath, targetAppPath]);
  execFileSync('xattr', ['-cr', targetAppPath]);
  execFileSync('codesign', ['--verify', '--deep', targetAppPath]);
  fs.rmSync(tempAppPath, { recursive: true, force: true });

  const finalArchInfo = getBinaryArchDescription(targetAppPath);
  console.log(
    `\n✅ Standalone app (${targetArch}) created, signed, and verified at:\n   ${targetAppPath}\n   Binary: ${finalArchInfo}`
  );
}

main().catch((err) => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
