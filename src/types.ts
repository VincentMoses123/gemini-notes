export interface Note {
  id: string;
  title: string;
  content: string; // Rich HTML content
  folder: string;
  tags: string[];
  pinned: boolean;
  trashed: boolean;
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

export interface ElectronAPI {
  loadNotes: () => Promise<Note[] | null>;
  saveNotes: (notes: Note[]) => Promise<{ ok: boolean; path?: string; error?: string }>;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<{ ok: boolean; error?: string }>;
  openStorageFolder: () => Promise<{ ok: boolean }>;
  exportMarkdown: (payload: { title: string; markdown: string }) => Promise<{ ok: boolean; filePath?: string }>;
  generateWithGemini: (payload: {
    apiKey: string;
    model: string;
    systemInstruction?: string;
    prompt: string;
  }) => Promise<{ ok: boolean; text?: string; usedModel?: string; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
