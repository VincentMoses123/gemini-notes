const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('Gemini Notes');

/**
 * Redacts sensitive credentials (Gemini API keys, query params, Bearer tokens)
 * from strings before saving or printing to logs.
 */
function redactSensitiveData(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/AIza[0-9A-Za-z-_]{30,45}/g, 'AIzaSy***REDACTED***')
    .replace(/([?&]key=)[^&\s"']+/gi, '$1***REDACTED***')
    .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]{10,}/gi, '$1***REDACTED***')
    .replace(/(api[_-]?key["']?\s*[:=]\s*["']?)[^"',\s}{]+/gi, '$1***REDACTED***');
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
 * Denies file:, javascript:, data:, vbscript:, etc.
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
      const normalizedTarget = path.normalize(decodeURIComponent(parsed.pathname));
      const normalizedDist = path.normalize(indexHtmlPath);
      return normalizedTarget === normalizedDist;
    }
    return false;
  } catch {
    return false;
  }
}

function getStorageDir() {
  // Always use the consistent 'gemini-notes' folder in Application Support so dev and standalone .app share notes, API keys, and logs
  const appSupport = app.getPath('appData');
  const dir = path.join(appSupport, 'gemini-notes', 'notes-data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getNotesFilePath() {
  return path.join(getStorageDir(), 'notes.json');
}

function getSettingsFilePath() {
  return path.join(getStorageDir(), 'settings.json');
}

function getLogsFilePath() {
  return path.join(getStorageDir(), 'app-logs.json');
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

  // Prevent navigation hijacking: block arbitrary top-level navigation to foreign origins
  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (isAllowedLocalNavigation(targetUrl, indexHtml)) {
      return;
    }
    event.preventDefault();
    safeOpenExternal(targetUrl);
  });

  // Block creation of arbitrary child windows and delegate links to safe external browser
  win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    safeOpenExternal(targetUrl);
    return { action: 'deny' };
  });

  // Guard against unprivileged in-frame navigation
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
    const filePath = getLogsFilePath();
    let existing = [];
    if (fs.existsSync(filePath)) {
      try {
        existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        existing = [];
      }
    }
    const list = Array.isArray(existing) ? existing : [];
    const entry = {
      id: `log-startup-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      source: 'system',
      message: redactSensitiveData(`Gemini Notes runtime initialized — ${archLabel}`),
      details: redactSensitiveData(details),
    };
    const filtered = list.filter(
      (item, idx) =>
        !(idx === 0 && item && item.source === 'system' && String(item.message || '').startsWith('Gemini Notes runtime initialized'))
    );
    const updated = [entry, ...filtered].slice(0, 250);
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), { encoding: 'utf-8', mode: 0o600 });
  } catch (err) {
    console.warn('Could not write startup diagnostics log:', err.message);
  }
}

app.whenReady().then(() => {
  // Session Security: Enforce strict CSP headers for loaded documents and assets
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

  // Session Security: Intercept and deny unnecessary native permission requests
  const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write']);
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (ALLOWED_PERMISSIONS.has(permission)) {
      return callback(true);
    }
    console.warn(`[Security] Denied permission request for: ${permission}`);
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return ALLOWED_PERMISSIONS.has(permission);
  });

  // Block creation of arbitrary webviews
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });
  });

  recordStartupDiagnostics();

  // IPC: System architecture & runtime info
  ipcMain.handle('system:info', async () => {
    return {
      arch: process.arch,
      platform: process.platform,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      isAppleSilicon: process.platform === 'darwin' && process.arch === 'arm64',
    };
  });

  // IPC: Load notes
  ipcMain.handle('notes:load', async () => {
    try {
      const filePath = getNotesFilePath();
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Error loading notes:', err);
      return null;
    }
  });

  // IPC: Save notes
  ipcMain.handle('notes:save', async (_event, notes) => {
    try {
      const filePath = getNotesFilePath();
      fs.writeFileSync(filePath, JSON.stringify(notes, null, 2), { encoding: 'utf-8', mode: 0o600 });
      return { ok: true, path: filePath };
    } catch (err) {
      console.error('Error saving notes:', err);
      return { ok: false, error: err.message };
    }
  });

  // IPC: Load settings
  ipcMain.handle('settings:load', async () => {
    try {
      const filePath = getSettingsFilePath();
      const envKey = process.env.GEMINI_API_KEY || '';
      if (!fs.existsSync(filePath)) {
        return {
          apiKey: envKey,
          model: 'gemini-3-flash-preview',
          theme: 'dark',
          accentTheme: 'sapphire',
          layoutMode: 'three-column',
          storagePath: getStorageDir(),
          arch: process.arch,
          platform: process.platform,
        };
      }
      const saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const savedModel =
        !saved.model ||
        saved.model === 'gemini-2.5-flash' ||
        saved.model === 'gemini-3.0-flash'
          ? 'gemini-3-flash-preview'
          : saved.model;
      return {
        apiKey: saved.apiKey || envKey,
        model: savedModel,
        theme: saved.theme || 'dark',
        accentTheme: saved.accentTheme || 'sapphire',
        layoutMode: saved.layoutMode || 'three-column',
        folders: saved.folders,
        storagePath: getStorageDir(),
        arch: process.arch,
        platform: process.platform,
      };
    } catch (err) {
      console.error('Error loading settings:', err);
      return {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: 'gemini-3-flash-preview',
        theme: 'dark',
        accentTheme: 'sapphire',
        layoutMode: 'three-column',
        storagePath: getStorageDir(),
        arch: process.arch,
        platform: process.platform,
      };
    }
  });

  // IPC: Save settings
  ipcMain.handle('settings:save', async (_event, settings) => {
    try {
      const filePath = getSettingsFilePath();
      fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), { encoding: 'utf-8', mode: 0o600 });
      return { ok: true };
    } catch (err) {
      console.error('Error saving settings:', err);
      return { ok: false, error: err.message };
    }
  });

  // IPC: Load persistent logs
  ipcMain.handle('logs:load', async () => {
    try {
      const filePath = getLogsFilePath();
      if (!fs.existsSync(filePath)) return [];
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return [];
    }
  });

  // IPC: Append a log entry to app-logs.json
  ipcMain.handle('logs:append', async (_event, entry) => {
    try {
      const sanitizedEntry = sanitizeLogEntry(entry);
      const filePath = getLogsFilePath();
      let existing = [];
      if (fs.existsSync(filePath)) {
        try {
          existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch {
          existing = [];
        }
      }
      const updated = [sanitizedEntry, ...(Array.isArray(existing) ? existing : [])].slice(0, 250);
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), { encoding: 'utf-8', mode: 0o600 });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // IPC: Clear logs
  ipcMain.handle('logs:clear', async () => {
    try {
      const filePath = getLogsFilePath();
      fs.writeFileSync(filePath, '[]', { encoding: 'utf-8', mode: 0o600 });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // IPC: Open storage folder in Finder
  ipcMain.handle('storage:openFolder', async () => {
    shell.openPath(getStorageDir());
    return { ok: true };
  });

  // IPC: Export note to Markdown file
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

  // IPC: Call Gemini API from Main process
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

    const callModel = async (targetModel) => {
      const cleanModel = targetModel.replace(/^models\//, '');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        cleanModel
      )}:generateContent?key=${encodeURIComponent(resolvedKey)}`;

      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
        },
      };

      if (systemInstruction) {
        body.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

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
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
          resolvedKey
        )}`;
        const res = await fetch(listUrl);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.models || [])
          .filter(
            (m) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes('generateContent') &&
              m.name.includes('gemini') &&
              !m.name.includes('tts') &&
              !m.name.includes('image') &&
              !m.name.includes('vision') &&
              !m.name.includes('embedding')
          )
          .map((m) => m.name.replace(/^models\//, ''));
      } catch {
        return [];
      }
    };

    try {
      const initialModel = (model || 'gemini-3-flash-preview').replace(/^models\//, '');
      const triedModels = new Set();

      let { response, data, usedModel } = await callModel(initialModel);
      triedModels.add(usedModel);
      let fallbackTriggered = false;

      // Step 1: Check if error message explicitly suggests another model
      if (!response.ok) {
        const errMessage = data?.error?.message || '';
        const allMatches = Array.from(
          errMessage.matchAll(/models\/([a-zA-Z0-9._-]+)/g),
          (m) => m[1]
        );
        for (const candidate of allMatches) {
          if (candidate && !triedModels.has(candidate)) {
            triedModels.add(candidate);
            fallbackTriggered = true;
            const retryResult = await callModel(candidate);
            response = retryResult.response;
            data = retryResult.data;
            usedModel = retryResult.usedModel;
            if (response.ok) break;
          }
        }
      }

      // Step 2: If still not ok (e.g. 404 Not Found), query ListModels and try available flash/pro models
      if (!response.ok) {
        const available = await fetchAvailableModels();
        available.sort((a, b) => {
          const aFlash = a.includes('flash') ? 0 : 1;
          const bFlash = b.includes('flash') ? 0 : 1;
          if (aFlash !== bFlash) return aFlash - bFlash;
          return b.localeCompare(a);
        });

        for (const candidate of available) {
          if (triedModels.has(candidate)) continue;
          triedModels.add(candidate);
          fallbackTriggered = true;
          const retryResult = await callModel(candidate);
          response = retryResult.response;
          data = retryResult.data;
          usedModel = retryResult.usedModel;
          if (response.ok) break;
          const errMessage = data?.error?.message || '';
          const nextMatches = Array.from(
            errMessage.matchAll(/models\/([a-zA-Z0-9._-]+)/g),
            (m) => m[1]
          );
          for (const suggested of nextMatches) {
            if (suggested && !triedModels.has(suggested)) {
              triedModels.add(suggested);
              const suggestedRes = await callModel(suggested);
              response = suggestedRes.response;
              data = suggestedRes.data;
              usedModel = suggestedRes.usedModel;
              if (response.ok) break;
            }
          }
          if (response.ok) break;
        }
      }

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const rawErrMessage =
          data?.error?.message || `Gemini API returned HTTP ${response.status}`;
        const errMessage = redactSensitiveData(rawErrMessage);
        return {
          ok: false,
          httpStatus: response.status,
          error: errMessage,
          usedModel,
          initialModel,
          durationMs,
        };
      }

      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || '')
          .join('') || '';

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
