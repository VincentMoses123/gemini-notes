const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('Gemini Notes');

const MAX_LOG_ENTRIES = 250;
const DEFAULT_MODEL = 'gemini-3-flash-preview';
const LEGACY_MODELS = new Set(['gemini-2.5-flash', 'gemini-3.0-flash']);

const REDACTION_PATTERNS = [
  [/AIza[0-9A-Za-z-_]{30,45}/g, 'AIzaSy***REDACTED***'],
  [/([?&]key=)[^&\s"']+/gi, '$1***REDACTED***'],
  [/(Bearer\s+)[A-Za-z0-9_\-\.]{10,}/gi, '$1***REDACTED***'],
  [/(api[_-]?key["']?\s*[:=]\s*["']?)[^"',\s}{]+/gi, '$1***REDACTED***'],
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
  return {
    ...entry,
    message: redactSensitiveData(entry.message),
    details: typeof entry.details === 'string' ? redactSensitiveData(entry.details) : entry.details,
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
  console.warn(`[Security] Blocked external navigation to untrusted protocol/URL: ${rawUrl}`);
  return false;
}

/**
 * Validates whether a navigation URL is within the authorized local application boundaries.
 */
function isAllowedLocalNavigation(targetUrl, indexHtmlPath) {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
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

function getStorageDir() {
  const dir = path.join(app.getPath('appData'), 'gemini-notes', 'notes-data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const getStorageFilePath = (name) => path.join(getStorageDir(), name);
const getNotesFilePath = () => getStorageFilePath('notes.json');
const getSettingsFilePath = () => getStorageFilePath('settings.json');
const getLogsFilePath = () => getStorageFilePath('app-logs.json');

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
    const isDev =
      !app.isPackaged &&
      !process.argv.includes('--use-dist') &&
      process.env.USE_DIST !== 'true';

    const csp = isDev
      ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:5173 ws://localhost:5173 https://generativelanguage.googleapis.com; object-src 'none'; base-uri 'self';"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';";

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

  ipcMain.handle('system:info', async () => ({
    arch: process.arch,
    platform: process.platform,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
    isAppleSilicon: process.platform === 'darwin' && process.arch === 'arm64',
  }));

  ipcMain.handle('notes:load', async () => readJsonFile(getNotesFilePath(), null));
  ipcMain.handle('notes:save', async (_event, notes) =>
    saveJsonWithResult(getNotesFilePath(), notes, true)
  );

  ipcMain.handle('settings:load', async () =>
    buildSettingsPayload(readJsonFile(getSettingsFilePath(), {}))
  );
  ipcMain.handle('settings:save', async (_event, settings) =>
    saveJsonWithResult(getSettingsFilePath(), settings)
  );

  ipcMain.handle('logs:load', async () => {
    const logs = readJsonFile(getLogsFilePath(), []);
    return Array.isArray(logs) ? logs : [];
  });
  ipcMain.handle('logs:append', async (_event, entry) => {
    try {
      prependLogEntry(entry);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('logs:clear', async () => saveJsonWithResult(getLogsFilePath(), []));

  ipcMain.handle('storage:openFolder', async () => {
    shell.openPath(getStorageDir());
    return { ok: true };
  });

  ipcMain.handle('notes:exportMarkdown', async (_event, { title, markdown }) => {
    const safeName = (title || 'Untitled Note').replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'note';
    const result = await dialog.showSaveDialog({
      title: 'Export Note as Markdown',
      defaultPath: `${safeName}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, markdown, 'utf-8');
      return { ok: true, filePath: result.filePath };
    }
    return { ok: false };
  });

  ipcMain.handle('gemini:generate', async (_event, { apiKey, model, systemInstruction, prompt }) => {
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

    const callModel = async (targetModel) => {
      const cleanModel = targetModel.replace(/^models\//, '');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        cleanModel
      )}:generateContent?key=${encodeURIComponent(resolvedKey)}`;

      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
        ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return { response, data, usedModel: cleanModel };
    };

    const fetchAvailableModels = async () => {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(resolvedKey)}`
        );
        if (!res.ok) return [];
        const data = await res.json();
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
