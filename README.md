# Gemini Notes ✨

A local-first desktop note-taking app built with **Electron + React + TypeScript** featuring an inline **Gemini AI writing assistant**.

## Features

- **Floating Selection AI Toolbar**: Highlight any text in your note to immediately improve writing, summarize, fix grammar, expand, or run a custom prompt.
- **Slash (`/`) Command Palette**: Type `/` anywhere in the editor to trigger Gemini AI actions (*Continue Writing*, *Summarize Note*, *Extract Action Items*, *Custom Prompt*) or apply rich block formatting (*Headings*, *Lists*, *Quotes*, *Dividers*).
- **Inline AI Preview & Diff Replacement**: Preview Gemini's generated output before choosing to **Replace Selection**, **Insert Below**, **Copy**, or **Retry**.
- **Local-First Storage**: Notes and settings are saved automatically as JSON in your local macOS Application Support directory (with Markdown `.md` export built in).
- **Dark & Light Themes**: Toggle between sleek dark and light modes.

## Quick Start

```bash
cd "gemini-notes"
npm install
npm run dev
```

To configure your Gemini API key:
1. Click **Gemini Settings** in the bottom-left sidebar (or press `⌘,`), or
2. Set `GEMINI_API_KEY` in your environment before launching.
