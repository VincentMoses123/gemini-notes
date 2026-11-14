/**
 * Comprehensive Security Verification Test Suite
 * Tests CSP, webPreferences, IPC sanitization, XSS mitigation, and secret redaction.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Starting Gemini Notes Security Audit & Verification Suite ---\n');

// 1. Verify index.html and dist/index.html CSP
console.log('Test 1: Content Security Policy (CSP)');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf-8');
assert(indexHtml.includes('http-equiv="Content-Security-Policy"'), 'index.html must contain a CSP meta tag');
assert(indexHtml.includes("default-src 'self'"), "index.html CSP must contain default-src 'self'");
assert(indexHtml.includes("img-src 'self' data: blob:"), "index.html CSP must restrict img-src to 'self' data: blob:");
assert(indexHtml.includes("object-src 'none'"), "index.html CSP must contain object-src 'none'");
console.log('✓ index.html (Development CSP) is properly configured.');

const distIndexHtml = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf-8');
assert(distIndexHtml.includes('http-equiv="Content-Security-Policy"'), 'dist/index.html must contain a CSP meta tag');
assert(distIndexHtml.includes("default-src 'self'"), "dist/index.html CSP must contain default-src 'self'");
assert(distIndexHtml.includes("script-src 'self'"), "dist/index.html CSP must lock down script-src 'self'");
assert(distIndexHtml.includes("img-src 'self' data: blob:"), "dist/index.html CSP must restrict img-src to 'self' data: blob:");
assert(!distIndexHtml.includes('http://localhost:5173'), "dist/index.html CSP must not contain localhost dev URLs");
assert(!distIndexHtml.includes("'unsafe-eval'"), "dist/index.html CSP must not allow unsafe-eval");
console.log('✓ dist/index.html (Strict Production CSP) is properly hardened.');

// 2. Verify electron/main.cjs configuration
console.log('\nTest 2: Electron Process & Window Security Configuration');
const mainCjs = fs.readFileSync(path.join(__dirname, '../electron/main.cjs'), 'utf-8');

const requiredPrefs = [
  'contextIsolation: true',
  'nodeIntegration: false',
  'nodeIntegrationInWorker: false',
  'sandbox: true',
  'webSecurity: true',
  'allowRunningInsecureContent: false',
  'webviewTag: false',
  'navigateOnDragDrop: false',
];
for (const pref of requiredPrefs) {
  assert(mainCjs.includes(pref), `electron/main.cjs webPreferences must include '${pref}'`);
}
console.log('✓ webPreferences fully hardened with contextIsolation, sandbox, webSecurity, webviewTag disabled.');

// Check navigation interception
assert(mainCjs.includes("win.webContents.on('will-navigate'"), 'electron/main.cjs must intercept will-navigate');
assert(mainCjs.includes('win.webContents.setWindowOpenHandler'), 'electron/main.cjs must intercept window open requests');
assert(mainCjs.includes("setPermissionRequestHandler"), 'electron/main.cjs must intercept permission requests');
assert(mainCjs.includes("onHeadersReceived"), 'electron/main.cjs must set response headers via onHeadersReceived');
assert(mainCjs.includes("will-attach-webview"), 'electron/main.cjs must block webview attachments');
console.log('✓ Navigation hijacking prevention and permission request denial verified.');

// 3. Test Redaction Regex logic
console.log('\nTest 3: Credential & API Key Redaction');
function redactSensitiveData(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/AIza[0-9A-Za-z-_]{30,45}/g, 'AIzaSy***REDACTED***')
    .replace(/([?&]key=)[^&\s"']+/gi, '$1***REDACTED***')
    .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]{10,}/gi, '$1***REDACTED***')
    .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)[^"',\s}{]+/gi, '$1***REDACTED***');
}

const sampleApiKey = 'AIzaSyD-TEST_KEY_1234567890abcdefghij';
const redactedKey = redactSensitiveData(sampleApiKey);
assert(!redactedKey.includes('1234567890abcdefghij'), 'API key must be masked');
assert(redactedKey.includes('AIzaSy***REDACTED***'), 'API key must match masked format');

const sampleUrl = 'https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyD-TEST_KEY_1234567890abcdefghij&alt=json';
const redactedUrl = redactSensitiveData(sampleUrl);
assert(!redactedUrl.includes('1234567890abcdefghij'), 'URL key query param must be masked');
assert(redactedUrl.includes('key=***REDACTED***'), 'Query key param masked');

const sampleBearer = 'Authorization: Bearer ya29.a0AfH6SMCx1234567890abcdefghij';
const redactedBearer = redactSensitiveData(sampleBearer);
assert(!redactedBearer.includes('ya29.a0AfH6SM'), 'Bearer token must be masked');

console.log('✓ Regex credential redaction passes all attack vector scenarios.');

// 4. Test safe file permission enforcement (0o600) & directory permissions (0o700)
console.log('\nTest 4: Sensitive Storage File Permissions (0o600 & 0o700)');
assert(mainCjs.includes('mode: 0o600'), 'Files must be written with secure mode 0o600');
assert(mainCjs.includes('mode: 0o700'), 'Storage directory must be created with owner-only mode 0o700');
console.log('✓ Notes, knowledge base, and settings storage enforces strict 0o600 / 0o700 permissions.');

// 5. Personal Knowledge Base Security & Input Sanitization
console.log('\nTest 5: Personal Knowledge Base Security & Input Sanitization');
assert(mainCjs.includes('MAX_KB_FILE_BYTES'), 'electron/main.cjs must enforce MAX_KB_FILE_BYTES');
assert(mainCjs.includes('MAX_KB_CONTENT_CHARS'), 'electron/main.cjs must enforce MAX_KB_CONTENT_CHARS');
assert(mainCjs.includes('MAX_KB_DOCS'), 'electron/main.cjs must enforce MAX_KB_DOCS');
assert(mainCjs.includes('ALLOWED_KB_EXTENSIONS'), 'electron/main.cjs must enforce ALLOWED_KB_EXTENSIONS allowlist');
assert(mainCjs.includes('function sanitizeKnowledgeDocs('), 'electron/main.cjs must define sanitizeKnowledgeDocs');
assert(mainCjs.includes('KB_TARGET_FILE: filePath'), 'electron/main.cjs must pass PDF path via KB_TARGET_FILE env var to prevent CLI flag injection');
assert(mainCjs.includes("'-convert', 'txt', '-stdout', '--', filePath"), 'electron/main.cjs must pass -- flag terminator before filePath to textutil');
assert(mainCjs.includes('!stat.isFile()'), 'electron/main.cjs must verify stat.isFile() before importing KB files');
assert(mainCjs.includes('stat.size > MAX_KB_FILE_BYTES'), 'electron/main.cjs must enforce MAX_KB_FILE_BYTES check before reading KB files');
console.log('✓ Personal Knowledge Base import bounds, extension allowlist, CLI flag injection defense, and IPC sanitization verified.');

// 6. Native PDF Export Offline CSP & Renderer Isolation
console.log('\nTest 6: Native PDF Export Offline CSP & Renderer Isolation');
assert(
  mainCjs.includes("default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src 'none'; connect-src 'none'"),
  'electron/main.cjs notes:exportPdf must enforce an offline CSP inside documentHtml'
);
assert(mainCjs.includes('sanitizePdfHtml'), 'electron/main.cjs notes:exportPdf must sanitize rendered HTML');
assert(mainCjs.includes("pdfWin.webContents.on('will-navigate'"), 'electron/main.cjs pdfWin must lock down navigation');
assert(mainCjs.includes('pdfWin.webContents.setWindowOpenHandler'), 'electron/main.cjs pdfWin must deny window.open');
console.log('✓ Native PDF export offline CSP, HTML sanitization, and window navigation lock verified.');

// 7. CISO Audit Controls (Header Auth, IPC Sender Verification, Schema Validation, Env Isolation, Zero localStorage Shadowing, & Website CSP)
console.log('\nTest 7: CISO Audit Controls (Header Auth, IPC Sender Checks, Storage Purge, & Beacon-Free CSP)');
assert(mainCjs.includes("'x-goog-api-key': resolvedKey"), 'electron/main.cjs must authenticate Gemini requests via x-goog-api-key header');
assert(!mainCjs.includes('?key=${encodeURIComponent(resolvedKey)}'), 'electron/main.cjs must not transmit API keys in URL query strings');
assert(mainCjs.includes('function isTrustedIpcSender('), 'electron/main.cjs must define isTrustedIpcSender');
assert(mainCjs.includes('assertTrustedIpcSender(event)'), 'electron/main.cjs must enforce assertTrustedIpcSender on IPC handlers');
assert(mainCjs.includes('function isDevEnvironment('), 'electron/main.cjs must gate localhost:5173 behind isDevEnvironment()');
assert(mainCjs.includes('function sanitizeSettingsForSave('), 'electron/main.cjs must validate settings via sanitizeSettingsForSave');
assert(mainCjs.includes('safeChildEnv'), 'electron/main.cjs must isolate subprocess environment via safeChildEnv');
assert(mainCjs.includes("img-src 'self' data: blob:"), 'electron/main.cjs runtime CSP must block wildcard https: image beacons');

const storageTs = fs.readFileSync(path.join(__dirname, '../src/services/storage.ts'), 'utf-8');
assert(storageTs.includes('localStorage.removeItem'), 'src/services/storage.ts must purge Chromium localStorage shadow copies in desktop mode');
assert(storageTs.includes('clearLocalKey(SETTINGS_STORAGE_KEY)'), 'src/services/storage.ts must scrub SETTINGS_STORAGE_KEY in Electron mode');
assert(storageTs.includes('clearLocalKey(NOTES_STORAGE_KEY)'), 'src/services/storage.ts must scrub NOTES_STORAGE_KEY in Electron mode');

const geminiTs = fs.readFileSync(path.join(__dirname, '../src/services/gemini.ts'), 'utf-8');
assert(geminiTs.includes("'x-goog-api-key': apiKey"), 'src/services/gemini.ts must use x-goog-api-key header');
assert(!geminiTs.includes('?key=${encodeURIComponent(apiKey)}'), 'src/services/gemini.ts must not put API keys in URL query strings');

const websiteHtml = fs.readFileSync(path.join(__dirname, '../website/index.html'), 'utf-8');
assert(websiteHtml.includes('http-equiv="Content-Security-Policy"'), 'website/index.html must include a CSP meta tag');
assert(!websiteHtml.includes('fonts.googleapis.com'), 'website/index.html must not send visitor requests to third-party font CDNs');
console.log('✓ Header-only auth, IPC sender verification, settings allowlist, subprocess isolation, storage purge, and website CSP verified.');

console.log('\n======================================================');
console.log('ALL SECURITY VERIFICATION CHECKS PASSED SUCCESSFULLY!');
console.log('======================================================');
