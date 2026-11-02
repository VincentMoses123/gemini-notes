import { AIActionType, AppSettings, ChatMessage, ErrorCode, Note } from '../types';
import { stripHtmlToText } from './storage';
import { classifyErrorCode, logEvent, redactSensitiveString } from './logger';

const SYSTEM_INSTRUCTION = `You are an expert inline AI writing assistant embedded inside a modern note-taking app.
Follow these formatting rules strictly:
1. Return ONLY the requested output text — never include conversational filler like "Here is the revised version:" or "Sure, I can help with that."
2. You may use clean Markdown formatting (such as **bold**, *italics*, bullet lists with "- ", numbered lists, or ## headings) when appropriate, as the editor will render it cleanly.
3. Preserve the original accuracy and core meaning unless instructed to expand or brainstorm.`;

const ACTION_INSTRUCTIONS: Record<Exclude<AIActionType, 'translate' | 'custom'>, string> = {
  summarize: 'Summarize the following text clearly and concisely, capturing the key points:',
  rewrite:
    'Rewrite the following text to improve its clarity, flow, and readability while keeping the same meaning:',
  fix_grammar:
    'Fix all spelling, grammar, and punctuation errors in the following text without changing its tone or voice:',
  expand: 'Expand on the following text with more detail, depth, and helpful elaboration:',
  shorten:
    'Make the following text significantly shorter and more punchy while preserving the core message:',
  bullet_points:
    'Convert the following text into a well-structured bulleted list of key takeaways:',
  action_items:
    'Extract a clear list of actionable tasks / next steps (with owners or deadlines if mentioned) from the following text:',
  tone_professional:
    'Rewrite the following text in a polished, executive, professional tone:',
  tone_casual: 'Rewrite the following text in a warm, natural, conversational tone:',
  continue_writing:
    'Continue writing the next paragraph(s) naturally based on the context below, matching its style and topic:',
  pros_cons:
    'Generate a structured **Pros & Cons** analysis and key trade-offs based on the following topic or text:',
  explain_simply:
    'Explain the following concept or text in simple, plain, easy-to-understand language (ELI5) with a quick analogy if helpful:',
  study_flashcards:
    'Create a set of **Key Terms & Q&A Study Flashcards** (Question / Answer format) from the following notes:',
};

export function buildPromptForAction(
  action: AIActionType,
  targetText: string,
  noteContextTitle: string,
  customInstruction?: string
): string {
  const contextHeader = noteContextTitle ? `Note Title: "${noteContextTitle}"\n\n` : '';
  const quotedTarget = `"""\n${targetText}\n"""`;

  if (action === 'translate') {
    return `${contextHeader}Translate the following text into ${
      customInstruction || 'Spanish'
    } while preserving formatting and tone:\n\n${quotedTarget}`;
  }
  if (action === 'custom') {
    return `${contextHeader}Instruction: ${
      customInstruction || 'Improve the text'
    }\n\nTarget text:\n${quotedTarget}`;
  }
  return `${contextHeader}${ACTION_INSTRUCTIONS[action]}\n\n${quotedTarget}`;
}

export interface GeminiRawResult {
  ok: boolean;
  text?: string;
  usedModel?: string;
  errorCode?: ErrorCode;
  error?: string;
}

async function logGeminiFailure(params: {
  actionLabel: string;
  rawError: string;
  code?: ErrorCode;
  httpStatus?: number;
  details?: string;
  model?: string;
  durationMs: number;
  level?: 'warn' | 'error';
}): Promise<GeminiRawResult> {
  const cleanErr = redactSensitiveString(
    (params.rawError || 'Unknown Gemini API error').replace(/^\[GN-[A-Z]+-\d+\]\s*/, '')
  );
  const code = params.code || classifyErrorCode(cleanErr, params.httpStatus);
  await logEvent({
    level: params.level || 'error',
    code,
    source: 'gemini-api',
    message: `${params.actionLabel} failed: ${cleanErr}`,
    details: params.details,
    model: params.model,
    durationMs: params.durationMs,
  });
  return { ok: false, errorCode: code, error: `[${code}] ${cleanErr}` };
}

export async function callGeminiRaw(params: {
  prompt: string;
  actionLabel?: string;
  systemInstruction?: string;
  settings: AppSettings;
}): Promise<GeminiRawResult> {
  const {
    prompt,
    actionLabel = 'AI Request',
    systemInstruction = SYSTEM_INSTRUCTION,
    settings,
  } = params;
  const startTime = Date.now();
  const requestedModel = settings.model || 'gemini-3-flash-preview';

  if (window.electronAPI) {
    const res = await window.electronAPI.generateWithGemini({
      apiKey: settings.apiKey,
      model: requestedModel,
      systemInstruction,
      prompt,
    });
    const durationMs = res.durationMs || Date.now() - startTime;
    const activeModel = res.usedModel || requestedModel;

    if (res.fallbackTriggered && res.initialModel && res.usedModel) {
      await logEvent({
        level: 'warn',
        code: 'GN-MODEL-001',
        source: 'gemini-api',
        message: `Model "${res.initialModel}" unavailable; auto-switched to "${res.usedModel}".`,
        details: `Action: ${actionLabel} | Automatic model discovery succeeded.`,
        model: res.usedModel,
        durationMs,
      });
    }

    if (res.ok && res.text) {
      await logEvent({
        level: 'info',
        source: 'gemini-api',
        message: `${actionLabel} completed (${res.text.length} chars)`,
        details: `Prompt length: ${prompt.length} chars | Model: ${activeModel}`,
        model: activeModel,
        durationMs,
      });
      return { ok: true, text: res.text, usedModel: res.usedModel };
    }

    return logGeminiFailure({
      actionLabel,
      rawError: res.error || 'Unknown Gemini API error',
      code: res.errorCode,
      httpStatus: res.httpStatus,
      details: `HTTP Status: ${res.httpStatus || 'N/A'} | Requested Model: ${
        res.initialModel || requestedModel
      }`,
      model: activeModel,
      durationMs,
    });
  }

  // Browser REST fallback
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    return logGeminiFailure({
      actionLabel,
      rawError:
        'Missing Gemini API key. Click "Gemini Settings" in the sidebar to enter your Gemini API key.',
      code: 'GN-AUTH-001',
      durationMs: Date.now() - startTime,
    });
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
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
      }),
    });
    const data = await res.json();
    return { res, data, usedModel: cleanModel };
  };

  try {
    let { res, data, usedModel } = await callRestModel(requestedModel);

    if (!res.ok) {
      const errMessage = data?.error?.message || '';
      const suggestions = Array.from(
        errMessage.matchAll(/models\/([a-zA-Z0-9._-]+)/g),
        (m: RegExpMatchArray) => m[1]
      );
      for (const candidate of suggestions) {
        if (candidate && candidate !== usedModel) {
          ({ res, data, usedModel } = await callRestModel(candidate));
          if (res.ok) break;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    if (!res.ok) {
      return logGeminiFailure({
        actionLabel,
        rawError: data?.error?.message || `HTTP Error ${res.status}`,
        httpStatus: res.status,
        details: `HTTP ${res.status} | Model: ${usedModel}`,
        model: usedModel,
        durationMs,
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('') || '';

    if (!text) {
      return logGeminiFailure({
        actionLabel,
        rawError: 'Gemini returned an empty response.',
        code: 'GN-PARSE-001',
        level: 'warn',
        model: usedModel,
        durationMs,
      });
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
    return logGeminiFailure({
      actionLabel,
      rawError: err?.message || 'Failed to reach Gemini API.',
      code: 'GN-NET-001',
      durationMs: Date.now() - startTime,
    });
  }
}

export async function runGeminiAction(params: {
  action: AIActionType;
  targetText: string;
  noteTitle: string;
  customInstruction?: string;
  settings: AppSettings;
}): Promise<GeminiRawResult> {
  const { action, targetText, noteTitle, customInstruction, settings } = params;
  return callGeminiRaw({
    prompt: buildPromptForAction(action, targetText, noteTitle, customInstruction),
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
      error: '[GN-INPUT-001] Write some content in the note first so Gemini can analyze it.',
    };
  }

  const prompt = `Analyze the following note and return a JSON object with:
1. "title": A concise, descriptive, engaging title (3 to 7 words, no quotes).
2. "tags": An array of 3 to 5 lowercase single-word or hyphenated tags (without '#' prefix).
3. "folder": The single best matching folder from this list: ${JSON.stringify(availableFolders)}.

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
    const cleaned = res.text.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
    const parsed = JSON.parse(cleaned);
    const title =
      typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : undefined;
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .map((t: any) => String(t).toLowerCase().replace(/[^a-z0-9_-]/g, ''))
          .filter(Boolean)
          .slice(0, 5)
      : undefined;
    const folder =
      typeof parsed.folder === 'string' && availableFolders.includes(parsed.folder)
        ? parsed.folder
        : undefined;

    return { ok: true, title, tags, folder };
  } catch {
    await logEvent({
      level: 'warn',
      code: 'GN-PARSE-001',
      source: 'gemini-api',
      message: 'Failed to parse JSON from Auto-Title & Tag response.',
      details: res.text,
    });
    return {
      ok: false,
      error: '[GN-PARSE-001] Could not parse AI metadata response. Please try again.',
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
    .map(
      (n, idx) =>
        `[Note ${idx + 1} | ID: ${n.id} | Title: "${n.title || 'Untitled'}" | Folder: ${
          n.folder || 'General'
        } | Tags: ${n.tags.join(', ')}]\n${stripHtmlToText(n.content).slice(0, 2000)}`
    )
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

  return { ok: true, answer: res.text, citedNotes };
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
    tags: ['template', topic.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '')].filter(
      Boolean
    ),
  };
}

/**
 * Converts clean Markdown returned by Gemini into safe, structured HTML blocks
 * suitable for inserting into the rich-text editor.
 */
export function markdownToHtml(md: string): string {
  const htmlParts: string[] = [];
  let inList: 'ul' | 'ol' | null = null;

  const formatInline = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');

  const closeList = () => {
    if (inList) {
      htmlParts.push(`</${inList}>`);
      inList = null;
    }
  };

  const ensureList = (type: 'ul' | 'ol') => {
    if (inList !== type) {
      closeList();
      inList = type;
      htmlParts.push(`<${type}>`);
    }
  };

  for (const rawLine of md.trim().split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      htmlParts.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
    } else if (/^[-*•]\s+\[[ xX]\]\s+/.test(line)) {
      const checked = /^[-*•]\s+\[[xX]\]/.test(line);
      const itemText = line.replace(/^[-*•]\s+\[[ xX]\]\s+/, '');
      ensureList('ul');
      htmlParts.push(
        `<li><input type="checkbox" ${checked ? 'checked' : ''} /> ${formatInline(itemText)}</li>`
      );
    } else if (/^[-*•]\s+/.test(line)) {
      ensureList('ul');
      htmlParts.push(`<li>${formatInline(line.replace(/^[-*•]\s+/, ''))}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      ensureList('ol');
      htmlParts.push(`<li>${formatInline(line.replace(/^\d+\.\s+/, ''))}</li>`);
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
