const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const version = (pkg.version || '0.4.0-beta').trim();

const releaseAppPath = path.join(rootDir, 'release', 'Gemini Notes.app');
const downloadsDir = path.join(rootDir, 'website', 'downloads');
const dmgFileName = `Gemini-Notes-v${version}-macOS-Universal.dmg`;
const zipFileName = `Gemini-Notes-v${version}-macOS-Universal.zip`;
const dmgOutPath = path.join(downloadsDir, dmgFileName);
const zipOutPath = path.join(downloadsDir, zipFileName);

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(1024 * 1024);
  try {
    let bytesRead = 0;
    while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(buf.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

function formatSizeMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function main() {
  if (!fs.existsSync(releaseAppPath)) {
    console.error(`Missing packaged app bundle at: ${releaseAppPath}`);
    console.error('Run "npm run package:mac" first.');
    process.exit(1);
  }

  fs.mkdirSync(downloadsDir, { recursive: true });
  for (const existing of fs.readdirSync(downloadsDir)) {
    if (existing.endsWith('.dmg') || existing.endsWith('.zip')) {
      fs.rmSync(path.join(downloadsDir, existing), { force: true });
    }
  }

  const stageRoot = fs.mkdtempSync('/tmp/gemini-notes-dmg-');
  const stagedAppPath = path.join(stageRoot, 'Gemini Notes.app');

  try {
    console.log(`Staging clean Universal bundle for v${version} downloads...`);
    execFileSync('ditto', ['--norsrc', '--noextattr', releaseAppPath, stagedAppPath]);
    execFileSync('xattr', ['-cr', stagedAppPath]);
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', stagedAppPath]);
    execFileSync('codesign', ['--verify', '--deep', '--strict', stagedAppPath]);

    console.log(`Creating macOS ZIP archive: ${zipFileName}...`);
    execFileSync('ditto', [
      '-c',
      '-k',
      '--sequesterRsrc',
      '--keepParent',
      stagedAppPath,
      zipOutPath,
    ]);

    console.log(`Creating macOS DMG disk image: ${dmgFileName}...`);
    fs.symlinkSync('/Applications', path.join(stageRoot, 'Applications'));
    execFileSync('hdiutil', [
      'create',
      '-volname',
      `Gemini Notes v${version}`,
      '-srcfolder',
      stageRoot,
      '-ov',
      '-format',
      'UDZO',
      dmgOutPath,
    ]);
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }

  const dmgSizeBytes = fs.statSync(dmgOutPath).size;
  const zipSizeBytes = fs.statSync(zipOutPath).size;
  const dmgSha256 = sha256File(dmgOutPath);
  const zipSha256 = sha256File(zipOutPath);

  const manifest = {
    version,
    channel: 'BETA',
    generatedAt: new Date().toISOString(),
    downloads: {
      dmg: {
        fileName: dmgFileName,
        sizeBytes: dmgSizeBytes,
        sizeLabel: formatSizeMB(dmgSizeBytes),
        sha256: dmgSha256,
      },
      zip: {
        fileName: zipFileName,
        sizeBytes: zipSizeBytes,
        sizeLabel: formatSizeMB(zipSizeBytes),
        sha256: zipSha256,
      },
    },
  };

  fs.writeFileSync(
    path.join(downloadsDir, 'release-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf-8'
  );

  console.log('\n✅ Website installers created cleanly:');
  console.log(`   DMG: ${dmgOutPath} (${manifest.downloads.dmg.sizeLabel}) sha256=${dmgSha256}`);
  console.log(`   ZIP: ${zipOutPath} (${manifest.downloads.zip.sizeLabel}) sha256=${zipSha256}`);
}

main();
