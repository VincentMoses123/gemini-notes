/**
 * Gemini Notes (v0.4.0-beta) — Official Landing Website Controller
 * Powers:
 * 1. Surface Theme Switcher (Dark, Midnight, Light, Sepia) & Header Toggle
 * 2. Studio Accent Switcher (Sapphire, Emerald, Copper, Indigo, Slate, Rose, Violet, Coral, Teal)
 * 3. Hero macOS 3-Column / 2-Column Mock Window & Note Switcher (incl. Zero-Text Blank Draft)
 * 4. Interactive Live Gemini AI Demo Workbench with Streaming Preview
 * 5. Accessible FAQ Accordion
 * 6. Launch Trailer Modal Player & Download Checksum Copy Helpers
 */

(function () {
  'use strict';

  const rootHtml = document.documentElement;

  /* --------------------------------------------------------------------------
   * 1. Surface Theme Toggle & 4-Theme Selector (Dark, Midnight, Light, Sepia)
   * -------------------------------------------------------------------------- */
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const surfaceThemeButtons = document.querySelectorAll('[data-set-surface]');

  function setSurfaceTheme(themeKey) {
    rootHtml.setAttribute('data-theme', themeKey);
    surfaceThemeButtons.forEach((btn) => {
      const isMatch = btn.getAttribute('data-set-surface') === themeKey;
      btn.classList.toggle('active', isMatch);
    });
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = rootHtml.getAttribute('data-theme') || 'dark';
      const isLightLike = current === 'light' || current === 'sepia';
      setSurfaceTheme(isLightLike ? 'dark' : 'light');
    });
  }

  surfaceThemeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const themeKey = btn.getAttribute('data-set-surface');
      if (themeKey) setSurfaceTheme(themeKey);
    });
  });

  /* --------------------------------------------------------------------------
   * 2. Studio Color Palette Switcher
   * -------------------------------------------------------------------------- */
  const accentTriggers = document.querySelectorAll('[data-set-accent]');
  function setAccentPalette(accentKey) {
    rootHtml.setAttribute('data-accent', accentKey);
    accentTriggers.forEach((btn) => {
      const isMatch = btn.getAttribute('data-set-accent') === accentKey;
      btn.classList.toggle('active', isMatch);
    });
  }

  accentTriggers.forEach((btn) => {
    btn.addEventListener('click', () => {
      const accentKey = btn.getAttribute('data-set-accent');
      if (accentKey) setAccentPalette(accentKey);
    });
  });

  /* --------------------------------------------------------------------------
   * 3. Hero Mock Window: 3-Column / 2-Column Toggle, Note Cards & Inline AI
   * -------------------------------------------------------------------------- */
  const heroAppWindow = document.getElementById('heroAppWindow');
  const mockLayoutToggle = document.getElementById('mockLayoutToggle');
  const mockLayoutLabel = document.getElementById('mockLayoutLabel');

  if (mockLayoutToggle && heroAppWindow && mockLayoutLabel) {
    mockLayoutToggle.addEventListener('click', () => {
      const currentLayout = heroAppWindow.getAttribute('data-layout');
      const nextLayout = currentLayout === 'three-column' ? 'two-column' : 'three-column';
      heroAppWindow.setAttribute('data-layout', nextLayout);
      mockLayoutLabel.textContent =
        nextLayout === 'three-column' ? '3-Column Layout' : '2-Column Layout';
    });
  }

  const MOCK_NOTES = {
    architecture: {
      date: 'November 15, 2026 at 10:42 AM — 148 words · 1 min read',
      title: 'Q4 Systems Architecture & Security Spec',
      tags: ['📁 Architecture', '#security', '#gemini-3'],
      originalHtml: `
        <p>Gemini Notes v0.4.0-beta combines a native <strong>macOS Electron architecture</strong> with CISO-verified sandboxing, local Personal Knowledge Base RAG, and Gemini 3 REST integration.</p>
        <ul>
          <li><strong>Header-Only API Auth:</strong> All Gemini requests authenticate via <code>x-goog-api-key</code> HTTP headers—never URL query strings.</li>
          <li><strong>Hardened Local Vault:</strong> Notes, settings, and KB indexes use atomic writes with <code>0o600</code> owner-only permissions inside a <code>0o700</code> directory.</li>
          <li><strong>Zero-Click Beacon Defense:</strong> Strict CSP disables remote image beacons and Chromium <code>localStorage</code> credential mirroring.</li>
        </ul>
        <blockquote>Tip: Click any note card in the middle column or trigger a Gemini pill above to test v0.4.0-beta live!</blockquote>
      `,
      summarize: `
        <p><strong>✦ Gemini 3 Executive Summary:</strong></p>
        <ul>
          <li><strong>Header-Only Transport:</strong> API keys sent solely in <code>x-goog-api-key</code> headers with log redaction.</li>
          <li><strong>Owner-Only Local Vault:</strong> Atomic <code>0o600</code> JSON files + <code>0o700</code> folder permissions, zero <code>localStorage</code> shadowing.</li>
          <li><strong>Verified Renderer Isolation:</strong> Sender-checked IPC handlers, beacon-free CSP, and deterministic paste sanitization.</li>
        </ul>
      `,
      actions: `
        <p><strong>✦ Extracted Action Items:</strong></p>
        <ul>
          <li>☑ Verify Universal macOS (<code>arm64</code> + <code>x86_64</code>) <code>.dmg</code> and <code>.zip</code> SHA-256 installers.</li>
          <li>☑ Enable Personal Knowledge Base (<code>⌘⇧K</code>) to cite local specs and PDFs inline.</li>
          <li>☑ Customize Surface Theme &amp; Accent Palette inside <strong>Settings (⌘,)</strong>.</li>
        </ul>
      `,
      polish: `
        <p><strong>Architectural Overview:</strong> Gemini Notes v0.4.0-beta delivers a hardened macOS workspace pairing strict Electron IPC isolation, owner-only <code>0o600</code> JSON persistence, and local PDF/document RAG with fast Gemini 3 Flash &amp; Pro inference.</p>
      `
    },
    blank: {
      date: 'November 15, 2026 at 9:58 AM — 0 words · Generate from Scratch',
      title: 'Untitled Note (Empty Canvas)',
      tags: ['📁 Work', '#new-in-0.4-beta', '#zero-text-ai'],
      originalHtml: `
        <p style="color: var(--text-muted); font-style: italic;">(Blank note — zero words typed yet. Click any Gemini action above to draft from scratch without needing existing note text!)</p>
        <blockquote>New in <strong>v0.4.0-beta</strong>: Ask Gemini anything—even on a completely empty note—to generate structured guides, checklists, pros &amp; cons, or study flashcards.</blockquote>
      `,
      summarize: `
        <p><strong>✦ Generated Guide: Executive Phone Etiquette at Work</strong></p>
        <ul>
          <li><strong>Warm Greeting in 3 Rings:</strong> State your name, role/team, and "How may I help you today?" clearly.</li>
          <li><strong>Active Note-Taking:</strong> Capture the caller's name, urgency, and key request directly into a Gemini Note.</li>
          <li><strong>Clear Closing Summary:</strong> Confirm exact next steps, owner, and callback timeline before hanging up.</li>
        </ul>
      `,
      actions: `
        <p><strong>✦ Generated Starter Checklist (From Blank Note):</strong></p>
        <ul>
          <li>☐ Answer within 3 rings with a calm, steady pace</li>
          <li>☐ Mute notifications / background noise before unmuting</li>
          <li>☐ Recap action items aloud before ending the call</li>
        </ul>
      `,
      polish: `
        <p><strong>Workplace Call Playbook (Drafted from Scratch):</strong> Answer promptly with your name and department, smile subtly to soften vocal tone, ask clarifying questions before transferring, and follow every work call with a brief 2-line recap.</p>
      `
    },
    prompts: {
      date: 'November 15, 2026 at 9:15 AM — 164 words · 1 min read',
      title: 'Personal Knowledge Base & PDF Export',
      tags: ['📁 AI Research', '#knowledge-base', '#pdf'],
      originalHtml: `
        <p>Bring your own PDFs, Markdown docs, CSVs, and Word files into Gemini Notes with zero external vector servers:</p>
        <ul>
          <li><strong>Knowledge Base Vault (<code>⌘⇧K</code>):</strong> On-device PDFKit &amp; <code>textutil</code> extraction chunks and scores relevant sections locally.</li>
          <li><strong>Native PDF Export (<code>⌘⇧E</code>):</strong> Exports clean <code>Letter</code>, <code>A4</code>, or <code>Legal</code> PDFs via an isolated offline renderer.</li>
          <li><strong>Beta Changelog (<code>⌘,</code>):</strong> Automatic one-time "What's New" summary after every update, plus full release history in Settings.</li>
        </ul>
      `,
      summarize: `
        <p><strong>✦ Gemini 3 Summary:</strong> Gemini Notes v0.4.0-beta unites local Knowledge Base citations (<code>⌘⇧K</code>), offline native PDF export (<code>⌘⇧E</code>), zero-text AI drafting, and Settings-only studio themes.</p>
      `,
      actions: `
        <p><strong>✦ Quick Setup Next Steps:</strong></p>
        <ul>
          <li>☑ Open <strong>Knowledge Base (⌘⇧K)</strong> and import project PDFs or manuals.</li>
          <li>☑ Open <strong>Settings (⌘,)</strong> to pick Dark, Midnight, Light, or Sepia + review the Beta Changelog.</li>
        </ul>
      `,
      polish: `
        <p><strong>Local-First Knowledge Workflow:</strong> Gemini Notes keeps reference PDFs and notes strictly on your Mac SSD, surfacing cited excerpts on demand while exporting print-ready PDFs inside an offline sandboxed window.</p>
      `
    }
  };

  let activeMockNoteId = 'architecture';
  const mockNoteCards = document.querySelectorAll('.mock-note-card');
  const mockEditorDate = document.getElementById('mockEditorDate');
  const mockEditorTitle = document.getElementById('mockEditorTitle');
  const mockEditorTags = document.getElementById('mockEditorTags');
  const mockEditorContent = document.getElementById('mockEditorContent');

  function renderMockNote(noteId, variantKey = 'originalHtml') {
    const note = MOCK_NOTES[noteId];
    if (!note || !mockEditorDate || !mockEditorTitle || !mockEditorTags || !mockEditorContent) return;

    mockEditorDate.textContent = note.date;
    mockEditorTitle.textContent = note.title;
    mockEditorTags.innerHTML = note.tags
      .map((t) => `<span class="editor-tag-pill">${t}</span>`)
      .join('');
    mockEditorContent.innerHTML = note[variantKey] || note.originalHtml;
  }

  mockNoteCards.forEach((card) => {
    card.addEventListener('click', () => {
      const noteId = card.getAttribute('data-note-id');
      if (!noteId || !MOCK_NOTES[noteId]) return;
      activeMockNoteId = noteId;
      mockNoteCards.forEach((c) => c.classList.toggle('active', c === card));
      renderMockNote(activeMockNoteId, 'originalHtml');
    });
  });

  const mockAiPills = document.querySelectorAll('[data-mock-action]');
  mockAiPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const action = pill.getAttribute('data-mock-action');
      if (action === 'reset') {
        renderMockNote(activeMockNoteId, 'originalHtml');
      } else if (action) {
        renderMockNote(activeMockNoteId, action);
      }
    });
  });

  /* --------------------------------------------------------------------------
   * 4. Interactive Live AI Demo Workbench (#demo)
   * -------------------------------------------------------------------------- */
  const DEMO_PRESETS = {
    blank: {
      source: '',
      transforms: {
        grammar: `Workplace Phone Etiquette Guide (Generated from Scratch)\n\n1. Warm Opening (Within 3 Rings): "Good morning, [Your Name] speaking from [Team], how can I help you today?"\n2. Active Listening & Notes: Repeat key names, dates, and requests back briefly so nothing is misheard.\n3. Confident Transfer or Wrap-Up: Confirm who handles the next step and when the caller can expect a follow-up.`,
        tasks: `✅ Phone Readiness Checklist (Generated on Blank Note):\n• Answer within 3 rings with a calm, upbeat tone\n• Silence desktop notifications before speaking\n• Log caller name, summary, and follow-up time in Gemini Notes`,
        summarize: `📝 3-Rule Professional Call Summary:\n• Greet fast & clearly with your name and department.\n• Take structured notes while listening so callers never repeat themselves.\n• Close every call by repeating next steps and deadlines aloud.`,
        concise: `Answer within 3 rings, open warmly with your name and role, jot key details directly into Gemini Notes, and close by confirming exact next steps.`,
        translate: `🇪🇸 Español (Guía Telefónica Laboral):\nResponde antes del tercer tono con tu nombre y equipo, toma notas claras mientras escuchas y confirma los próximos pasos antes de colgar.\n\n🇯🇵 日本語 (ビジネス電話対応ガイド):\n3コール以内に出て名乗り、要点をメモしながら傾聴し、最後に次のアクションを復唱して確認しましょう。`,
        autotag: `🏷️ Suggested Title:\nProfessional Work Phone Etiquette Guide\n\nSuggested Tags:\n#work-guide  #communication  #phone-etiquette`
      }
    },
    meeting: {
      source: `Product Sync - Nov 15
We talked about launching Gemini Notes v0.4.0-beta on macOS. Vincent confirmed zero-text AI drafting, Settings-only Dark/Midnight/Light/Sepia themes, and the once-per-update What's New popup are passing security and UI checks. Personal Knowledge Base RAG (Cmd+Shift+K) and native offline PDF export (Cmd+Shift+E) are ready for beta testers on macOS Universal .dmg and .zip.`,
      transforms: {
        grammar: `Product Sync — November 15\n\nWe finalized the launch of Gemini Notes v0.4.0-beta for macOS. Vincent confirmed that zero-text AI drafting, Settings-only Dark/Midnight/Light/Sepia themes, and the one-time What's New release modal have passed all security and UI verification checks. Personal Knowledge Base RAG (⌘⇧K) and isolated offline PDF export (⌘⇧E) are packaged cleanly in Universal macOS .dmg and .zip installers.`,
        tasks: `✅ Extracted Action Items:\n• [Done] Enable zero-text AI drafting from scratch across Ask Gemini & slash commands\n• [Done] Move surface themes & 9 Accent Colors exclusively into Settings (⌘,)\n• [Ready] Publish macOS Universal .dmg & .zip beta installers on the website`,
        summarize: `📝 Executive TL;DR:\n• Launch Version: Gemini Notes v0.4.0-beta (Universal macOS arm64 + x64).\n• Headline Upgrades: Blank-note AI generation, Settings-only theme studio, once-per-update changelog popup, and Knowledge Base RAG.`,
        concise: `Gemini Notes v0.4.0-beta is ready for macOS: zero-text AI generation, Settings-only Dark/Midnight/Light/Sepia themes, KB citations, and offline PDF export packaged in Universal .dmg & .zip builds.`,
        translate: `🇪🇸 Español:\nSincronización de Producto (15 de nov): Gemini Notes v0.4.0-beta está listo para macOS con generación IA desde notas en blanco, temas en Ajustes y descargas universales .dmg y .zip.\n\n🇯🇵 日本語:\n製品同期ミーティング (11月15日): Gemini Notes v0.4.0-beta が完了。白紙ノートからのAI生成、設定専用テーマ、Universal macOS .dmg / .zip インストーラーを公開可能。`,
        autotag: `🏷️ Suggested Title:\nGemini Notes v0.4.0-beta Release & Installer Sync\n\nSuggested Tags:\n#v0-4-beta  #macos-universal  #security-verified  #knowledge-base`
      }
    },
    draft: {
      source: `why local first notes matter: cloud apps are slow when wifi drops on flights and they lock your data in proprietary databases. with gemini notes we keep everything in local json files on your mac ssd with 0o600 permissions, plus you only call gemini 3 api via x-goog-api-key header when you actually want ai help.`,
      transforms: {
        grammar: `Why Local-First Notes Matter\n\nCloud-only note applications lag when Wi-Fi drops in transit and lock your knowledge inside proprietary remote databases. Gemini Notes stores every note, tag, and Knowledge Base index locally on your Mac's SSD with strict 0o600 owner-only permissions—delivering instant offline search while calling the Gemini 3 REST API via x-goog-api-key headers strictly on explicit request.`,
        tasks: `✅ Key Architectural Takeaways:\n• Maintain 100% offline availability via atomic 0o600 local JSON storage\n• Eliminate Chromium localStorage credential mirroring in desktop mode\n• Authenticate Gemini 3 requests strictly with x-goog-api-key headers`,
        summarize: `📝 Core Thesis:\n• Zero Latency: Local SSD storage guarantees instant search offline.\n• Zero-Trust Hygiene: Owner-only 0o600 files inside a 0o700 folder with no telemetry beacons.`,
        concise: `Cloud note apps lag and lock in data. Gemini Notes keeps everything local in 0o600 JSON files on your Mac SSD, calling Gemini 3 via x-goog-api-key only when you summon it.`,
        translate: `🇪🇸 Español:\nPor qué importan las notas locales: Gemini Notes guarda todo en archivos JSON 0o600 en tu Mac y solo llama a Gemini 3 mediante cabecera x-goog-api-key cuando tú lo pides.\n\n🇯🇵 日本語:\nローカルファーストの重要性：Gemini NotesはMacのSSD上に0o600権限で保存し、必要な時だけ x-goog-api-key ヘッダー経由でGemini 3を呼び出します。`,
        autotag: `🏷️ Suggested Title:\nLocal-First Privacy & Zero-Trust AI Architecture\n\nSuggested Tags:\n#local-first  #privacy  #zero-trust  #gemini-3`
      }
    },
    research: {
      source: `Knowledge Base & multi-agent engineering: import local PDFs, Markdown, CSV, or Word docs into Gemini Notes so Ask Gemini and Chat with All Notes cite your real files locally. Built and audited by our specialized systems, UI, QA, and CISO engineering agents.`,
      transforms: {
        grammar: `Personal Knowledge Base & Multi-Agent Quality\n\nImport local PDFs, Markdown files, CSVs, and Word documents directly into Gemini Notes so both Ask Gemini and Chat with All Notes ground answers in your own reference library with automatic citations. Engineered, audited, and verified end-to-end across specialized backend, UI, QA, and CISO security roles.`,
        tasks: `✅ Knowledge Base & Verification Matrix:\n• Import PDFs / docs locally via PDFKit & macOS textutil (⌘⇧K)\n• Verify all 8 automated security suites & 8 XSS sanitization vectors\n• Distribute signed Universal macOS .dmg and .zip installers`,
        summarize: `📝 Executive Summary:\n• Local RAG indexing keeps private docs on-device while enriching Gemini 3 responses with source citations and CISO-verified sandboxing.`,
        concise: `Import local PDFs and docs into Gemini Notes (⌘⇧K) for grounded citations—backed by CISO-verified sandboxing and 8 security/XSS regression suites.`,
        translate: `🇪🇸 Español:\nBase de Conocimiento Personal: Importa PDFs y documentos locales (⌘⇧K) para obtener respuestas de Gemini 3 con citas automáticas y seguridad auditada.\n\n🇯🇵 日本語:\nパーソナルナレッジベース：ローカルPDFや文書（⌘⇧K）を取り込み、引用付きでGemini 3が回答。CISO監査済みのサンドボックス設計。`,
        autotag: `🏷️ Suggested Title:\nLocal RAG Knowledge Base & Security Governance\n\nSuggested Tags:\n#knowledge-base  #rag  #ciso-verified  #electron`
      }
    }
  };

  let currentPresetKey = 'blank';
  let lastGeneratedResult = '';

  const demoInputTextarea = document.getElementById('demoInputTextarea');
  const demoPresetButtons = document.querySelectorAll('[data-preset]');
  const demoAiButtons = document.querySelectorAll('[data-ai-transform]');
  const demoOutputTitle = document.getElementById('demoOutputTitle');
  const demoLatencyBadge = document.getElementById('demoLatencyBadge');
  const demoOutputBody = document.getElementById('demoOutputBody');
  const demoOutputActions = document.getElementById('demoOutputActions');
  const demoResetBtn = document.getElementById('demoResetBtn');
  const demoApplyReplaceBtn = document.getElementById('demoApplyReplaceBtn');
  const demoApplyAppendBtn = document.getElementById('demoApplyAppendBtn');

  function loadPreset(presetKey) {
    const preset = DEMO_PRESETS[presetKey];
    if (!preset || !demoInputTextarea) return;
    currentPresetKey = presetKey;
    demoInputTextarea.value = preset.source;
    demoPresetButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === presetKey);
    });
    if (demoOutputTitle) demoOutputTitle.textContent = 'Gemini AI Output Preview';
    if (demoLatencyBadge) demoLatencyBadge.textContent = 'Ready • Click any tool on the left';
    if (demoOutputBody) {
      demoOutputBody.innerHTML =
        presetKey === 'blank'
          ? 'This note buffer is intentionally empty! Click any of the <strong>6 Gemini AI tools</strong> on the left to generate content from scratch.'
          : 'Select any of the <strong>6 Gemini AI tools</strong> on the left to transform this note live.';
    }
    if (demoOutputActions) demoOutputActions.hidden = true;
  }

  // Initialize default preset
  loadPreset('meeting');

  demoPresetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-preset');
      if (key) loadPreset(key);
    });
  });

  if (demoResetBtn) {
    demoResetBtn.addEventListener('click', () => loadPreset(currentPresetKey));
  }

  function buildDynamicFallbackTransform(userText, transformType) {
    const cleaned = userText.trim();
    if (!cleaned) {
      return DEMO_PRESETS.blank.transforms[transformType] || DEMO_PRESETS.blank.transforms.grammar;
    }
    const words = cleaned.split(/\s+/);
    switch (transformType) {
      case 'grammar':
        return (
          cleaned.charAt(0).toUpperCase() +
          cleaned.slice(1).replace(/\s+/g, ' ') +
          (cleaned.endsWith('.') ? '' : '.')
        );
      case 'tasks':
        return `✅ Extracted Action Items (${words.length} words analyzed):\n• Review and finalize: "${cleaned.slice(0, 70)}..."\n• Assign owner and target milestone in Gemini Notes`;
      case 'summarize':
        return `📝 Executive Summary:\n• Core Note (${words.length} words): ${cleaned.slice(0, 110)}${cleaned.length > 110 ? '...' : ''}`;
      case 'concise':
        return cleaned.slice(0, Math.max(60, Math.floor(cleaned.length * 0.65))) + '...';
      case 'translate':
        return `🇪🇸 Español (Preview):\n${cleaned}\n\n🇯🇵 日本語 (Preview):\n[Gemini 3 Bilingual Translation Ready]`;
      case 'autotag':
        return `🏷️ Suggested Title:\n${words.slice(0, 6).join(' ')}\n\nSuggested Tags:\n#gemini-notes  #captured-note  #workflow`;
      default:
        return cleaned;
    }
  }

  const TRANSFORM_LABELS = {
    grammar: '✨ Fix Grammar & Executive Polish',
    tasks: '✅ Extracted Action Items',
    summarize: '📝 Executive TL;DR Summary',
    concise: '⚡ Concise Rewrite',
    translate: '🌍 Bilingual Localization (ES / JP)',
    autotag: '🏷️ Auto-Title & Smart Taxonomy'
  };

  let streamingInterval = null;

  demoAiButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const transformType = btn.getAttribute('data-ai-transform');
      if (!transformType || !demoInputTextarea || !demoOutputBody) return;

      const preset = DEMO_PRESETS[currentPresetKey];
      const currentInput = demoInputTextarea.value.trim();
      const isUnmodifiedPreset = preset && currentInput === preset.source.trim();

      const targetResult = isUnmodifiedPreset
        ? preset.transforms[transformType]
        : buildDynamicFallbackTransform(currentInput, transformType);

      lastGeneratedResult = targetResult;

      if (streamingInterval) clearInterval(streamingInterval);

      const simulatedMs = Math.floor(115 + Math.random() * 65);
      if (demoOutputTitle) {
        demoOutputTitle.textContent = TRANSFORM_LABELS[transformType] || 'Gemini Output';
      }
      if (demoLatencyBadge) {
        demoLatencyBadge.textContent = `Streaming... • gemini-3-flash-preview`;
      }
      if (demoOutputActions) demoOutputActions.hidden = true;

      demoOutputBody.textContent = '';
      let charIndex = 0;
      const step = Math.max(3, Math.ceil(targetResult.length / 45));

      streamingInterval = setInterval(() => {
        charIndex += step;
        if (charIndex >= targetResult.length) {
          demoOutputBody.textContent = targetResult;
          clearInterval(streamingInterval);
          streamingInterval = null;
          if (demoLatencyBadge) {
            demoLatencyBadge.textContent = `${simulatedMs}ms • gemini-3-flash-preview`;
          }
          if (demoOutputActions) demoOutputActions.hidden = false;
        } else {
          demoOutputBody.textContent = targetResult.slice(0, charIndex) + '▍';
        }
      }, 16);
    });
  });

  if (demoApplyReplaceBtn && demoInputTextarea) {
    demoApplyReplaceBtn.addEventListener('click', () => {
      if (!lastGeneratedResult) return;
      demoInputTextarea.value = lastGeneratedResult;
      if (demoLatencyBadge) demoLatencyBadge.textContent = '✓ Applied to Note Buffer';
    });
  }

  if (demoApplyAppendBtn && demoInputTextarea) {
    demoApplyAppendBtn.addEventListener('click', () => {
      if (!lastGeneratedResult) return;
      const existing = demoInputTextarea.value.trim();
      demoInputTextarea.value = existing ? `${existing}\n\n---\n${lastGeneratedResult}` : lastGeneratedResult;
      if (demoLatencyBadge) demoLatencyBadge.textContent = '✓ Inserted into Note';
    });
  }

  /* --------------------------------------------------------------------------
   * 5. Accessible FAQ Accordion (#faqAccordion)
   * -------------------------------------------------------------------------- */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const questionBtn = item.querySelector('.faq-question');
    const answerBox = item.querySelector('.faq-answer');
    if (!questionBtn || !answerBox) return;

    questionBtn.addEventListener('click', () => {
      const isExpanded = questionBtn.getAttribute('aria-expanded') === 'true';
      faqItems.forEach((otherItem) => {
        const otherBtn = otherItem.querySelector('.faq-question');
        const otherAns = otherItem.querySelector('.faq-answer');
        if (otherBtn && otherAns) {
          otherBtn.setAttribute('aria-expanded', 'false');
          otherAns.style.maxHeight = '0px';
        }
      });

      if (!isExpanded) {
        questionBtn.setAttribute('aria-expanded', 'true');
        answerBox.style.maxHeight = answerBox.scrollHeight + 24 + 'px';
      }
    });
  });

  /* --------------------------------------------------------------------------
   * 6. Launch Trailer Modal Player (#trailerModal)
   * -------------------------------------------------------------------------- */
  const openTrailerBtn = document.getElementById('openTrailerBtn');
  const closeTrailerBtn = document.getElementById('closeTrailerBtn');
  const trailerModal = document.getElementById('trailerModal');
  const trailerVideo = document.getElementById('trailerVideoPlayer');

  const closeTrailer = () => {
    if (!trailerModal) return;
    trailerModal.hidden = true;
    if (trailerVideo) {
      trailerVideo.pause();
      trailerVideo.currentTime = 0;
    }
  };

  if (openTrailerBtn && trailerModal) {
    openTrailerBtn.addEventListener('click', () => {
      trailerModal.hidden = false;
      if (trailerVideo) {
        trailerVideo.play().catch(() => {});
      }
    });
  }

  if (closeTrailerBtn) {
    closeTrailerBtn.addEventListener('click', closeTrailer);
  }

  if (trailerModal) {
    trailerModal.addEventListener('click', (event) => {
      if (event.target === trailerModal) {
        closeTrailer();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && trailerModal && !trailerModal.hidden) {
      closeTrailer();
    }
  });

  /* --------------------------------------------------------------------------
   * 7. Checksum Copy & Download Status Helpers
   * -------------------------------------------------------------------------- */
  const copyShaButtons = document.querySelectorAll('[data-copy-text]');
  copyShaButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-copy-text');
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        const orig = btn.textContent;
        btn.textContent = 'Copied SHA-256';
        setTimeout(() => {
          btn.textContent = orig || 'Copy SHA-256';
        }, 1800);
      } catch {
        // ignore clipboard permission errors on file://
      }
    });
  });

  const downloadLinks = document.querySelectorAll('[data-download-kind]');
  const downloadNotice = document.getElementById('downloadStatusNotice');
  downloadLinks.forEach((link) => {
    link.addEventListener('click', () => {
      if (!downloadNotice) return;
      const kind = link.getAttribute('data-download-kind') || 'macOS installer';
      downloadNotice.textContent = `Starting download: ${kind} (Gemini Notes v0.4.0-beta Universal)... See install steps below if macOS Gatekeeper asks on first launch.`;
      downloadNotice.hidden = false;
    });
  });
})();
