import { AppSettings, Note, NoteSnapshot, NoteTemplate } from '../types';

const NOTES_STORAGE_KEY = 'gemini_notes_data_v1';
const SETTINGS_STORAGE_KEY = 'gemini_notes_settings_v1';

export const DEFAULT_FOLDERS = ['General', 'Work', 'Projects', 'Journal'];

const todayLocaleDate = () => new Date().toLocaleDateString();

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'tpl-meeting',
    name: 'Meeting Notes',
    description: 'Structured agenda, key discussion points, and action items',
    folder: 'Work',
    tags: ['meeting', 'notes'],
    defaultTitle: `Meeting Notes — ${todayLocaleDate()}`,
    content: `
      <h2>📋 Meeting Overview</h2>
      <ul>
        <li><strong>Date:</strong> ${todayLocaleDate()}</li>
        <li><strong>Attendees:</strong> @name1, @name2</li>
        <li><strong>Goal:</strong> Primary objective of the meeting</li>
      </ul>
      <h2>💬 Agenda & Discussion</h2>
      <ul>
        <li>Topic 1: Key context and decisions made</li>
        <li>Topic 2: Blockers or open questions</li>
      </ul>
      <h2>✅ Action Items</h2>
      <ul>
        <li>[ ] Follow up on deliverables — <strong>Owner</strong></li>
        <li>[ ] Share summary with team — <strong>Owner</strong></li>
      </ul>
    `.trim(),
  },
  {
    id: 'tpl-journal',
    name: 'Daily Journal & Standup',
    description: 'Top 3 priorities for today, wins, and reflections',
    folder: 'Journal',
    tags: ['daily', 'journal'],
    defaultTitle: `Daily Log — ${todayLocaleDate()}`,
    content: `
      <h2>🎯 Top 3 Priorities Today</h2>
      <ol>
        <li>Most important outcome for today</li>
        <li>Secondary focus task</li>
        <li>Quick win or follow-up</li>
      </ol>
      <h2>🌟 Yesterday's Wins</h2>
      <ul>
        <li>Completed milestone...</li>
      </ul>
      <h2>🧠 Notes & Reflections</h2>
      <p>What's on your mind today?</p>
    `.trim(),
  },
  {
    id: 'tpl-prd',
    name: 'Project Spec / PRD',
    description: 'Problem statement, goals, architecture, and milestones',
    folder: 'Projects',
    tags: ['spec', 'product', 'planning'],
    defaultTitle: 'Project Specification: [Feature Name]',
    content: `
      <h2>1. Problem & Opportunity</h2>
      <p>What user problem are we solving and why does it matter now?</p>
      <h2>2. Goals & Success Metrics</h2>
      <ul>
        <li>Primary goal and measurable outcome</li>
        <li>Non-goals (what is out of scope)</li>
      </ul>
      <h2>3. Proposed Solution & Architecture</h2>
      <p>High-level design, user flow, and technical components.</p>
      <h2>4. Launch Milestones</h2>
      <ol>
        <li>Phase 1: Prototype & internal dogfooding</li>
        <li>Phase 2: Polish & launch</li>
      </ol>
    `.trim(),
  },
  {
    id: 'tpl-brainstorm',
    name: 'Brainstorm & Research',
    description: 'Explore ideas, pros/cons, and hypotheses with Gemini',
    folder: 'General',
    tags: ['brainstorm', 'research'],
    defaultTitle: 'Brainstorm: [Topic]',
    content: `
      <h2>💡 Core Concept</h2>
      <p>Describe the idea or question you are exploring...</p>
      <h2>⚖️ Pros & Cons</h2>
      <ul>
        <li><strong>Pros:</strong> High impact, fast iteration</li>
        <li><strong>Cons:</strong> Potential edge cases to resolve</li>
      </ul>
      <h2>🚀 Next Steps</h2>
      <p>Type <code>/</code> below and select <strong>Continue Writing</strong> to let Gemini brainstorm more angles!</p>
    `.trim(),
  },
];

const nowIso = new Date().toISOString();
const oneHourAgoIso = new Date(Date.now() - 3600 * 1000).toISOString();

export const DEFAULT_NOTES: Note[] = [
  {
    id: 'welcome-note-1',
    title: 'Welcome to Gemini Notes ✨',
    folder: 'General',
    content: `
      <p>Welcome to your local-first desktop note-taking space with an <strong>inline Gemini AI writing assistant</strong> built right into the editor.</p>
      <h2>How to use the Inline AI Assistant</h2>
      <ul>
        <li><strong>Select any text</strong> in your note to open the floating <strong>Ask Gemini</strong> toolbar — summarize, rewrite, expand, fix grammar, or run a custom prompt on the highlighted text.</li>
        <li><strong>Type <code>/</code> anywhere</strong> on a new line or while writing to open the <strong>Slash Command Menu</strong> for quick AI actions and rich block formatting.</li>
        <li><strong>Auto-Title & Tag:</strong> Click the <strong>Auto-Title & Tag</strong> button above to let Gemini automatically name your note, add smart <code>#tags</code>, and pick the best folder.</li>
        <li><strong>Chat with All Notes:</strong> Click <strong>Chat with Notes</strong> in the top right to ask questions across your entire notebook library!</li>
      </ul>
      <h2>Try selecting the paragraph below!</h2>
      <blockquote>We met on Tuesday to discuss the Q4 product launch. Sarah needs to finalize the onboarding mockups by Friday, and Alex will benchmark the local SQLite sync latency before next Monday's engineering review. Overall the prototype is working well, though we still need to polish the dark mode contrast and keyboard navigation.</blockquote>
      <p>Highlight the quote above and try <strong>Extract Action Items</strong>, <strong>Summarize</strong>, or <strong>Make Professional</strong>!</p>
    `.trim(),
    tags: ['welcome', 'guide', 'ai'],
    pinned: true,
    trashed: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: 'sample-brainstorm-2',
    title: 'Product Architecture & Ideas',
    folder: 'Projects',
    content: `
      <p>Here are a few rough thoughts for our upcoming project milestone:</p>
      <ul>
        <li>Fast local-first storage so notes open instantaneously offline</li>
        <li>Contextual AI tools that work directly on selected paragraphs without switching tabs</li>
        <li>Clean keyboard-driven workflow with slash commands</li>
      </ul>
      <p>Try typing <code>/</code> at the bottom of this note and choosing <strong>Continue Writing</strong> to let Gemini expand on these points!</p>
    `.trim(),
    tags: ['product', 'ideas'],
    pinned: false,
    trashed: false,
    createdAt: oneHourAgoIso,
    updatedAt: oneHourAgoIso,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: 'gemini-3-flash-preview',
  theme: 'dark',
  accentTheme: 'sapphire',
  layoutMode: 'three-column',
  storagePath: 'Local App Data',
  folders: DEFAULT_FOLDERS,
};

function readLocalJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.error(`Failed to read ${key} from localStorage:`, e);
    return null;
  }
}

function writeLocalJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to write ${key} to localStorage:`, e);
  }
}

function normalizeNotes(notes: Note[]): Note[] {
  return notes.map((n) => ({
    ...n,
    folder: n.folder || 'General',
    tags: Array.isArray(n.tags) ? n.tags : [],
  }));
}

function normalizeSettings(raw?: Partial<AppSettings> | null): AppSettings {
  if (!raw) return DEFAULT_SETTINGS;
  const folders =
    Array.isArray(raw.folders) && raw.folders.length > 0
      ? raw.folders
      : DEFAULT_FOLDERS;
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    accentTheme: raw.accentTheme || 'sapphire',
    layoutMode: raw.layoutMode || 'three-column',
    folders,
  };
}

export function prependNoteSnapshot(
  note: Pick<Note, 'title' | 'content' | 'snapshots'>,
  reason: string,
  maxSnapshots = 15
): NoteSnapshot[] {
  const snapshot: NoteSnapshot = {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: note.title || 'Untitled Note',
    content: note.content,
    reason,
    createdAt: new Date().toISOString(),
  };
  return [snapshot, ...(note.snapshots || [])].slice(0, maxSnapshots);
}

export async function loadNotesFromStorage(): Promise<Note[]> {
  if (window.electronAPI) {
    const notes = await window.electronAPI.loadNotes();
    if (Array.isArray(notes) && notes.length > 0) {
      return normalizeNotes(notes);
    }
    await window.electronAPI.saveNotes(DEFAULT_NOTES);
    return DEFAULT_NOTES;
  }

  const parsed = readLocalJson<Note[]>(NOTES_STORAGE_KEY);
  if (Array.isArray(parsed) && parsed.length > 0) {
    return normalizeNotes(parsed);
  }

  writeLocalJson(NOTES_STORAGE_KEY, DEFAULT_NOTES);
  return DEFAULT_NOTES;
}

export async function saveNotesToStorage(notes: Note[]): Promise<void> {
  if (window.electronAPI) {
    await window.electronAPI.saveNotes(notes);
  }
  writeLocalJson(NOTES_STORAGE_KEY, notes);
}

export async function loadSettingsFromStorage(): Promise<AppSettings> {
  if (window.electronAPI) {
    return normalizeSettings(await window.electronAPI.loadSettings());
  }
  return normalizeSettings(readLocalJson<Partial<AppSettings>>(SETTINGS_STORAGE_KEY));
}

export async function saveSettingsToStorage(settings: AppSettings): Promise<void> {
  if (window.electronAPI) {
    await window.electronAPI.saveSettings(settings);
  }
  writeLocalJson(SETTINGS_STORAGE_KEY, settings);
}

export function stripHtmlToText(html: string): string {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  const temp = new DOMParser().parseFromString(html, 'text/html').body;

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(walk).join('');

    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
        return `${'#'.repeat(Number(tag[1]))} ${children.trim()}\n\n`;
      case 'p':
      case 'div':
        return `${children.trim()}\n\n`;
      case 'strong':
      case 'b':
        return `**${children}**`;
      case 'em':
      case 'i':
        return `*${children}*`;
      case 'u':
        return `<u>${children}</u>`;
      case 's':
      case 'strike':
      case 'del':
        return `~~${children}~~`;
      case 'code':
        return el.parentElement?.tagName.toLowerCase() === 'pre' ? children : `\`${children}\``;
      case 'pre':
        return `\`\`\`\n${el.textContent?.trim() || ''}\n\`\`\`\n\n`;
      case 'blockquote':
        return `> ${children.trim().replace(/\n/g, '\n> ')}\n\n`;
      case 'ul':
      case 'ol':
        return (
          Array.from(el.children)
            .map((li, i) => `${tag === 'ol' ? `${i + 1}.` : '-'} ${walk(li).trim()}`)
            .join('\n') + '\n\n'
        );
      case 'hr':
        return `---\n\n`;
      case 'br':
        return `\n`;
      default:
        return children;
    }
  }

  return walk(temp).replace(/\n{3,}/g, '\n\n').trim();
}

export type NoteDateBucket =
  | 'Today'
  | 'Yesterday'
  | 'Previous 7 Days'
  | 'Previous 30 Days'
  | 'Earlier';

function parseValidDate(iso: string): Date | null {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function getNoteDateBucket(iso: string): NoteDateBucket {
  const date = parseValidDate(iso);
  if (!date) return 'Earlier';

  const now = new Date();
  const dayStart = (daysAgo: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);

  if (date >= dayStart(0)) return 'Today';
  if (date >= dayStart(1)) return 'Yesterday';
  if (date >= dayStart(7)) return 'Previous 7 Days';
  if (date >= dayStart(30)) return 'Previous 30 Days';
  return 'Earlier';
}

export function formatAppleNotesTimestamp(iso: string): string {
  const date = parseValidDate(iso);
  if (!date) return '';

  const datePart = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} at ${timePart}`;
}

export function formatShortNoteTime(iso: string): string {
  const date = parseValidDate(iso);
  if (!date) return '';

  const bucket = getNoteDateBucket(iso);
  if (bucket === 'Today') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (bucket === 'Yesterday') return 'Yesterday';
  if (bucket === 'Previous 7 Days') {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });
}
