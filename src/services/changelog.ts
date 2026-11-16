import { ChangelogRelease } from '../types';

export const CURRENT_APP_VERSION = '0.4.0-beta';
export const APP_RELEASE_CHANNEL = 'BETA';

export const APP_CHANGELOG: ChangelogRelease[] = [
  {
    version: '0.4.0-beta',
    channel: 'BETA',
    date: 'November 15, 2026',
    title: 'Zero-Text AI Drafting, Settings-Only Themes & Beta Release Notes',
    summary:
      'Generate structured content directly on blank notes, customize themes and accents in a dedicated Settings studio, and review Beta release notes in-app.',
    highlights: [
      {
        title: 'Generate with Gemini from Scratch',
        description:
          'Open Ask Gemini or trigger any AI quick pill / "/" slash command on a blank note to draft guides, outlines, flashcards, or pros & cons without needing existing note text.',
      },
      {
        title: 'Settings-Only Theme & Accent Studio',
        description:
          'Moved surface themes (Dark, Midnight, Light, Sepia) and 9 Accent Colors exclusively into Settings (⌘,) with live preview cards and instant save.',
      },
      {
        title: "What's New Popup & In-App Changelog",
        description:
          'Added a once-per-update startup release summary and a full Beta changelog inside Settings.',
      },
    ],
  },
  {
    version: '0.3.0-beta',
    channel: 'BETA',
    date: 'November 14, 2026',
    title: 'CISO Zero-Trust Security Hardening',
    summary:
      'Completed a full security audit hardening API key transport, IPC origin checks, local file permissions, Content Security Policy, and editor paste sanitization.',
    highlights: [
      {
        title: 'Header-Only Gemini API Authentication',
        description:
          'Switched all Gemini REST requests to x-goog-api-key headers and expanded log credential redaction.',
      },
      {
        title: 'IPC Sender Verification & Storage Lockdown',
        description:
          'Enforced trusted-frame validation across all 15 Electron IPC handlers, purged Chromium localStorage shadow data, and locked local files to 0o600/0o700.',
      },
      {
        title: 'Beacon-Free CSP & Clipboard Sanitization',
        description:
          "Restricted img-src to 'self' data: blob: and sanitized rich HTML paste in the editor.",
      },
    ],
  },
  {
    version: '0.2.0-beta',
    channel: 'BETA',
    date: 'November 14, 2026',
    title: 'Personal Knowledge Base Vault & Native PDF Export',
    summary:
      'Added local document ingestion for citation-backed RAG responses and isolated native macOS PDF export.',
    highlights: [
      {
        title: 'Personal Knowledge Base (⌘⇧K)',
        description:
          'Import local PDFs, Markdown, Word/RTF, CSV, JSON, and text files as RAG context with automatic source citations.',
      },
      {
        title: 'Native macOS PDF Export (⌘⇧E)',
        description:
          'Export formatted notes to Letter, A4, or Legal PDFs via an isolated offline renderer.',
      },
    ],
  },
  {
    version: '0.1.0-beta',
    channel: 'BETA',
    date: 'November 1, 2026',
    title: 'Initial Apple Notes Studio & Inline Gemini 3 Assistant',
    summary:
      'Introduced the local-first macOS note-taking studio with an inline Gemini 3 writing assistant and whole-library chat.',
    highlights: [
      {
        title: 'Apple Notes 3-Column & 2-Column Workspace',
        description:
          'Folders, #tags, pinned notes, chrono-grouped note list, version snapshots, and Zen Focus mode (⌘\\).',
      },
      {
        title: 'Inline Gemini 3 Writing Assistant',
        description:
          'Selection bubble menu, "/" slash commands, Auto-Title & Tag, AI templates, and Chat with All Notes (⌘J).',
      },
    ],
  },
];

export function getLatestRelease(): ChangelogRelease {
  return APP_CHANGELOG[0];
}
