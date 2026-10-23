# Gemini Notes ✨

A local-first desktop note-taking app built with **Electron + React + TypeScript** featuring an inline **Gemini AI writing assistant**, multi-note AI knowledge base chat, smart auto-tagging, templates, version snapshots, and built-in diagnostics logging.

## Features

- **Floating Selection AI Toolbar**: Highlight any text in your note to immediately improve writing, summarize, fix grammar, expand, or run a custom prompt.
- **Slash (`/`) Command Palette**: Type `/` anywhere in the editor to trigger Gemini AI actions (*Continue Writing*, *Summarize Note*, *Extract Action Items*, *Generate Pros & Cons*, *Study Flashcards*, *Explain Simply / ELI5*, *Custom Prompt*) or apply rich block formatting.
- **Chat with All Notes (`⌘J`)**: Right-hand AI knowledge base drawer that reads across all your active notes, answers questions, cites referenced notes with clickable pills, and saves syntheses as new notes.
- **One-Click Auto-Title & Auto-Tagging**: Automatically generates a descriptive title, 3–5 `#tags`, and assigns the best matching Notebook folder based on your note's content.
- **Templates Gallery & AI Template Builder**: Start from built-in templates (*Meeting Notes*, *Daily Journal & Standup*, *Project Spec / PRD*, *Brainstorm & Research*) or generate custom templates on any topic with Gemini.
- **Version Snapshots & Zen Focus Mode (`⌘\`)**: Automatically saves checkpoints before AI replacements and lets you restore earlier versions anytime.
- **Diagnostics, Activity Logs & Error Codes (`⌘L`)**: Built-in live event logger (`app-logs.json`) tracking model latency, automatic model fallbacks, and structured `GN-*` error codes.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘K` | Open Spotlight Command Palette & Note Search |
| `⌘N` | Create New Blank Note |
| `⌘J` | Toggle "Chat with All Notes" AI Sidebar |
| `⌘L` | Open Diagnostics, Activity Logs & Error Codes |
| `⌘\` | Toggle Zen Focus Writing Mode |
| `⌘,` | Open Gemini API & App Settings |
| `/` | Open Inline Editor Slash Command Menu |

## Error Code Reference (`GN-*`)

| Code | Title | Cause & Resolution |
| --- | --- | --- |
| `GN-AUTH-001` | Missing Gemini API Key | No API key found. Open Settings (`⌘,`) and add your key from `aistudio.google.com`. |
| `GN-AUTH-002` | Invalid / Unauthorized API Key (`HTTP 401/403`) | Key was rejected by Google AI Studio. Check for typos and click **Test Gemini Connection**. |
| `GN-MODEL-001` | Model Deprecated or Not Found (`HTTP 404`) | Requested model is retired; Gemini Notes automatically queries `ListModels` and switches to an active model. |
| `GN-QUOTA-001` | Rate Limit / Quota Exceeded (`HTTP 429`) | Rate limit reached. Wait 15–30s and retry, or switch to a Flash model. |
| `GN-NET-001` | Network / DNS Failure | Offline or firewall issue reaching `generativelanguage.googleapis.com`. Local notes continue to work offline. |
| `GN-PARSE-001` | AI Response Empty or Malformed | Empty candidate or malformed JSON response. Click Retry or rephrase your prompt. |
| `GN-FS-001` | Local Storage Read/Write Error | Error reading/writing `notes.json` or `settings.json` in Application Support. |
| `GN-INPUT-001` | Empty Input Context | AI tool triggered on an empty note or selection. Write a few words first. |

## Quick Start

```bash
npm install
npm start
```

### Build Standalone macOS `.app`

```bash
npm run package:mac
```

Outputs a signed standalone application bundle at `release/Gemini Notes.app`.

## Git Branching & Release Workflow (`test` → `main`)

This repository uses a two-stage **Test → Production** branching workflow:

| Branch | Role | Workflow |
| --- | --- | --- |
| `test` | **Staging / Testing (Default Working Branch)** | All new features, bug fixes, and UI changes are developed, committed, and pushed to `origin/test` first. Test builds are verified via `npm start` or `release/Gemini Notes.app`. |
| `main` | **Production** | Stable, verified production branch. Only merge `test` into `main` (`git checkout main && git merge test && git push origin main`) and update `Desktop/Gemini Notes.app` after explicit verification. |

