export interface NoteSnapshot {
  id: string;
  title: string;
  content: string;
  reason: string; // e.g., "Before AI Replace", "Manual Snapshot"
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string; // Rich HTML content
  folder: string;
  tags: string[];
  pinned: boolean;
  trashed: boolean;
  snapshots?: NoteSnapshot[];
  createdAt: string;
  updatedAt: string;
}

export type GeminiModel =
  | 'gemini-3-flash-preview'
  | 'gemini-3.0-flash'
  | 'gemini-3.0-pro'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | string;

export interface AppSettings {
  apiKey: string;
  model: GeminiModel;
  theme: 'dark' | 'light';
  storagePath?: string;
  folders?: string[];
}

export type AIActionType =
  | 'summarize'
  | 'rewrite'
  | 'fix_grammar'
  | 'expand'
  | 'shorten'
  | 'bullet_points'
  | 'action_items'
  | 'tone_professional'
  | 'tone_casual'
  | 'continue_writing'
  | 'pros_cons'
  | 'explain_simply'
  | 'study_flashcards'
  | 'translate'
  | 'custom';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citedNotes?: { id: string; title: string }[];
  createdAt: string;
}

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  folder: string;
  tags: string[];
  defaultTitle: string;
  content: string;
}

export type ErrorCode =
  | 'GN-AUTH-001'
  | 'GN-AUTH-002'
  | 'GN-MODEL-001'
  | 'GN-QUOTA-001'
  | 'GN-NET-001'
  | 'GN-PARSE-001'
  | 'GN-FS-001'
  | 'GN-INPUT-001'
  | 'GN-UNKNOWN-999';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  code?: ErrorCode;
  source: 'gemini-api' | 'storage' | 'editor' | 'system';
  message: string;
  details?: string;
  durationMs?: number;
  model?: string;
}

export interface ErrorCodeDefinition {
  code: ErrorCode;
  title: string;
  severity: LogLevel;
  cause: string;
  resolution: string;
}

export interface ElectronAPI {
  loadNotes: () => Promise<Note[] | null>;
  saveNotes: (notes: Note[]) => Promise<{ ok: boolean; path?: string; error?: string }>;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<{ ok: boolean; error?: string }>;
  loadLogs: () => Promise<LogEntry[]>;
  appendLog: (entry: LogEntry) => Promise<{ ok: boolean }>;
  clearLogs: () => Promise<{ ok: boolean }>;
  openStorageFolder: () => Promise<{ ok: boolean }>;
  exportMarkdown: (payload: { title: string; markdown: string }) => Promise<{ ok: boolean; filePath?: string }>;
  generateWithGemini: (payload: {
    apiKey: string;
    model: string;
    systemInstruction?: string;
    prompt: string;
  }) => Promise<{
    ok: boolean;
    text?: string;
    usedModel?: string;
    fallbackTriggered?: boolean;
    initialModel?: string;
    httpStatus?: number;
    errorCode?: ErrorCode;
    error?: string;
    durationMs?: number;
  }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
