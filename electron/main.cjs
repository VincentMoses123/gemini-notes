const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function getStorageDir() {
  // Always use the consistent 'gemini-notes' folder in Application Support so dev and standalone .app share notes & API keys
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

function createWindow() {
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 880,
    minHeight: 560,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = 'http://localhost:5173';
  const indexHtml = path.join(__dirname, '../dist/index.html');
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

app.whenReady().then(() => {
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
      fs.writeFileSync(filePath, JSON.stringify(notes, null, 2), 'utf-8');
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
          model: 'gemini-3.0-flash',
          theme: 'dark',
          storagePath: getStorageDir(),
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
        folders: saved.folders,
        storagePath: getStorageDir(),
      };
    } catch (err) {
      console.error('Error loading settings:', err);
      return {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: 'gemini-3.0-flash',
        theme: 'dark',
        storagePath: getStorageDir(),
      };
    }
  });

  // IPC: Save settings
  ipcMain.handle('settings:save', async (_event, settings) => {
    try {
      const filePath = getSettingsFilePath();
      fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
      return { ok: true };
    } catch (err) {
      console.error('Error saving settings:', err);
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
    const resolvedKey = (apiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!resolvedKey) {
      return {
        ok: false,
        error: 'Missing Gemini API key. Click "Settings" in the sidebar to add your Gemini API key.',
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
      const initialModel = model || 'gemini-2.5-flash';
      const triedModels = new Set();

      let { response, data, usedModel } = await callModel(initialModel);
      triedModels.add(usedModel);

      // Step 1: Check if error message explicitly suggests another model (e.g. "Please update your code to use models/...")
      if (!response.ok) {
        const errMessage = data?.error?.message || '';
        const allMatches = Array.from(
          errMessage.matchAll(/models\/([a-zA-Z0-9._-]+)/g),
          (m) => m[1]
        );
        for (const candidate of allMatches) {
          if (candidate && !triedModels.has(candidate)) {
            triedModels.add(candidate);
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
        // Sort to prefer latest flash models first
        available.sort((a, b) => {
          const aFlash = a.includes('flash') ? 0 : 1;
          const bFlash = b.includes('flash') ? 0 : 1;
          if (aFlash !== bFlash) return aFlash - bFlash;
          return b.localeCompare(a);
        });

        for (const candidate of available) {
          if (triedModels.has(candidate)) continue;
          triedModels.add(candidate);
          const retryResult = await callModel(candidate);
          response = retryResult.response;
          data = retryResult.data;
          usedModel = retryResult.usedModel;
          if (response.ok) break;
          // Also check if this model's error points to a specific replacement model
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

      if (!response.ok) {
        const errMessage =
          data?.error?.message || `Gemini API returned HTTP ${response.status}`;
        return { ok: false, error: errMessage };
      }

      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || '')
          .join('') || '';

      if (!text) {
        return {
          ok: false,
          error: 'Gemini returned an empty response. Try rephrasing your request.',
        };
      }

      return { ok: true, text, usedModel };
    } catch (err) {
      return {
        ok: false,
        error: err.message || 'Network error while contacting Gemini API.',
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
