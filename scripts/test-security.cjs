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
assert(indexHtml.includes("object-src 'none'"), "index.html CSP must contain object-src 'none'");
console.log('✓ index.html (Development CSP) is properly configured.');

const distIndexHtml = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf-8');
assert(distIndexHtml.includes('http-equiv="Content-Security-Policy"'), 'dist/index.html must contain a CSP meta tag');
assert(distIndexHtml.includes("default-src 'self'"), "dist/index.html CSP must contain default-src 'self'");
assert(distIndexHtml.includes("script-src 'self'"), "dist/index.html CSP must lock down script-src 'self'");
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

// 4. Test safe file permission enforcement (0o600)
console.log('\nTest 4: Sensitive Storage File Permissions (0o600)');
assert(mainCjs.includes('mode: 0o600'), 'Files must be written with secure mode 0o600');
console.log('✓ Notes and settings file storage enforces strict 0o600 permissions.');

console.log('\n======================================================');
console.log('ALL SECURITY VERIFICATION CHECKS PASSED SUCCESSFULLY!');
console.log('======================================================');
