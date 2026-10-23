import { AppSettings, Note, NoteTemplate } from '../types';

const NOTES_STORAGE_KEY = 'gemini_notes_data_v1';
const SETTINGS_STORAGE_KEY = 'gemini_notes_settings_v1';

export const DEFAULT_FOLDERS = ['General', 'Work', 'Projects', 'Journal'];

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'tpl-meeting',
    name: 'Meeting Notes',
    description: 'Structured agenda, key discussion points, and action items',
    folder: 'Work',
    tags: ['meeting', 'notes'],
    defaultTitle: `Meeting Notes — ${new Date().toLocaleDateString()}`,
    content: `
      <h2>📋 Meeting Overview</h2>
      <ul>
        <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
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
    defaultTitle: `Daily Log — ${new Date().toLocaleDateString()}`,
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: 'gemini-3-flash-preview',
  theme: 'dark',
  storagePath: 'Local App Data',
  folders: DEFAULT_FOLDERS,
};

function normalizeNotes(notes: Note[]): Note[] {
  return notes.map((n) => ({
    ...n,
    folder: n.folder || 'General',
    tags: Array.isArray(n.tags) ? n.tags : [],
  }));
}

export async function loadNotesFromStorage(): Promise<Note[]> {
  if (window.electronAPI) {
    const notes = await window.electronAPI.loadNotes();
    if (notes && Array.isArray(notes) && notes.length > 0) {
      return normalizeNotes(notes);
    }
    await window.electronAPI.saveNotes(DEFAULT_NOTES);
    return DEFAULT_NOTES;
  }

  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeNotes(parsed);
      }
    }
  } catch (e) {
    console.error('Failed to load notes from localStorage:', e);
  }

  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(DEFAULT_NOTES));
  return DEFAULT_NOTES;
}

export async function saveNotesToStorage(notes: Note[]): Promise<void> {
  if (window.electronAPI) {
    await window.electronAPI.saveNotes(notes);
  }
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save notes to localStorage:', e);
  }
}

export async function loadSettingsFromStorage(): Promise<AppSettings> {
  if (window.electronAPI) {
    const settings = await window.electronAPI.loadSettings();
    const folders =
      Array.isArray(settings.folders) && settings.folders.length > 0
        ? settings.folders
        : DEFAULT_FOLDERS;
    return { ...DEFAULT_SETTINGS, ...settings, folders };
  }

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const folders =
        Array.isArray(parsed.folders) && parsed.folders.length > 0
          ? parsed.folders
          : DEFAULT_FOLDERS;
      return { ...DEFAULT_SETTINGS, ...parsed, folders };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export async function saveSettingsToStorage(settings: AppSettings): Promise<void> {
  if (window.electronAPI) {
    await window.electronAPI.saveSettings(settings);
  }
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function stripHtmlToText(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

export function htmlToMarkdown(html: string): string {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes).map(walk).join('');

    switch (tag) {
      case 'h1':
        return `# ${children.trim()}\n\n`;
      case 'h2':
        return `## ${children.trim()}\n\n`;
      case 'h3':
        return `### ${children.trim()}\n\n`;
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
        return el.parentElement?.tagName.toLowerCase() === 'pre'
          ? children
          : `\`${children}\``;
      case 'pre':
        return `\`\`\`\n${el.textContent?.trim() || ''}\n\`\`\`\n\n`;
      case 'blockquote':
        return `> ${children.trim().replace(/\n/g, '\n> ')}\n\n`;
      case 'ul':
        return (
          Array.from(el.children)
            .map((li) => `- ${walk(li).trim()}`)
            .join('\n') + '\n\n'
        );
      case 'ol':
        return (
          Array.from(el.children)
            .map((li, i) => `${i + 1}. ${walk(li).trim()}`)
            .join('\n') + '\n\n'
        );
      case 'li':
        return children;
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
