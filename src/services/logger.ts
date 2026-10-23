import { ErrorCode, ErrorCodeDefinition, LogEntry, LogLevel } from '../types';

const LOGS_STORAGE_KEY = 'gemini_notes_logs_v1';
const MAX_LOGS = 250;

export const ERROR_CODE_CATALOG: ErrorCodeDefinition[] = [
  {
    code: 'GN-AUTH-001',
    title: 'Missing Gemini API Key',
    severity: 'error',
    cause: 'No Gemini API key was found in Settings or the GEMINI_API_KEY environment variable.',
    resolution: 'Open Gemini Settings (⌘,) and paste a valid API key from Google AI Studio (aistudio.google.com).',
  },
  {
    code: 'GN-AUTH-002',
    title: 'Invalid or Unauthorized API Key (HTTP 400/401/403)',
    severity: 'error',
    cause: 'The Gemini API rejected the provided API key as invalid, expired, or lacking Generative Language API permissions.',
    resolution: 'Verify your key in Google AI Studio, ensure there are no trailing spaces, and click "Test Gemini Connection" in Settings.',
  },
  {
    code: 'GN-MODEL-001',
    title: 'Model Deprecated or Not Found (HTTP 404)',
    severity: 'warn',
    cause: 'The requested Gemini model ID is retired for new users or unavailable on v1beta.',
    resolution: 'Gemini Notes automatically queries ListModels and switches to an active model (such as gemini-3-flash-preview). You can also change models in Settings.',
  },
  {
    code: 'GN-QUOTA-001',
    title: 'Rate Limit or Quota Exceeded (HTTP 429)',
    severity: 'error',
    cause: 'Too many requests were sent in a short window or your Google AI Studio tier quota was reached.',
    resolution: 'Wait 15–30 seconds and click Retry, or switch to a Flash model in Settings for higher rate limits.',
  },
  {
    code: 'GN-NET-001',
    title: 'Network or DNS Connection Failure',
    severity: 'error',
    cause: 'Unable to reach generativelanguage.googleapis.com due to offline status, firewall, or DNS error.',
    resolution: 'Check your internet connection. Note that all local note editing and saving continue to work 100% offline.',
  },
  {
    code: 'GN-PARSE-001',
    title: 'AI Response Empty or Malformed',
    severity: 'warn',
    cause: 'Gemini returned an empty candidate (often due to safety filters) or non-JSON output during Auto-Title/Tag.',
    resolution: 'Click Retry or rephrase your prompt slightly.',
  },
  {
    code: 'GN-FS-001',
    title: 'Local Storage Read/Write Error',
    severity: 'error',
    cause: 'Failed to read or write notes.json or settings.json in Application Support.',
    resolution: 'Check disk space and folder permissions via Settings → Show in Finder.',
  },
  {
    code: 'GN-INPUT-001',
    title: 'Empty Input Context',
    severity: 'warn',
    cause: 'An AI action was triggered on an empty note or empty text selection.',
    resolution: 'Type a few words or select text in the editor before running the AI tool.',
  },
  {
    code: 'GN-UNKNOWN-999',
    title: 'Unexpected Application / API Error',
    severity: 'error',
    cause: 'An unclassified runtime or upstream API error occurred.',
    resolution: 'Inspect the "Details" payload in the Diagnostics & Logs viewer for the raw error message.',
  },
];

export function classifyErrorCode(
  message: string,
  httpStatus?: number
): ErrorCode {
  const lower = (message || '').toLowerCase();
  if (lower.includes('missing gemini api key')) {
    return 'GN-AUTH-001';
  }
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission denied')
  ) {
    return 'GN-AUTH-002';
  }
  if (
    httpStatus === 404 ||
    lower.includes('not found') ||
    lower.includes('no longer available') ||
    lower.includes('is not supported for generatecontent')
  ) {
    return 'GN-MODEL-001';
  }
  if (
    httpStatus === 429 ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('resource has been exhausted')
  ) {
    return 'GN-QUOTA-001';
  }
  if (
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('enotfound') ||
    lower.includes('failed to reach')
  ) {
    return 'GN-NET-001';
  }
  if (
    lower.includes('empty response') ||
    lower.includes('parse') ||
    lower.includes('json')
  ) {
    return 'GN-PARSE-001';
  }
  return 'GN-UNKNOWN-999';
}

let memoryLogs: LogEntry[] = [];
const listeners = new Set<(logs: LogEntry[]) => void>();

function notifyListeners() {
  const snapshot = [...memoryLogs];
  listeners.forEach((cb) => cb(snapshot));
}

export async function initLogger(): Promise<LogEntry[]> {
  if (window.electronAPI?.loadLogs) {
    try {
      const diskLogs = await window.electronAPI.loadLogs();
      if (Array.isArray(diskLogs)) {
        memoryLogs = diskLogs.slice(0, MAX_LOGS);
        notifyListeners();
        return memoryLogs;
      }
    } catch (e) {
      console.error('Failed to load disk logs:', e);
    }
  }

  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryLogs = parsed.slice(0, MAX_LOGS);
      }
    }
  } catch {
    // ignore
  }

  if (memoryLogs.length === 0) {
    await logEvent({
      level: 'info',
      source: 'system',
      message: 'Gemini Notes initialized and local storage mounted.',
      details: `Platform: ${navigator.platform} | Electron IPC: ${Boolean(
        window.electronAPI
      )}`,
    });
  } else {
    notifyListeners();
  }

  return memoryLogs;
}

export async function logEvent(params: {
  level: LogLevel;
  source: LogEntry['source'];
  message: string;
  code?: ErrorCode;
  details?: string;
  durationMs?: number;
  model?: string;
}): Promise<LogEntry> {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level: params.level,
    source: params.source,
    message: params.message,
    code: params.code,
    details: params.details,
    durationMs: params.durationMs,
    model: params.model,
  };

  memoryLogs = [entry, ...memoryLogs].slice(0, MAX_LOGS);
  notifyListeners();

  if (window.electronAPI?.appendLog) {
    window.electronAPI.appendLog(entry).catch(() => {});
  }
  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(memoryLogs));
  } catch {
    // ignore
  }

  return entry;
}

export function getLogs(): LogEntry[] {
  return [...memoryLogs];
}

export async function clearAllLogs(): Promise<void> {
  memoryLogs = [];
  notifyListeners();
  if (window.electronAPI?.clearLogs) {
    await window.electronAPI.clearLogs();
  }
  try {
    localStorage.removeItem(LOGS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function subscribeToLogs(
  callback: (logs: LogEntry[]) => void
): () => void {
  listeners.add(callback);
  callback([...memoryLogs]);
  return () => {
    listeners.delete(callback);
  };
}
