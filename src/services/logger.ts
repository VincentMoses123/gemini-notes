import { ErrorCode, ErrorCodeDefinition, LogEntry, LogLevel } from '../types';

const LOGS_STORAGE_KEY = 'gemini_notes_logs_v1';
const MAX_LOGS = 250;

const REDACTION_PATTERNS: Array<[RegExp, string]> = [
  [/AIza[0-9A-Za-z-_]{30,45}/g, 'AIzaSy***REDACTED***'],
  [/([?&]key=)[^&\s"']+/gi, '$1***REDACTED***'],
  [/(Bearer\s+)[A-Za-z0-9_\-\.]{10,}/gi, '$1***REDACTED***'],
  [/(api[_-]?key["']?\s*[:=]\s*["']?)[^"',\s}{]+/gi, '$1***REDACTED***'],
];

/**
 * Redacts sensitive credentials (Google/Gemini API keys, bearer tokens, query parameters)
 * to prevent accidental credential leakage in logs or crash dumps.
 */
export function redactSensitiveString(str?: string): string {
  if (!str || typeof str !== 'string') return str || '';
  return REDACTION_PATTERNS.reduce((acc, [regex, replacement]) => acc.replace(regex, replacement), str);
}

export function sanitizeLogEntry(entry: LogEntry): LogEntry {
  if (!entry || typeof entry !== 'object') return entry;
  return {
    ...entry,
    message: redactSensitiveString(entry.message),
    details: entry.details ? redactSensitiveString(entry.details) : undefined,
  };
}

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

const ERROR_CLASSIFICATION_RULES: Array<{
  code: ErrorCode;
  statuses?: number[];
  keywords: string[];
}> = [
  { code: 'GN-AUTH-001', keywords: ['missing gemini api key'] },
  {
    code: 'GN-AUTH-002',
    statuses: [401, 403],
    keywords: ['api_key_invalid', 'api key not valid', 'permission denied'],
  },
  {
    code: 'GN-MODEL-001',
    statuses: [404],
    keywords: ['not found', 'no longer available', 'is not supported for generatecontent'],
  },
  {
    code: 'GN-QUOTA-001',
    statuses: [429],
    keywords: ['quota', 'rate limit', 'resource has been exhausted'],
  },
  {
    code: 'GN-NET-001',
    keywords: ['network', 'fetch failed', 'enotfound', 'failed to reach'],
  },
  {
    code: 'GN-PARSE-001',
    keywords: ['empty response', 'parse', 'json'],
  },
];

export function classifyErrorCode(message: string, httpStatus?: number): ErrorCode {
  const lower = (message || '').toLowerCase();
  for (const rule of ERROR_CLASSIFICATION_RULES) {
    if (
      (httpStatus !== undefined && rule.statuses?.includes(httpStatus)) ||
      rule.keywords.some((kw) => lower.includes(kw))
    ) {
      return rule.code;
    }
  }
  return 'GN-UNKNOWN-999';
}

let memoryLogs: LogEntry[] = [];
const listeners = new Set<(logs: LogEntry[]) => void>();

function updateMemoryLogs(next: LogEntry[], persistLocal = false) {
  memoryLogs = next.slice(0, MAX_LOGS);
  const snapshot = [...memoryLogs];
  listeners.forEach((cb) => cb(snapshot));
  if (persistLocal) {
    try {
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(memoryLogs));
    } catch {
      // ignore
    }
  }
}

export async function initLogger(): Promise<LogEntry[]> {
  if (window.electronAPI?.loadLogs) {
    try {
      const diskLogs = await window.electronAPI.loadLogs();
      if (Array.isArray(diskLogs)) {
        updateMemoryLogs(diskLogs.map(sanitizeLogEntry));
        return memoryLogs;
      }
    } catch (e) {
      console.error('Failed to load disk logs:', e);
    }
  }

  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      memoryLogs = parsed.map(sanitizeLogEntry).slice(0, MAX_LOGS);
    }
  } catch {
    // ignore
  }

  if (memoryLogs.length === 0) {
    await logEvent({
      level: 'info',
      source: 'system',
      message: 'Gemini Notes initialized and local storage mounted.',
      details: `Platform: ${navigator.platform} | Electron IPC: ${Boolean(window.electronAPI)}`,
    });
  } else {
    updateMemoryLogs(memoryLogs);
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
  const entry = sanitizeLogEntry({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...params,
  });

  updateMemoryLogs([entry, ...memoryLogs], true);
  window.electronAPI?.appendLog?.(entry).catch(() => {});
  return entry;
}

export function getLogs(): LogEntry[] {
  return [...memoryLogs];
}

export async function clearAllLogs(): Promise<void> {
  updateMemoryLogs([]);
  await window.electronAPI?.clearLogs?.();
  try {
    localStorage.removeItem(LOGS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function subscribeToLogs(callback: (logs: LogEntry[]) => void): () => void {
  listeners.add(callback);
  callback([...memoryLogs]);
  return () => {
    listeners.delete(callback);
  };
}
