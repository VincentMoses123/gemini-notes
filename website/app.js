/**
 * Gemini Notes — Official Landing Website Interactive Controller
 * Powers:
 * 1. Dark / Light Appearance Toggle
 * 2. 5 Studio Accent Theme Switcher (Sapphire, Emerald, Copper, Indigo, Slate)
 * 3. Hero macOS 3-Column / 2-Column Mock Window & Note Switcher
 * 4. Interactive Live Gemini AI Demo Workbench with Streaming Preview
 * 5. Accessible FAQ Accordion
 */

(function () {
  'use strict';

  const rootHtml = document.documentElement;

  /* --------------------------------------------------------------------------
   * 1. Dark / Light Mode Toggle
   * -------------------------------------------------------------------------- */
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = rootHtml.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      rootHtml.setAttribute('data-theme', nextTheme);
    });
  }

  /* --------------------------------------------------------------------------
   * 2. Studio Color Palette Switcher (Sapphire, Emerald, Copper, Indigo, Slate)
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
      date: 'November 1, 2026 at 10:42 AM — 148 words · 1 min read',
      title: 'Q4 Systems Architecture & Security Spec',
      tags: ['📁 Architecture', '#security', '#gemini-2.5'],
      originalHtml: `
        <p>Gemini Notes combines a native <strong>macOS Electron architecture</strong> with strict process sandboxing and direct Google Gemini 2.5 SDK execution.</p>
        <ul>
          <li><strong>Context Isolation:</strong> Renderer runs with <code>contextIsolation: true</code> and <code>nodeIntegration: false</code>.</li>
          <li><strong>Hardened Local Vault:</strong> Notes and snapshots are persisted atomically with <code>0o600</code> owner-only permissions.</li>
          <li><strong>DOM XSS Sanitization:</strong> Every AI response and HTML clipboard payload passes through our custom allowlist sanitizer before insertion.</li>
        </ul>
        <blockquote>Tip: Click any note card in the middle column or trigger a Gemini pill above to test the live workspace!</blockquote>
      `,
      summarize: `
        <p><strong>✦ Gemini Executive Summary (3 Key Pillars):</strong></p>
        <ul>
          <li><strong>Sandboxed Desktop Runtime:</strong> Context-isolated Electron process with zero Node exposure in the renderer.</li>
          <li><strong>Owner-Only Local Storage:</strong> Atomic JSON persistence locked down with POSIX <code>0o600</code> permissions.</li>
          <li><strong>Sanitized AI Rendering:</strong> Deterministic HTML allowlist prevents DOM XSS across all Gemini outputs.</li>
        </ul>
      `,
      actions: `
        <p><strong>✦ Extracted Action Items:</strong></p>
        <ul>
          <li>☑ Verify <code>contextIsolation: true</code> and preload IPC contract before v2.4 DMG notarization.</li>
          <li>☑ Audit <code>0o600</code> file mode enforcement on <code>notes.json</code> and <code>settings.json</code>.</li>
          <li>☑ Run automated XSS regression suite against <code>sanitizeHtml()</code>.</li>
        </ul>
      `,
      polish: `
        <p><strong>Architectural Overview:</strong> Gemini Notes delivers an enterprise-hardened macOS knowledge workspace by uniting a strictly sandboxed Electron runtime with low-latency Google Gemini 2.5 inference, atomic <code>0o600</code> local persistence, and deterministic DOM sanitization.</p>
      `
    },
    design: {
      date: 'October 31, 2026 at 4:18 PM — 132 words · 1 min read',
      title: 'Apple Notes Studio Palette Tokens',
      tags: ['📁 Design System', '#macos', '#themes'],
      originalHtml: `
        <p>To eliminate the eye strain of legacy canary-yellow note apps, Gemini Notes introduces <strong>five calibrated studio palettes</strong> across both Dark and Light appearances:</p>
        <ul>
          <li><strong>Ocean Sapphire:</strong> Default macOS system blue (<code>#3b82f6</code>) for crisp daily clarity.</li>
          <li><strong>Emerald Studio:</strong> Botanical forest accent (<code>#10b981</code>) tuned for deep research.</li>
          <li><strong>Amber Classic &amp; Nordic Indigo:</strong> Warm editorial copper (<code>#d97706</code>) and atmospheric indigo (<code>#6366f1</code>).</li>
        </ul>
        <blockquote>Click the palette pills above this window to see the entire interface transform in real time.</blockquote>
      `,
      summarize: `
        <p><strong>✦ Gemini Summary:</strong> Gemini Notes replaces harsh yellow accents with 5 calibrated dark/light studio themes: Ocean Sapphire, Emerald Studio, Amber Classic, Nordic Indigo, and Monochrome Graphite.</p>
      `,
      actions: `
        <p><strong>✦ Design System Checklist:</strong></p>
        <ul>
          <li>☑ Validate WCAG AA contrast ratios across all 5 palettes in both Dark and Light modes.</li>
          <li>☑ Sync active selection highlights and AI sparkle badges to <code>var(--accent)</code>.</li>
        </ul>
      `,
      polish: `
        <p><strong>Design System Specification:</strong> Engineered for extended cognitive flow, Gemini Notes pairs macOS vibrancy and SF Pro typography with five low-fatigue studio color palettes that adapt seamlessly between dark and daylight environments.</p>
      `
    },
    prompts: {
      date: 'November 1, 2026 at 9:15 AM — 164 words · 1 min read',
      title: 'Gemini 2.5 Inline Prompt Workflows',
      tags: ['📁 AI Research', '#gemini-2.5', '#productivity'],
      originalHtml: `
        <p>Writers shouldn't have to copy-paste between browser tabs and their notes. Gemini Notes embeds <strong>14+ precision AI tools</strong> directly inside the editor canvas:</p>
        <ul>
          <li><strong>Slash Commands (<code>/</code>):</strong> Type <code>/summarize</code>, <code>/tasks</code>, or <code>/fix</code> without lifting your hands from the keyboard.</li>
          <li><strong>Floating Bubble Menu:</strong> Highlight any sentence to rewrite, shorten, or translate in place.</li>
          <li><strong>Chat with All Notes:</strong> Query your entire local note vault with cited note references.</li>
        </ul>
      `,
      summarize: `
        <p><strong>✦ Gemini Summary:</strong> Gemini Notes eliminates context-switching via inline Slash Commands (<code>/</code>), a selection-aware Floating Bubble Menu, Auto-Title &amp; Tagging, and vault-wide Chat with All Notes.</p>
      `,
      actions: `
        <p><strong>✦ Workflow Next Steps:</strong></p>
        <ul>
          <li>☑ Press <code>⌘J</code> to open the inline Gemini bar on any note.</li>
          <li>☑ Use <strong>Auto-Title &amp; Tag</strong> to organize untitled scratchpad captures automatically.</li>
        </ul>
      `,
      polish: `
        <p><strong>Inline Intelligence Workflow:</strong> By unifying keyboard-first Slash Commands, contextual selection toolbars, and vault-wide semantic Q&amp;A, Gemini Notes turns raw thoughts into structured documentation in milliseconds.</p>
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
    meeting: {
      source: `Product Sync - Nov 1
We talked about launching Gemini Notes v2.4 on Friday. Vincent mentioned the 3-column Apple Notes layout and 5 studio color themes are finished and passing TypeScript checks. Security team finished locking down 0o600 file permissions and HTML sanitization. Still need to finalize the DMG installer icon and write release notes by Wednesday 5pm.`,
      transforms: {
        grammar: `Product Sync — November 1\n\nWe aligned on launching Gemini Notes v2.4 this Friday. Vincent confirmed that the 3-column Apple Notes layout and all five studio color palettes are complete and passing TypeScript verification. The security team has also finalized 0o600 file permission hardening and HTML sanitization. Remaining items: finalize the macOS DMG installer icon and publish the release notes by Wednesday at 5:00 PM.`,
        tasks: `✅ Extracted Action Items:\n• [Done] Complete 3-column Apple Notes UI & 5 studio color palettes (Owner: UI Team)\n• [Done] Enforce 0o600 local vault permissions & DOM HTML sanitizer (Owner: Security Team)\n• [Pending — Due Wed 5:00 PM] Finalize macOS DMG installer icon\n• [Pending — Due Wed 5:00 PM] Draft and review v2.4 Release Notes`,
        summarize: `📝 Executive TL;DR:\n• Launch Target: Gemini Notes v2.4 is on track for Friday release.\n• Completed Milestones: 3-column macOS UI, 5 non-yellow studio themes, 0o600 storage hardening, and XSS sanitization are verified.\n• Critical Path: DMG icon packaging and release documentation due Wednesday at 5:00 PM.`,
        concise: `Gemini Notes v2.4 launches Friday. UI (3-column layout, 5 studio themes) and Security (0o600 permissions, HTML sanitizer) are complete. Next: finalize DMG icon and release notes by Wednesday 5 PM.`,
        translate: `🇪🇸 Español:\nSincronización de Producto (1 de nov): Lanzaremos Gemini Notes v2.4 el viernes. El diseño de 3 columnas, los 5 temas de color y el endurecimiento de seguridad (0o600 y sanitización HTML) están listos. Pendiente: icono DMG y notas de versión antes del miércoles a las 17:00.\n\n🇯🇵 日本語:\n製品同期ミーティング (11月1日): 金曜日に Gemini Notes v2.4 をリリース予定。3カラムUI、5つのスタジオカラーテーマ、セキュリティ強化 (0o600権限・HTMLサニタイズ) は完了。水曜17時までにDMGアイコンとリリースノートを完成させる。`,
        autotag: `🏷️ Suggested Title:\nGemini Notes v2.4 Launch Readiness & Engineering Sync\n\nSuggested Tags:\n#product-launch  #v2.4-release  #macos-universal  #security-audit`
      }
    },
    draft: {
      source: `why local first notes matter: cloud apps are slow when wifi drops on flights and they lock your data in proprietary databases. with gemini notes we keep everything in local json files on your mac ssd so search is 0ms instant, plus you only call gemini 2.5 api when you actually want ai help.`,
      transforms: {
        grammar: `Why Local-First Notes Matter\n\nCloud-only note applications lag when Wi-Fi drops in transit and lock your knowledge inside proprietary remote databases. Gemini Notes stores every document locally on your Mac's SSD in human-readable JSON—delivering sub-millisecond search while invoking the Google Gemini 2.5 API strictly when you request AI assistance.`,
        tasks: `✅ Key Architectural Takeaways:\n• Maintain 100% offline read/write availability via local SSD persistence\n• Guarantee 0ms instant search across local note buffers\n• Invoke Gemini 2.5 network requests strictly on explicit user command`,
        summarize: `📝 Core Thesis:\n• Zero Latency: Local SSD storage eliminates offline downtime and network lag.\n• Data Ownership: Plain local JSON files prevent vendor lock-in.\n• Intentional AI: Gemini 2.5 is called only on demand, preserving privacy and speed.`,
        concise: `Cloud note apps suffer from latency and lock-in. Gemini Notes stores data locally on your Mac SSD for instant offline access, calling Gemini 2.5 only when you summon it.`,
        translate: `🇪🇸 Español:\nPor qué importan las notas locales: Las apps en la nube fallan sin Wi-Fi y encierran tus datos. Gemini Notes guarda todo en tu SSD local para búsquedas instantáneas, invocando a Gemini 2.5 solo cuando lo pides.\n\n🇯🇵 日本語:\nローカルファーストの重要性：クラウド型アプリはオフライン時に遅延しデータを囲い込みます。Gemini NotesはMacのSSD上にJSONで保存するため検索が瞬時に行え、必要な時だけGemini 2.5 APIを呼び出します。`,
        autotag: `🏷️ Suggested Title:\nThe Case for Local-First Knowledge & On-Demand AI\n\nSuggested Tags:\n#local-first  #privacy  #architecture  #gemini-2.5`
      }
    },
    research: {
      source: `Tri-agent development pattern: instead of one monolithic prompt, split complex desktop engineering into 3 roles: 1) Head Systems Engineer for orchestration & build verification, 2) Principal UI Engineer for Apple Notes UX & CSS token architecture, 3) Security Engineer for CSP, Electron preload isolation, and sanitizer unit tests.`,
      transforms: {
        grammar: `The Tri-Agent Systems Engineering Pattern\n\nRather than relying on a single monolithic prompt, complex desktop software benefits from three coordinated engineering specialists:\n1. Head Systems Engineer — Orchestration, architecture governance, and build verification.\n2. Principal UI & Design Systems Engineer — Apple Notes 3-column UX, studio color palettes, and CSS token architecture.\n3. Security & Hardening Engineer — Strict CSP enforcement, Electron preload isolation, and DOM sanitizer verification.`,
        tasks: `✅ Tri-Agent Verification Matrix:\n• [Head Systems Engineer] Run full TypeScript & Electron Universal packaging checks\n• [Principal UI Engineer] Audit 3-column/2-column layout responsiveness & 5 studio palettes\n• [Security Engineer] Verify CSP headers, 0o600 permissions, and XSS sanitizer coverage`,
        summarize: `📝 Executive Summary:\n• Dividing engineering across Orchestration, UI Design Systems, and Security Hardening specialists yields cleaner architecture, 25% leaner code, and zero-trust verification.`,
        concise: `Split desktop engineering across three focused agents—Systems Orchestration, UI Design Systems, and Security Hardening—for faster iteration and rigorous verification.`,
        translate: `🇪🇸 Español:\nPatrón de ingeniería Tri-Agente: Divide el desarrollo en 1) Ingeniero Jefe de Sistemas, 2) Ingeniero Principal de UI y 3) Ingeniero de Seguridad para lograr máxima calidad en macOS.\n\n🇯🇵 日本語:\nトライエージェント開発パターン：統括システムエンジニア、UIデザインシステムエンジニア、セキュリティエンジニアの3役割に分割することで、高品質なmacOSネイティブアプリを構築。`,
        autotag: `🏷️ Suggested Title:\nCoordinated Tri-Agent Software Architecture\n\nSuggested Tags:\n#multi-agent  #systems-engineering  #electron  #security`
      }
    }
  };

  let currentPresetKey = 'meeting';
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
        'Select any of the <strong>6 Gemini AI tools</strong> on the left to transform this note live.';
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
    const cleaned = userText.trim() || 'Empty note buffer.';
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
        return `🇪🇸 Español (Preview):\n${cleaned}\n\n🇯🇵 日本語 (Preview):\n[Gemini 2.5 Bilingual Translation Ready]`;
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
        demoLatencyBadge.textContent = `Streaming... • gemini-2.5-flash`;
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
            demoLatencyBadge.textContent = `${simulatedMs}ms • gemini-2.5-flash`;
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
      demoInputTextarea.value = `${demoInputTextarea.value.trim()}\n\n---\n${lastGeneratedResult}`;
      if (demoLatencyBadge) demoLatencyBadge.textContent = '✓ Inserted Below Note';
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
      // Close others for clean accordion UX
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
})();
