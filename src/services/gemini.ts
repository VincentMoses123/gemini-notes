import { AIActionType, AppSettings, ChatMessage, ErrorCode, Note } from '../types';
import { stripHtmlToText } from './storage';
import { classifyErrorCode, logEvent } from './logger';

const SYSTEM_INSTRUCTION = `You are an expert inline AI writing assistant embedded inside a modern note-taking app.
Follow these formatting rules strictly:
1. Return ONLY the requested output text — never include conversational filler like "Here is the revised version:" or "Sure, I can help with that."
2. You may use clean Markdown formatting (such as **bold**, *italics*, bullet lists with "- ", numbered lists, or ## headings) when appropriate, as the editor will render it cleanly.
3. Preserve the original accuracy and core meaning unless instructed to expand or brainstorm.`;

export function buildPromptForAction(
  action: AIActionType,
  targetText: string,
  noteContextTitle: string,
  customInstruction?: string
): string {
  const contextHeader = noteContextTitle
    ? `Note Title: "${noteContextTitle}"\n\n`
    : '';

  switch (action) {
    case 'summarize':
      return `${contextHeader}Summarize the following text clearly and concisely, capturing the key points:\n\n"""\n${targetText}\n"""`;
    case 'rewrite':
      return `${contextHeader}Rewrite the following text to improve its clarity, flow, and readability while keeping the same meaning:\n\n"""\n${targetText}\n"""`;
    case 'fix_grammar':
      return `${contextHeader}Fix all spelling, grammar, and punctuation errors in the following text without changing its tone or voice:\n\n"""\n${targetText}\n"""`;
    case 'expand':
      return `${contextHeader}Expand on the following text with more detail, depth, and helpful elaboration:\n\n"""\n${targetText}\n"""`;
    case 'shorten':
      return `${contextHeader}Make the following text significantly shorter and more punchy while preserving the core message:\n\n"""\n${targetText}\n"""`;
    case 'bullet_points':
      return `${contextHeader}Convert the following text into a well-structured bulleted list of key takeaways:\n\n"""\n${targetText}\n"""`;
    case 'action_items':
      return `${contextHeader}Extract a clear list of actionable tasks / next steps (with owners or deadlines if mentioned) from the following text:\n\n"""\n${targetText}\n"""`;
    case 'tone_professional':
      return `${contextHeader}Rewrite the following text in a polished, executive, professional tone:\n\n"""\n${targetText}\n"""`;
    case 'tone_casual':
      return `${contextHeader}Rewrite the following text in a warm, natural, conversational tone:\n\n"""\n${targetText}\n"""`;
    case 'continue_writing':
      return `${contextHeader}Continue writing the next paragraph(s) naturally based on the context below, matching its style and topic:\n\n"""\n${targetText}\n"""`;
    case 'pros_cons':
      return `${contextHeader}Generate a structured **Pros & Cons** analysis and key trade-offs based on the following topic or text:\n\n"""\n${targetText}\n"""`;
    case 'explain_simply':
      return `${contextHeader}Explain the following concept or text in simple, plain, easy-to-understand language (ELI5) with a quick analogy if helpful:\n\n"""\n${targetText}\n"""`;
    case 'study_flashcards':
      return `${contextHeader}Create a set of **Key Terms & Q&A Study Flashcards** (Question / Answer format) from the following notes:\n\n"""\n${targetText}\n"""`;
    case 'translate':
      return `${contextHeader}Translate the following text into ${
        customInstruction || 'Spanish'
      } while preserving formatting and tone:\n\n"""\n${targetText}\n"""`;
    case 'custom':
      return `${contextHeader}Instruction: ${
        customInstruction || 'Improve the text'
      }\n\nTarget text:\n"""\n${targetText}\n"""`;
  }
}

export async function callGeminiRaw(params: {
  prompt: string;
  actionLabel?: string;
  systemInstruction?: string;
  settings: AppSettings;
}): Promise<{
  ok: boolean;
  text?: string;
  usedModel?: string;
  errorCode?: ErrorCode;
  error?: string;
}> {
  const {
    prompt,
    actionLabel = 'AI Request',
    systemInstruction = SYSTEM_INSTRUCTION,
    settings,
  } = params;
  const startTime = Date.now();

  if (window.electronAPI) {
    const res = await window.electronAPI.generateWithGemini({
      apiKey: settings.apiKey,
      model: settings.model,
      systemInstruction,
      prompt,
    });

    if (res.fallbackTriggered && res.initialModel && res.usedModel) {
      await logEvent({
        level: 'warn',
        code: 'GN-MODEL-001',
        source: 'gemini-api',
        message: `Model "${res.initialModel}" unavailable; auto-switched to "${res.usedModel}".`,
        details: `Action: ${actionLabel} | Automatic model discovery succeeded.`,
        model: res.usedModel,
        durationMs: res.durationMs,
      });
    }

    if (res.ok && res.text) {
      await logEvent({
        level: 'info',
        source: 'gemini-api',
        message: `${actionLabel} completed (${res.text.length} chars)`,
        details: `Prompt length: ${prompt.length} chars | Model: ${
          res.usedModel || settings.model
        }`,
        model: res.usedModel || settings.model,
        durationMs: res.durationMs || Date.now() - startTime,
      });
      return {
        ok: true,
        text: res.text,
        usedModel: res.usedModel,
      };
    } else {
      const code =
        res.errorCode || classifyErrorCode(res.error || '', res.httpStatus);
      const rawErr = (res.error || 'Unknown Gemini API error').replace(
        /^\[GN-[A-Z]+-\d+\]\s*/,
        ''
      );
      const formattedError = `[${code}] ${rawErr}`;

      await logEvent({
        level: 'error',
        code,
        source: 'gemini-api',
        message: `${actionLabel} failed: ${rawErr}`,
        details: `HTTP Status: ${res.httpStatus || 'N/A'} | Requested Model: ${
          res.initialModel || settings.model
        }`,
        model: res.usedModel || settings.model,
        durationMs: res.durationMs || Date.now() - startTime,
      });

      return {
        ok: false,
        errorCode: code,
        error: formattedError,
      };
    }
  }

  // Browser fallback
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    const code: ErrorCode = 'GN-AUTH-001';
    const msg =
      '[GN-AUTH-001] Missing Gemini API key. Click "Gemini Settings" in the sidebar to enter your Gemini API key.';
    await logEvent({
      level: 'error',
      code,
      source: 'gemini-api',
      message: `${actionLabel} aborted: Missing Gemini API Key`,
      durationMs: Date.now() - startTime,
    });
    return { ok: false, errorCode: code, error: msg };
  }

  const callRestModel = async (targetModel: string) => {
    const cleanModel = targetModel.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      cleanModel
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
        },
      }),
    });
    const data = await res.json();
    return { res, data, usedModel: cleanModel };
  };

  try {
    let { res, data, usedModel } = await callRestModel(
      settings.model || 'gemini-3-flash-preview'
    );

    if (!res.ok) {
      const errMessage = data?.error?.message || '';
      const allMatches = Array.from(
        errMessage.matchAll(/models\/([a-zA-Z0-9._-]+)/g),
        (m: RegExpMatchArray) => m[1]
      );
      for (const candidate of allMatches) {
        if (candidate && candidate !== usedModel) {
          const retryResult = await callRestModel(candidate);
          res = retryResult.res;
          data = retryResult.data;
          usedModel = retryResult.usedModel;
          if (res.ok) break;
        }
      }
    }

    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      const rawErr = data?.error?.message || `HTTP Error ${res.status}`;
      const code = classifyErrorCode(rawErr, res.status);
      await logEvent({
        level: 'error',
        code,
        source: 'gemini-api',
        message: `${actionLabel} failed: ${rawErr}`,
        details: `HTTP ${res.status} | Model: ${usedModel}`,
        model: usedModel,
        durationMs,
      });
      return {
        ok: false,
        errorCode: code,
        error: `[${code}] ${rawErr}`,
      };
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('') || '';

    if (!text) {
      const code: ErrorCode = 'GN-PARSE-001';
      await logEvent({
        level: 'warn',
        code,
        source: 'gemini-api',
        message: `${actionLabel} returned an empty response.`,
        model: usedModel,
        durationMs,
      });
      return {
        ok: false,
        errorCode: code,
        error: '[GN-PARSE-001] Gemini returned an empty response.',
      };
    }

    await logEvent({
      level: 'info',
      source: 'gemini-api',
      message: `${actionLabel} completed (${text.length} chars)`,
      model: usedModel,
      durationMs,
    });

    return { ok: true, text, usedModel };
  } catch (err: any) {
    const code: ErrorCode = 'GN-NET-001';
    const rawErr = err?.message || 'Failed to reach Gemini API.';
    await logEvent({
      level: 'error',
      code,
      source: 'gemini-api',
      message: `Network failure during ${actionLabel}: ${rawErr}`,
      durationMs: Date.now() - startTime,
    });
    return {
      ok: false,
      errorCode: code,
      error: `[${code}] ${rawErr}`,
    };
  }
}

export async function runGeminiAction(params: {
  action: AIActionType;
  targetText: string;
  noteTitle: string;
  customInstruction?: string;
  settings: AppSettings;
}): Promise<{
  ok: boolean;
  text?: string;
  usedModel?: string;
  errorCode?: ErrorCode;
  error?: string;
}> {
  const { action, targetText, noteTitle, customInstruction, settings } = params;
  const prompt = buildPromptForAction(
    action,
    targetText,
    noteTitle,
    customInstruction
  );

  return callGeminiRaw({
    prompt,
    actionLabel: `Inline AI (${action})`,
    systemInstruction: SYSTEM_INSTRUCTION,
    settings,
  });
}

/**
 * Generates smart Note Title, Tags, and Folder classification using Gemini.
 */
export async function generateNoteMetadata(params: {
  noteContent: string;
  currentTitle: string;
  availableFolders: string[];
  settings: AppSettings;
}): Promise<{
  ok: boolean;
  title?: string;
  tags?: string[];
  folder?: string;
  error?: string;
}> {
  const { noteContent, currentTitle, availableFolders, settings } = params;
  const plainText = stripHtmlToText(noteContent);

  if (!plainText && !currentTitle) {
    await logEvent({
      level: 'warn',
      code: 'GN-INPUT-001',
      source: 'editor',
      message: 'Auto-Title & Tag skipped: Note is empty.',
    });
    return {
      ok: false,
      error:
        '[GN-INPUT-001] Write some content in the note first so Gemini can analyze it.',
    };
  }

  const prompt = `Analyze the following note and return a JSON object with:
1. "title": A concise, descriptive, engaging title (3 to 7 words, no quotes).
2. "tags": An array of 3 to 5 lowercase single-word or hyphenated tags (without '#' prefix).
3. "folder": The single best matching folder from this list: ${JSON.stringify(
    availableFolders
  )}.

Return ONLY valid JSON without markdown code fences.

Current Title: "${currentTitle}"
Note Content:
"""
${plainText.slice(0, 4000)}
"""`;

  const res = await callGeminiRaw({
    prompt,
    actionLabel: 'Auto-Title & Tag',
    systemInstruction:
      'You are a precise JSON generator. Return only valid JSON with keys "title", "tags", and "folder".',
    settings,
  });

  if (!res.ok || !res.text) {
    return { ok: false, error: res.error || 'Failed to generate metadata.' };
  }

  try {
    const cleaned = res.text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    const title =
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : undefined;
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .map((t: any) =>
            String(t)
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, '')
          )
          .filter(Boolean)
          .slice(0, 5)
      : undefined;
    const folder =
      typeof parsed.folder === 'string' &&
      availableFolders.includes(parsed.folder)
        ? parsed.folder
        : undefined;

    return { ok: true, title, tags, folder };
  } catch (e: any) {
    await logEvent({
      level: 'warn',
      code: 'GN-PARSE-001',
      source: 'gemini-api',
      message: 'Failed to parse JSON from Auto-Title & Tag response.',
      details: res.text,
    });
    return {
      ok: false,
      error:
        '[GN-PARSE-001] Could not parse AI metadata response. Please try again.',
    };
  }
}

/**
 * Answers user questions across their entire note library.
 */
export async function chatWithAllNotes(params: {
  question: string;
  history: ChatMessage[];
  notes: Note[];
  settings: AppSettings;
}): Promise<{
  ok: boolean;
  answer?: string;
  citedNotes?: { id: string; title: string }[];
  error?: string;
}> {
  const { question, history, notes, settings } = params;
  const activeNotes = notes.filter((n) => !n.trashed);

  const notesContext = activeNotes
    .map((n, idx) => {
      const text = stripHtmlToText(n.content).slice(0, 2000);
      return `[Note ${idx + 1} | ID: ${n.id} | Title: "${
        n.title || 'Untitled'
      }" | Folder: ${n.folder || 'General'} | Tags: ${n.tags.join(', ')}]\n${text}`;
    })
    .join('\n\n---\n\n');

  const recentHistory = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Gemini'}: ${m.content}`)
    .join('\n\n');

  const prompt = `You have access to the user's personal notes library below:

=== USER NOTES LIBRARY (${activeNotes.length} notes) ===
${notesContext || '(No notes yet)'}
=== END OF NOTES ===

${recentHistory ? `=== RECENT CONVERSATION ===\n${recentHistory}\n===\n\n` : ''}User Question: ${question}

Instructions:
1. Answer the user's question helpfully and accurately based on their notes (and general knowledge if they ask to brainstorm or expand).
2. Mention relevant note titles in **bold** when referencing information from their notes.
3. Keep formatting clean and readable using Markdown.`;

  const res = await callGeminiRaw({
    prompt,
    actionLabel: `Chat with Notes (${activeNotes.length} notes)`,
    systemInstruction:
      'You are an intelligent knowledge-base assistant built into Gemini Notes. Help the user find insights, synthesize information, and answer questions across all their notes.',
    settings,
  });

  if (!res.ok || !res.text) {
    return { ok: false, error: res.error || 'Failed to get an answer.' };
  }

  const answerLower = res.text.toLowerCase();
  const citedNotes = activeNotes
    .filter((n) => {
      const title = (n.title || '').trim().toLowerCase();
      return title.length > 3 && answerLower.includes(title);
    })
    .slice(0, 4)
    .map((n) => ({ id: n.id, title: n.title || 'Untitled Note' }));

  return {
    ok: true,
    answer: res.text,
    citedNotes,
  };
}

/**
 * Generates a custom structured note template on any topic.
 */
export async function generateCustomTemplate(params: {
  topic: string;
  settings: AppSettings;
}): Promise<{
  ok: boolean;
  title?: string;
  html?: string;
  tags?: string[];
  error?: string;
}> {
  const { topic, settings } = params;
  const prompt = `Create a comprehensive, well-structured note-taking template for: "${topic}".
Use Markdown headings (##), bullet lists (- ), numbered lists (1. ), and placeholder prompts so the user can fill it out immediately.
Do NOT wrap the response in code fences and do NOT include conversational intro text.`;

  const res = await callGeminiRaw({
    prompt,
    actionLabel: `Generate Template ("${topic}")`,
    systemInstruction: SYSTEM_INSTRUCTION,
    settings,
  });

  if (!res.ok || !res.text) {
    return { ok: false, error: res.error || 'Failed to generate template.' };
  }

  return {
    ok: true,
    title: topic.replace(/\b\w/g, (c) => c.toUpperCase()),
    html: markdownToHtml(res.text),
    tags: [
      'template',
      topic.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, ''),
    ].filter(Boolean),
  };
}

/**
 * Converts clean Markdown returned by Gemini into safe, structured HTML blocks
 * suitable for inserting into the rich-text editor.
 */
export function markdownToHtml(md: string): string {
  const lines = md.trim().split('\n');
  const htmlParts: string[] = [];
  let inList: 'ul' | 'ol' | null = null;

  const formatInline = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  };

  const closeList = () => {
    if (inList) {
      htmlParts.push(`</${inList}>`);
      inList = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    if (line.startsWith('### ')) {
      closeList();
      htmlParts.push(`<h3>${formatInline(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      closeList();
      htmlParts.push(`<h2>${formatInline(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      closeList();
      htmlParts.push(`<h1>${formatInline(line.slice(2))}</h1>`);
    } else if (/^[-*•]\s+\[[ xX]\]\s+/.test(line)) {
      const checked = /^[-*•]\s+\[[xX]\]/.test(line);
      const itemText = line.replace(/^[-*•]\s+\[[ xX]\]\s+/, '');
      if (inList !== 'ul') {
        closeList();
        inList = 'ul';
        htmlParts.push('<ul>');
      }
      htmlParts.push(
        `<li><input type="checkbox" ${checked ? 'checked' : ''} /> ${formatInline(itemText)}</li>`
      );
    } else if (/^[-*•]\s+/.test(line)) {
      const itemText = line.replace(/^[-*•]\s+/, '');
      if (inList !== 'ul') {
        closeList();
        inList = 'ul';
        htmlParts.push('<ul>');
      }
      htmlParts.push(`<li>${formatInline(itemText)}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      const itemText = line.replace(/^\d+\.\s+/, '');
      if (inList !== 'ol') {
        closeList();
        inList = 'ol';
        htmlParts.push('<ol>');
      }
      htmlParts.push(`<li>${formatInline(itemText)}</li>`);
    } else if (line.startsWith('> ')) {
      closeList();
      htmlParts.push(`<blockquote>${formatInline(line.slice(2))}</blockquote>`);
    } else {
      closeList();
      htmlParts.push(`<p>${formatInline(line)}</p>`);
    }
  }

  closeList();
  return htmlParts.join('');
}
