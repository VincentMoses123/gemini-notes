const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.setName('Gemini Notes');

const MAX_LOG_ENTRIES = 250;
const DEFAULT_MODEL = 'gemini-3-flash-preview';
const LEGACY_MODELS = new Set(['gemini-2.5-flash', 'gemini-3.0-flash']);

const REDACTION_PATTERNS = [
  [/AIza[0-9A-Za-z-_]{30,45}/g, 'AIzaSy***REDACTED***'],
  [/([?&]key=)[^&\s"']+/gi, '$1***REDACTED***'],
  [/(Bearer\s+)[A-Za-z0-9_\-\.]{10,}/gi, '$1***REDACTED***'],
  [/(ya29\.[0-9A-Za-z_\-\.]{10,})/g, 'ya29.***REDACTED***'],
  [/(api[_-]?key["']?\s*[:=]\s*["']?)[^"',\s}{]+/gi, '$1***REDACTED***'],
  [/(x-goog-api-key["']?\s*[:=]\s*["']?)[^"',\s}{]+/gi, '$1***REDACTED***'],
];

/**
 * Redacts sensitive credentials (Gemini API keys, query params, Bearer tokens)
 * from strings before saving or printing to logs.
 */
function redactSensitiveData(str) {
  if (typeof str !== 'string') return str;
  return REDACTION_PATTERNS.reduce((acc, [regex, replacement]) => acc.replace(regex, replacement), str);
}

/**
 * Deeply sanitizes a log entry object.
 */
function sanitizeLogEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  let details = entry.details;
  if (typeof details === 'string') {
    details = redactSensitiveData(details);
  } else if (details !== undefined) {
    try {
      details = redactSensitiveData(JSON.stringify(details).slice(0, 2000));
    } catch {
      details = '[Unserializable details]';
    }
  }
  return {
    ...entry,
    message: redactSensitiveData(entry.message),
    details,
  };
}

/**
 * Safely opens external URLs in the user's default browser,
 * strictly validating that the scheme is http: or https:.
 */
function safeOpenExternal(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      shell.openExternal(rawUrl).catch((err) => {
        console.warn('[Security] Failed to open external URL:', err.message);
      });
      return true;
    }
  } catch {
    // Malformed URL
  }
  console.warn(
    `[Security] Blocked external navigation to untrusted protocol/URL: ${redactSensitiveData(String(rawUrl))}`
  );
  return false;
}

function isDevEnvironment() {
  return (
    !app.isPackaged &&
    !process.argv.includes('--use-dist') &&
    process.env.USE_DIST !== 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}

/**
 * Validates whether a navigation URL is within the authorized local application boundaries.
 */
function isAllowedLocalNavigation(targetUrl, indexHtmlPath) {
  try {
    const parsed = new URL(targetUrl);
    if (isDevEnvironment() && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
      return (
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
        parsed.port === '5173'
      );
    }
    if (parsed.protocol === 'file:') {
      return (
        path.normalize(decodeURIComponent(parsed.pathname)) === path.normalize(indexHtmlPath)
      );
    }
    return false;
  } catch {
    return false;
  }
}

function isTrustedIpcSender(event) {
  const indexHtml = path.join(__dirname, '../dist/index.html');
  const senderUrl = event?.senderFrame?.url || event?.sender?.getURL?.() || '';
  return isAllowedLocalNavigation(senderUrl, indexHtml);
}

function assertTrustedIpcSender(event) {
  if (!isTrustedIpcSender(event)) {
    throw new Error('Unauthorized IPC sender');
  }
}

function getStorageDir() {
  const dir = path.join(app.getPath('appData'), 'gemini-notes', 'notes-data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // ignore chmod error on unsupported filesystems
  }
  return dir;
}

const getStorageFilePath = (name) => path.join(getStorageDir(), name);
const getNotesFilePath = () => getStorageFilePath('notes.json');
const getSettingsFilePath = () => getStorageFilePath('settings.json');
const getLogsFilePath = () => getStorageFilePath('app-logs.json');
const getKnowledgeBaseFilePath = () => getStorageFilePath('knowledge-base.json');

const MAX_KB_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per imported file
const MAX_KB_CONTENT_CHARS = 120000;
const MAX_KB_DOCS = 200;
const ALLOWED_KB_EXTENSIONS = new Set([
  'pdf',
  'md',
  'markdown',
  'txt',
  'csv',
  'json',
  'rtf',
  'doc',
  'docx',
  'odt',
  'html',
  'htm',
]);
const ALLOWED_KB_DOC_TYPES = new Set(['pdf', 'md', 'txt', 'csv', 'json', 'rtf', 'doc']);

function normalizeExtractedText(raw) {
  return String(raw || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_KB_CONTENT_CHARS);
}

function sanitizeKnowledgeDocs(docs) {
  if (!Array.isArray(docs)) return [];
  const now = new Date().toISOString();
  return docs
    .filter((d) => d && typeof d === 'object')
    .slice(0, MAX_KB_DOCS)
    .map((d, idx) => {
      const rawName =
        String(d.name || `Document ${idx + 1}`)
          .replace(/[\x00-\x1F\x7F/\\]/g, '_')
          .trim()
          .slice(0, 200) || `Document ${idx + 1}`;
      const rawType = String(d.fileType || 'txt').toLowerCase();
      const fileType = ALLOWED_KB_DOC_TYPES.has(rawType) ? rawType : 'txt';
      const content = normalizeExtractedText(d.content);
      const sizeBytes =
        typeof d.sizeBytes === 'number' && Number.isFinite(d.sizeBytes) && d.sizeBytes >= 0
          ? Math.min(Math.floor(d.sizeBytes), MAX_KB_FILE_BYTES)
          : Buffer.byteLength(content, 'utf-8');
      return {
        id:
          String(d.id || `kb-${Date.now()}-${idx}`)
            .replace(/[^a-zA-Z0-9_-]/g, '')
            .slice(0, 80) || `kb-${Date.now()}-${idx}`,
        name: rawName,
        fileType,
        content,
        sizeBytes,
        enabled: d.enabled !== undefined ? Boolean(d.enabled) : true,
        createdAt: String(d.createdAt || now).slice(0, 64),
        updatedAt: String(d.updatedAt || now).slice(0, 64),
      };
    })
    .filter((d) => d.content.length > 0);
}

function mapKnowledgeExtType(ext) {
  const clean = ext.toLowerCase().replace(/^\./, '');
  if (clean === 'pdf') return 'pdf';
  if (clean === 'md' || clean === 'markdown') return 'md';
  if (clean === 'csv') return 'csv';
  if (clean === 'json') return 'json';
  if (clean === 'txt') return 'txt';
  return 'doc';
}

function getSafeChildEnv() {
  return {
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
    HOME: os.homedir(),
    TMPDIR: os.tmpdir(),
    LANG: process.env.LANG || 'en_US.UTF-8',
  };
}

function extractTextFromFile(filePath, ext) {
  const cleanExt = ext.toLowerCase().replace(/^\./, '');
  const safeChildEnv = getSafeChildEnv();
  if (cleanExt === 'pdf') {
    if (process.platform === 'darwin') {
      try {
        const swiftScript =
          'import Foundation; import PDFKit; if let p = ProcessInfo.processInfo.environment["KB_TARGET_FILE"], let d = PDFDocument(url: URL(fileURLWithPath: p)), let s = d.string { print(s) }';
        const out = execFileSync('/usr/bin/swift', ['-e', swiftScript], {
          encoding: 'utf-8',
          timeout: 15000,
          maxBuffer: 20 * 1024 * 1024,
          env: { ...safeChildEnv, KB_TARGET_FILE: filePath },
        });
        const cleanOut = normalizeExtractedText(out);
        if (cleanOut) return cleanOut;
      } catch {
        // fallback below
      }
    }
    const rawBuf = fs.readFileSync(filePath).toString('latin1');
    const chunks = Array.from(rawBuf.matchAll(/\(([^()\\]{4,})\)\s*Tj/g), (m) => m[1]);
    return normalizeExtractedText(chunks.join(' '));
  }

  if (['rtf', 'doc', 'docx', 'odt'].includes(cleanExt) && process.platform === 'darwin') {
    try {
      const out = execFileSync('/usr/bin/textutil', ['-convert', 'txt', '-stdout', '--', filePath], {
        encoding: 'utf-8',
        timeout: 10000,
        maxBuffer: 20 * 1024 * 1024,
        env: safeChildEnv,
      });
      return normalizeExtractedText(out);
    } catch {
      // fallback below
    }
  }

  const rawText = fs.readFileSync(filePath, 'utf-8');
  if (cleanExt === 'html' || cleanExt === 'htm') {
    const stripped = rawText
      .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
    return normalizeExtractedText(stripped);
  }
  return normalizeExtractedText(rawText);
}

/**
 * Unified JSON reader with graceful fallback.
 */
function readJsonFile(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`Error reading ${path.basename(filePath)}:`, err);
    return fallback;
  }
}

/**
 * Unified atomic JSON writer enforcing owner-only 0o600 permissions.
 */
function writeJsonAtomic(filePath, data) {
  const payload = JSON.stringify(data, null, 2);
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmpPath, payload, { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
  } catch {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // ignore cleanup error
    }
    fs.writeFileSync(filePath, payload, { encoding: 'utf-8', mode: 0o600 });
  }
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // ignore chmod error on unsupported filesystems
  }
}

function saveJsonWithResult(filePath, data, includePath = false) {
  try {
    writeJsonAtomic(filePath, data);
    return includePath ? { ok: true, path: filePath } : { ok: true };
  } catch (err) {
    console.error(`Error saving ${path.basename(filePath)}:`, err);
    return { ok: false, error: err.message };
  }
}

function prependLogEntry(entry, dedupeStartupPrefix = false) {
  const filePath = getLogsFilePath();
  const existing = readJsonFile(filePath, []);
  const list = Array.isArray(existing) ? existing : [];
  const filtered = dedupeStartupPrefix
    ? list.filter(
        (item, idx) =>
          !(
            idx === 0 &&
            item &&
            item.source === 'system' &&
            String(item.message || '').startsWith('Gemini Notes runtime initialized')
          )
      )
    : list;
  const updated = [sanitizeLogEntry(entry), ...filtered].slice(0, MAX_LOG_ENTRIES);
  writeJsonAtomic(filePath, updated);
}

function sanitizeSettingsForSave(raw = {}) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const VALID_THEMES = new Set(['dark', 'midnight', 'light', 'sepia']);
  const VALID_ACCENTS = new Set([
    'sapphire',
    'emerald',
    'copper',
    'indigo',
    'slate',
    'rose',
    'violet',
    'coral',
    'teal',
  ]);
  const VALID_LAYOUTS = new Set(['three-column', 'two-column']);
  const VALID_PAGE_SIZES = new Set(['Letter', 'A4', 'Legal']);
  return {
    apiKey: typeof data.apiKey === 'string' ? data.apiKey.trim().slice(0, 256) : '',
    model: typeof data.model === 'string' ? data.model.trim().slice(0, 120) : DEFAULT_MODEL,
    theme: VALID_THEMES.has(data.theme) ? data.theme : 'dark',
    accentTheme: VALID_ACCENTS.has(data.accentTheme) ? data.accentTheme : 'sapphire',
    layoutMode: VALID_LAYOUTS.has(data.layoutMode) ? data.layoutMode : 'three-column',
    defaultExportFormat: data.defaultExportFormat === 'markdown' ? 'markdown' : 'pdf',
    pdfPageSize: VALID_PAGE_SIZES.has(data.pdfPageSize) ? data.pdfPageSize : 'Letter',
    pdfIncludeMetadata:
      data.pdfIncludeMetadata !== undefined ? Boolean(data.pdfIncludeMetadata) : true,
    ...(Array.isArray(data.folders)
      ? {
          folders: data.folders
            .filter((f) => typeof f === 'string' && f.trim())
            .slice(0, 50)
            .map((f) => f.trim().slice(0, 80)),
        }
      : {}),
  };
}

function buildSettingsPayload(saved = {}) {
  const data = saved && typeof saved === 'object' ? saved : {};
  const envKey = process.env.GEMINI_API_KEY || '';
  const model =
    !data.model || LEGACY_MODELS.has(data.model) ? DEFAULT_MODEL : data.model;
  return {
    apiKey: data.apiKey || envKey,
    model,
    theme: data.theme || 'dark',
    accentTheme: data.accentTheme || 'sapphire',
    layoutMode: data.layoutMode || 'three-column',
    defaultExportFormat: data.defaultExportFormat === 'markdown' ? 'markdown' : 'pdf',
    pdfPageSize: ['Letter', 'A4', 'Legal'].includes(data.pdfPageSize)
      ? data.pdfPageSize
      : 'Letter',
    pdfIncludeMetadata:
      data.pdfIncludeMetadata !== undefined ? Boolean(data.pdfIncludeMetadata) : true,
    ...(data.folders !== undefined ? { folders: data.folders } : {}),
    storagePath: getStorageDir(),
    arch: process.arch,
    platform: process.platform,
  };
}

function getAppIconPath() {
  const candidates = [
    path.join(__dirname, '../public/app-icon.png'),
    path.join(__dirname, '../dist/app-icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || undefined;
}

function createWindow() {
  const iconPath = getAppIconPath();
  if (process.platform === 'darwin' && app.dock && iconPath) {
    try {
      app.dock.setIcon(iconPath);
    } catch {
      // ignore
    }
  }

  const win = new BrowserWindow({
    width: 1320,
    height: 850,
    minWidth: 960,
    minHeight: 580,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#18191c',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: true,
    },
  });

  const devUrl = 'http://localhost:5173';
  const indexHtml = path.join(__dirname, '../dist/index.html');

  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedLocalNavigation(targetUrl, indexHtml)) {
      event.preventDefault();
      safeOpenExternal(targetUrl);
    }
  });

  win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    safeOpenExternal(targetUrl);
    return { action: 'deny' };
  });

  win.webContents.on('will-frame-navigate', (event) => {
    if (!event.isMainFrame && !isAllowedLocalNavigation(event.url, indexHtml)) {
      event.preventDefault();
    }
  });

  const preferDist =
    app.isPackaged ||
    process.env.USE_DIST === 'true' ||
    process.argv.includes('--use-dist');

  if (fs.existsSync(indexHtml) && preferDist) {
    win.loadFile(indexHtml);
  } else {
    win.loadURL(devUrl).catch(() => {
      if (fs.existsSync(indexHtml)) {
        win.loadFile(indexHtml);
      }
    });
  }
}

function recordStartupDiagnostics() {
  const archLabel =
    process.arch === 'arm64'
      ? 'Apple Silicon Native (arm64)'
      : `Intel / Translated (${process.arch})`;
  const details = `Platform: ${process.platform} | Arch: ${process.arch} (${archLabel}) | Electron: ${process.versions.electron} | Node: ${process.versions.node}`;
  console.log(`[Gemini Notes] Runtime initialized — ${details}`);

  try {
    prependLogEntry(
      {
        id: `log-startup-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        source: 'system',
        message: `Gemini Notes runtime initialized — ${archLabel}`,
        details,
      },
      true
    );
  } catch (err) {
    console.warn('Could not write startup diagnostics log:', err.message);
  }
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isDev = isDevEnvironment();

    const csp = isDev
      ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:5173 ws://localhost:5173 https://generativelanguage.googleapis.com; object-src 'none'; base-uri 'self';"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';";

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
      },
    });
  });

  const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write']);
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (ALLOWED_PERMISSIONS.has(permission)) return callback(true);
    console.warn(`[Security] Denied permission request for: ${permission}`);
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) =>
    ALLOWED_PERMISSIONS.has(permission)
  );

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });

  recordStartupDiagnostics();

  ipcMain.handle('system:info', async (event) => {
    assertTrustedIpcSender(event);
    return {
      arch: process.arch,
      platform: process.platform,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      isAppleSilicon: process.platform === 'darwin' && process.arch === 'arm64',
    };
  });

  ipcMain.handle('notes:load', async (event) => {
    assertTrustedIpcSender(event);
    return readJsonFile(getNotesFilePath(), null);
  });
  ipcMain.handle('notes:save', async (event, notes) => {
    assertTrustedIpcSender(event);
    if (!Array.isArray(notes)) {
      return { ok: false, error: 'Invalid notes payload.' };
    }
    return saveJsonWithResult(getNotesFilePath(), notes, true);
  });

  ipcMain.handle('settings:load', async (event) => {
    assertTrustedIpcSender(event);
    return buildSettingsPayload(readJsonFile(getSettingsFilePath(), {}));
  });
  ipcMain.handle('settings:save', async (event, settings) => {
    assertTrustedIpcSender(event);
    return saveJsonWithResult(getSettingsFilePath(), sanitizeSettingsForSave(settings));
  });

  ipcMain.handle('kb:load', async (event) => {
    assertTrustedIpcSender(event);
    const docs = readJsonFile(getKnowledgeBaseFilePath(), []);
    return sanitizeKnowledgeDocs(docs);
  });
  ipcMain.handle('kb:save', async (event, docs) => {
    assertTrustedIpcSender(event);
    return saveJsonWithResult(getKnowledgeBaseFilePath(), sanitizeKnowledgeDocs(docs));
  });
  ipcMain.handle('kb:importFiles', async (event) => {
    assertTrustedIpcSender(event);
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import Reference Documents to Knowledge Base',
        properties: ['openFile', 'multiSelections'],
        filters: [
          {
            name: 'Documents',
            extensions: ['pdf', 'md', 'markdown', 'txt', 'csv', 'json', 'rtf', 'doc', 'docx', 'odt', 'html', 'htm'],
          },
        ],
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
      }

      const now = new Date().toISOString();
      const imported = [];
      let skippedTooLarge = 0;
      for (const filePath of result.filePaths) {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;
        if (stat.size > MAX_KB_FILE_BYTES) {
          skippedTooLarge += 1;
          continue;
        }
        const ext = path.extname(filePath);
        const cleanExt = ext.toLowerCase().replace(/^\./, '');
        if (!ALLOWED_KB_EXTENSIONS.has(cleanExt)) continue;
        const content = extractTextFromFile(filePath, ext);
        if (!content) continue;
        imported.push({
          id: `kb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: path.basename(filePath),
          fileType: mapKnowledgeExtType(ext),
          content,
          sizeBytes: stat.size,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
      }

      const sanitizedImported = sanitizeKnowledgeDocs(imported);
      if (sanitizedImported.length === 0) {
        return {
          ok: false,
          error:
            skippedTooLarge > 0
              ? `Selected file(s) exceeded the ${Math.round(MAX_KB_FILE_BYTES / (1024 * 1024))} MB size limit.`
              : 'No readable text could be extracted from the selected file(s).',
        };
      }
      return { ok: true, docs: sanitizedImported };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : 'Failed to import files.' };
    }
  });

  ipcMain.handle('logs:load', async (event) => {
    assertTrustedIpcSender(event);
    const logs = readJsonFile(getLogsFilePath(), []);
    return Array.isArray(logs) ? logs : [];
  });
  ipcMain.handle('logs:append', async (event, entry) => {
    assertTrustedIpcSender(event);
    try {
      prependLogEntry(entry);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('logs:clear', async (event) => {
    assertTrustedIpcSender(event);
    return saveJsonWithResult(getLogsFilePath(), []);
  });

  ipcMain.handle('storage:openFolder', async (event) => {
    assertTrustedIpcSender(event);
    shell.openPath(getStorageDir());
    return { ok: true };
  });

  ipcMain.handle('notes:exportMarkdown', async (event, payload = {}) => {
    assertTrustedIpcSender(event);
    const { title = 'Untitled Note', markdown = '' } =
      payload && typeof payload === 'object' ? payload : {};
    const safeName = (String(title || 'Untitled Note')).replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'note';
    const result = await dialog.showSaveDialog({
      title: 'Export Note as Markdown',
      defaultPath: `${safeName}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, String(markdown ?? ''), { encoding: 'utf-8', mode: 0o600 });
      try {
        fs.chmodSync(result.filePath, 0o600);
      } catch {
        // ignore chmod error on unsupported filesystems
      }
      return { ok: true, filePath: result.filePath };
    }
    return { ok: false };
  });

  ipcMain.handle('notes:exportPdf', async (event, payload = {}) => {
    assertTrustedIpcSender(event);
    const {
      title = 'Untitled Note',
      html = '',
      pageSize = 'Letter',
      includeMetadata = true,
      folder = '',
      tags = [],
      updatedAt = '',
      theme = 'light',
    } = payload && typeof payload === 'object' ? payload : {};

    const safeName = (title || 'Untitled Note').replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'note';
    const result = await dialog.showSaveDialog({
      title: 'Export Note as PDF',
      defaultPath: `${safeName}.pdf`,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    });
    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }

    const validPageSize = ['Letter', 'A4', 'Legal'].includes(pageSize) ? pageSize : 'Letter';
    const escapeHtml = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const sanitizePdfHtml = (rawHtml) =>
      String(rawHtml ?? '')
        .replace(
          /<\s*(script|style|iframe|object|embed|meta|link|base|form|input|button|textarea|select|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
          ''
        )
        .replace(
          /<\s*(script|style|iframe|object|embed|meta|link|base|form|input|button|textarea|select|svg|math)\b[^>]*\/?>/gi,
          ''
        )
        .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1="#"');

    const isSepia = theme === 'sepia';
    const paperBg = isSepia ? '#fbf5e6' : '#ffffff';
    const inkColor = isSepia ? '#2b2114' : '#111827';
    const mutedInk = isSepia ? '#6f5c43' : '#6b7280';
    const borderColor = isSepia ? '#e5d8bc' : '#e5e7eb';
    const codeBg = isSepia ? '#f2e8cf' : '#f3f4f6';

    const metaParts = [];
    if (folder) metaParts.push(`Folder: ${escapeHtml(folder)}`);
    if (Array.isArray(tags) && tags.length > 0) {
      metaParts.push(`Tags: ${tags.map((t) => `#${escapeHtml(t)}`).join(', ')}`);
    }
    if (updatedAt) {
      const parsedDate = new Date(updatedAt);
      const formattedDate = Number.isNaN(parsedDate.getTime())
        ? escapeHtml(updatedAt)
        : escapeHtml(parsedDate.toLocaleString());
      metaParts.push(`Updated: ${formattedDate}`);
    }

    const metadataBlock =
      includeMetadata && metaParts.length > 0
        ? `<div class="pdf-meta">${metaParts.join(' &nbsp;•&nbsp; ')}</div>`
        : '';

    const documentHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';" />
<title>${escapeHtml(title || 'Untitled Note')}</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: ${paperBg};
    color: ${inkColor};
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", sans-serif;
    font-size: 11.5pt;
    line-height: 1.65;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-container { padding: 14px 4px; }
  h1.pdf-title {
    font-size: 22pt;
    font-weight: 700;
    line-height: 1.25;
    margin: 0 0 8px 0;
    letter-spacing: -0.02em;
  }
  .pdf-meta {
    font-size: 9pt;
    color: ${mutedInk};
    padding-bottom: 14px;
    margin-bottom: 18px;
    border-bottom: 1px solid ${borderColor};
  }
  .pdf-body h1, .pdf-body h2, .pdf-body h3 {
    margin-top: 1.25em;
    margin-bottom: 0.45em;
    line-height: 1.3;
  }
  .pdf-body h1 { font-size: 16pt; }
  .pdf-body h2 { font-size: 13.5pt; }
  .pdf-body h3 { font-size: 11.5pt; }
  .pdf-body p { margin: 0 0 0.75em 0; }
  .pdf-body ul, .pdf-body ol { margin: 0 0 0.85em 0; padding-left: 1.5em; }
  .pdf-body blockquote {
    margin: 0.9em 0;
    padding: 6px 14px;
    border-left: 3px solid ${mutedInk};
    color: ${mutedInk};
  }
  .pdf-body pre, .pdf-body code {
    font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
    font-size: 9.5pt;
    background: ${codeBg};
    border-radius: 5px;
  }
  .pdf-body code { padding: 1px 5px; }
  .pdf-body pre { padding: 10px 12px; overflow-x: auto; white-space: pre-wrap; }
  .pdf-body table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 10pt; }
  .pdf-body th, .pdf-body td { border: 1px solid ${borderColor}; padding: 6px 8px; text-align: left; }
  .pdf-body hr { border: none; border-top: 1px solid ${borderColor}; margin: 1.25em 0; }
  .pdf-body img { max-width: 100%; height: auto; border-radius: 6px; }
</style>
</head>
<body>
  <div class="pdf-container">
    <h1 class="pdf-title">${escapeHtml(title || 'Untitled Note')}</h1>
    ${metadataBlock}
    <div class="pdf-body">${sanitizePdfHtml(html)}</div>
  </div>
</body>
</html>`;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gn-pdf-'));
    const tmpHtmlPath = path.join(tmpDir, 'export.html');
    let pdfWin = null;
    try {
      try {
        fs.chmodSync(tmpDir, 0o700);
      } catch {
        // ignore chmod error on unsupported filesystems
      }
      fs.writeFileSync(tmpHtmlPath, documentHtml, { encoding: 'utf-8', mode: 0o600 });
      pdfWin = new BrowserWindow({
        show: false,
        width: 850,
        height: 1100,
        backgroundColor: paperBg,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          nodeIntegrationInWorker: false,
          sandbox: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
        },
      });
      pdfWin.webContents.on('will-navigate', (e) => e.preventDefault());
      pdfWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      await pdfWin.loadFile(tmpHtmlPath);
      const pdfBuffer = await pdfWin.webContents.printToPDF({
        printBackground: true,
        pageSize: validPageSize,
        margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
      });
      fs.writeFileSync(result.filePath, pdfBuffer, { mode: 0o600 });
      try {
        fs.chmodSync(result.filePath, 0o600);
      } catch {
        // ignore chmod error on unsupported filesystems
      }
      return { ok: true, filePath: result.filePath };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : 'PDF export failed' };
    } finally {
      if (pdfWin && !pdfWin.isDestroyed()) {
        pdfWin.destroy();
      }
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore temp cleanup failure
      }
    }
  });

  ipcMain.handle('gemini:generate', async (event, payload = {}) => {
    assertTrustedIpcSender(event);
    const { apiKey, model, systemInstruction, prompt } =
      payload && typeof payload === 'object' ? payload : {};
    const startTime = Date.now();
    const resolvedKey = (apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!resolvedKey) {
      return {
        ok: false,
        errorCode: 'GN-AUTH-001',
        error: '[GN-AUTH-001] Missing Gemini API key. Click "Gemini Settings" in the sidebar to add your API key.',
        durationMs: Date.now() - startTime,
      };
    }

    const extractSuggestedModels = (msg = '') =>
      Array.from(msg.matchAll(/models\/([a-zA-Z0-9._-]+)/g), (m) => m[1]);

    const parseJsonSafe = async (response) => {
      const rawText = await response.text();
      try {
        return rawText ? JSON.parse(rawText) : {};
      } catch {
        return { error: { message: rawText.slice(0, 300) || `HTTP ${response.status}` } };
      }
    };

    const callModel = async (targetModel) => {
      const cleanModel = targetModel.replace(/^models\//, '');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        cleanModel
      )}:generateContent`;

      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': resolvedKey,
        },
        body: JSON.stringify(body),
      });
      const data = await parseJsonSafe(response);
      return { response, data, usedModel: cleanModel };
    };

    const fetchAvailableModels = async () => {
      try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
          headers: {
            'x-goog-api-key': resolvedKey,
          },
        });
        if (!res.ok) return [];
        const data = await parseJsonSafe(res);
        return (data.models || [])
          .filter(
            (m) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes('generateContent') &&
              m.name.includes('gemini') &&
              !/tts|image|vision|embedding/.test(m.name)
          )
          .map((m) => m.name.replace(/^models\//, ''))
          .sort((a, b) => {
            const flashDiff = (a.includes('flash') ? 0 : 1) - (b.includes('flash') ? 0 : 1);
            return flashDiff !== 0 ? flashDiff : b.localeCompare(a);
          });
      } catch {
        return [];
      }
    };

    try {
      const initialModel = (model || DEFAULT_MODEL).replace(/^models\//, '');
      const triedModels = new Set();
      let { response, data, usedModel } = await callModel(initialModel);
      triedModels.add(usedModel);
      let fallbackTriggered = false;

      const tryCandidates = async (candidates, followSuggestions = false) => {
        for (const candidate of candidates) {
          if (!candidate || triedModels.has(candidate)) continue;
          triedModels.add(candidate);
          fallbackTriggered = true;
          ({ response, data, usedModel } = await callModel(candidate));
          if (response.ok) return true;
          if (followSuggestions) {
            if (await tryCandidates(extractSuggestedModels(data?.error?.message))) return true;
          }
        }
        return false;
      };

      if (!response.ok) {
        await tryCandidates(extractSuggestedModels(data?.error?.message));
      }
      if (!response.ok) {
        await tryCandidates(await fetchAvailableModels(), true);
      }

      const durationMs = Date.now() - startTime;
      if (!response.ok) {
        return {
          ok: false,
          httpStatus: response.status,
          error: redactSensitiveData(
            data?.error?.message || `Gemini API returned HTTP ${response.status}`
          ),
          usedModel,
          initialModel,
          durationMs,
        };
      }

      const text =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

      if (!text) {
        return {
          ok: false,
          errorCode: 'GN-PARSE-001',
          error: '[GN-PARSE-001] Gemini returned an empty response. Try rephrasing your request.',
          usedModel,
          initialModel,
          durationMs,
        };
      }

      return {
        ok: true,
        text,
        usedModel,
        initialModel,
        fallbackTriggered,
        httpStatus: response.status,
        durationMs,
      };
    } catch (err) {
      return {
        ok: false,
        errorCode: 'GN-NET-001',
        error: redactSensitiveData(err.message || 'Network error while contacting Gemini API.'),
        durationMs: Date.now() - startTime,
      };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
