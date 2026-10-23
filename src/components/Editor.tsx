import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Sparkles,
  Star,
  Trash2,
  Download,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Code,
  Wand2,
  Check,
  Copy,
  RefreshCw,
  X,
  Plus,
  Send,
  Loader2,
  FileText,
  CheckSquare,
  ArrowDownLeft,
  Replace,
  Briefcase,
  MessageCircle,
  Minimize2,
  Maximize2,
  Folder,
  MessageSquare,
  History,
  Scale,
  Lightbulb,
  BookOpen,
  Languages,
  Terminal,
} from 'lucide-react';
import { AIActionType, AppSettings, Note, NoteSnapshot } from '../types';
import {
  generateNoteMetadata,
  markdownToHtml,
  runGeminiAction,
} from '../services/gemini';
import { htmlToMarkdown } from '../services/storage';
import { logEvent } from '../services/logger';

interface EditorProps {
  note: Note;
  folders: string[];
  settings: AppSettings;
  chatOpen: boolean;
  focusMode: boolean;
  onUpdateNote: (updated: Partial<Note>) => void;
  onTrashNote: (id: string) => void;
  onOpenSettings: () => void;
  onOpenLogs: () => void;
  onToggleChat: () => void;
  onToggleFocusMode: () => void;
}

interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  category: 'ai' | 'format';
  icon: React.ReactNode;
  run: () => void;
}

export const Editor: React.FC<EditorProps> = ({
  note,
  folders,
  settings,
  chatOpen,
  focusMode,
  onUpdateNote,
  onTrashNote,
  onOpenSettings,
  onOpenLogs,
  onToggleChat,
  onToggleFocusMode,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastLoadedNoteId = useRef<string | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  const [tagInput, setTagInput] = useState('');
  const [wordStats, setWordStats] = useState({ words: 0, chars: 0 });
  const [autoTagging, setAutoTagging] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Floating selection bubble state
  const [selectionMenu, setSelectionMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    selectedText: string;
  }>({ visible: false, x: 0, y: 0, selectedText: '' });

  // Inline AI assistant panel state
  const [aiPanel, setAiPanel] = useState<{
    open: boolean;
    targetText: string;
    hasSelection: boolean;
    loading: boolean;
    resultMarkdown: string;
    error: string | null;
    lastAction: AIActionType;
    customPrompt: string;
  }>({
    open: false,
    targetText: '',
    hasSelection: false,
    loading: false,
    resultMarkdown: '',
    error: null,
    lastAction: 'rewrite',
    customPrompt: '',
  });

  // Slash command menu state
  const [slashMenu, setSlashMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    query: string;
    selectedIndex: number;
  }>({
    open: false,
    x: 0,
    y: 0,
    query: '',
    selectedIndex: 0,
  });

  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const computeStats = useCallback((html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const text = (tmp.textContent || tmp.innerText || '').trim();
    const chars = text.length;
    const words = text ? text.split(/\s+/).length : 0;
    setWordStats({ words, chars });
  }, []);

  // Load content into contentEditable when switching notes
  useEffect(() => {
    if (editorRef.current && lastLoadedNoteId.current !== note.id) {
      editorRef.current.innerHTML = note.content || '<p><br></p>';
      lastLoadedNoteId.current = note.id;
      computeStats(note.content || '');
      setSelectionMenu({ visible: false, x: 0, y: 0, selectedText: '' });
      setSlashMenu((prev) => ({ ...prev, open: false }));
      setAiPanel((prev) => ({ ...prev, open: false, error: null, resultMarkdown: '' }));
    }
  }, [note.id, note.content, computeStats]);

  const syncEditorContent = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    computeStats(html);
    onUpdateNote({ content: html });
  }, [computeStats, onUpdateNote]);

  // Save current DOM selection Range
  const saveCurrentSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  };

  const restoreSavedSelection = () => {
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
    }
  };

  // Detect text selection inside the editor for Floating Bubble Menu
  const handleMouseUpOrKeyUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editorRef.current) {
      setSelectionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    const text = sel.toString().trim();
    if (!text || text.length < 2) {
      setSelectionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    savedRangeRef.current = range.cloneRange();
    const rect = range.getBoundingClientRect();
    const clampedX = Math.max(280, Math.min(window.innerWidth - 360, rect.left + rect.width / 2));
    const clampedY = Math.max(70, rect.top - 48);

    setSelectionMenu({
      visible: true,
      x: clampedX,
      y: clampedY,
      selectedText: text,
    });
  };

  // Formatting command helper
  const execFormat = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    restoreSavedSelection();
    document.execCommand(command, false, value);
    syncEditorContent();
    saveCurrentSelection();
  };

  // Trigger Gemini AI action
  const triggerAIAction = async (
    action: AIActionType,
    overrideTargetText?: string,
    hasSelectionFlag?: boolean,
    customInstructionText?: string
  ) => {
    const plainNoteText = editorRef.current?.innerText?.trim() || '';
    const target =
      overrideTargetText !== undefined
        ? overrideTargetText
        : selectionMenu.selectedText || aiPanel.targetText || plainNoteText;

    const isSelection =
      hasSelectionFlag !== undefined
        ? hasSelectionFlag
        : Boolean(selectionMenu.selectedText || aiPanel.hasSelection);

    setSelectionMenu((prev) => ({ ...prev, visible: false }));

    if (!target.trim()) {
      setAiPanel({
        open: true,
        targetText: note.title || 'New note',
        hasSelection: false,
        loading: false,
        resultMarkdown: '',
        error: 'Write a few words or a title first so Gemini has context to work with!',
        lastAction: action,
        customPrompt: customInstructionText || '',
      });
      return;
    }

    setAiPanel({
      open: true,
      targetText: target,
      hasSelection: isSelection,
      loading: true,
      resultMarkdown: '',
      error: null,
      lastAction: action,
      customPrompt: customInstructionText ?? aiPanel.customPrompt,
    });

    const response = await runGeminiAction({
      action,
      targetText: target,
      noteTitle: note.title,
      customInstruction: customInstructionText ?? aiPanel.customPrompt,
      settings,
    });

    if (response.ok && response.text) {
      setAiPanel((prev) => ({
        ...prev,
        loading: false,
        resultMarkdown: response.text || '',
        error: null,
      }));
    } else {
      setAiPanel((prev) => ({
        ...prev,
        loading: false,
        error: response.error || 'Failed to generate AI response.',
      }));
    }
  };

  // Remove the "/command" trigger text from the DOM before running a slash command
  const removeSlashTriggerFromDom = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      const textBefore = node.textContent.slice(0, range.startOffset);
      const slashIndex = textBefore.lastIndexOf('/');
      if (slashIndex !== -1) {
        const deleteRange = document.createRange();
        deleteRange.setStart(node, slashIndex);
        deleteRange.setEnd(node, range.startOffset);
        deleteRange.deleteContents();
      }
    }
  };

  const slashCommands: SlashCommandItem[] = [
    {
      id: 'ai-continue',
      label: 'Continue Writing',
      description: 'Let Gemini write the next paragraph based on your note',
      category: 'ai',
      icon: <Sparkles size={15} className="accent-icon" />,
      run: () => {
        const text = editorRef.current?.innerText?.trim() || note.title;
        triggerAIAction('continue_writing', text, false);
      },
    },
    {
      id: 'ai-summarize',
      label: 'Summarize Note',
      description: 'Generate a concise summary of this note',
      category: 'ai',
      icon: <Wand2 size={15} className="accent-icon" />,
      run: () => {
        const text = editorRef.current?.innerText?.trim() || '';
        triggerAIAction('summarize', text, false);
      },
    },
    {
      id: 'ai-actions',
      label: 'Extract Action Items',
      description: 'Find tasks, next steps, and owners from your note',
      category: 'ai',
      icon: <CheckSquare size={15} className="accent-icon" />,
      run: () => {
        const text = editorRef.current?.innerText?.trim() || '';
        triggerAIAction('action_items', text, false);
      },
    },
    {
      id: 'ai-pros-cons',
      label: 'Generate Pros & Cons',
      description: 'Analyze trade-offs, advantages, and risks on this topic',
      category: 'ai',
      icon: <Scale size={15} className="accent-icon" />,
      run: () => {
        const text = editorRef.current?.innerText?.trim() || note.title;
        triggerAIAction('pros_cons', text, false);
      },
    },
    {
      id: 'ai-flashcards',
      label: 'Create Study Flashcards & Quiz',
      description: 'Turn your note into Q&A study flashcards and key terms',
      category: 'ai',
      icon: <BookOpen size={15} className="accent-icon" />,
      run: () => {
        const text = editorRef.current?.innerText?.trim() || '';
        triggerAIAction('study_flashcards', text, false);
      },
    },
    {
      id: 'ai-eli5',
      label: 'Explain Simply (ELI5)',
      description: 'Break down complex ideas in plain language',
      category: 'ai',
      icon: <Lightbulb size={15} className="accent-icon" />,
      run: () => {
        const text = editorRef.current?.innerText?.trim() || '';
        triggerAIAction('explain_simply', text, false);
      },
    },
    {
      id: 'ai-custom',
      label: 'Ask Gemini Custom Prompt...',
      description: 'Give Gemini any custom writing or brainstorming instruction',
      category: 'ai',
      icon: <MessageCircle size={15} className="accent-icon" />,
      run: () => {
        const text = editorRef.current?.innerText?.trim() || note.title || 'Brainstorm';
        setAiPanel({
          open: true,
          targetText: text,
          hasSelection: false,
          loading: false,
          resultMarkdown: '',
          error: null,
          lastAction: 'custom',
          customPrompt: '',
        });
      },
    },
    {
      id: 'h1',
      label: 'Heading 1',
      description: 'Large section heading',
      category: 'format',
      icon: <Heading1 size={15} />,
      run: () => execFormat('formatBlock', 'H1'),
    },
    {
      id: 'h2',
      label: 'Heading 2',
      description: 'Medium section heading',
      category: 'format',
      icon: <Heading2 size={15} />,
      run: () => execFormat('formatBlock', 'H2'),
    },
    {
      id: 'h3',
      label: 'Heading 3',
      description: 'Sub-section heading',
      category: 'format',
      icon: <Heading3 size={15} />,
      run: () => execFormat('formatBlock', 'H3'),
    },
    {
      id: 'bullet',
      label: 'Bullet List',
      description: 'Create a simple bulleted list',
      category: 'format',
      icon: <List size={15} />,
      run: () => execFormat('insertUnorderedList'),
    },
    {
      id: 'numbered',
      label: 'Numbered List',
      description: 'Create an ordered list',
      category: 'format',
      icon: <ListOrdered size={15} />,
      run: () => execFormat('insertOrderedList'),
    },
    {
      id: 'quote',
      label: 'Quote Block',
      description: 'Highlight an important quote or callout',
      category: 'format',
      icon: <Quote size={15} />,
      run: () => execFormat('formatBlock', 'BLOCKQUOTE'),
    },
    {
      id: 'divider',
      label: 'Divider Line',
      description: 'Visually separate sections with a horizontal line',
      category: 'format',
      icon: <Minus size={15} />,
      run: () => execFormat('insertHorizontalRule'),
    },
  ];

  const filteredSlashCommands = slashCommands.filter((item) => {
    if (!slashMenu.query) return true;
    const q = slashMenu.query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  });

  const executeSlashCommand = (item: SlashCommandItem) => {
    removeSlashTriggerFromDom();
    setSlashMenu((prev) => ({ ...prev, open: false, query: '' }));
    item.run();
    syncEditorContent();
  };

  // Handle keydown inside editor (for slash menu navigation & shortcuts)
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (slashMenu.open && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashMenu((prev) => ({
          ...prev,
          selectedIndex: (prev.selectedIndex + 1) % filteredSlashCommands.length,
        }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashMenu((prev) => ({
          ...prev,
          selectedIndex:
            (prev.selectedIndex - 1 + filteredSlashCommands.length) %
            filteredSlashCommands.length,
        }));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const chosen =
          filteredSlashCommands[slashMenu.selectedIndex] ||
          filteredSlashCommands[0];
        if (chosen) {
          executeSlashCommand(chosen);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenu((prev) => ({ ...prev, open: false }));
        return;
      }
    }
  };

  // Detect "/" slash command while typing
  const handleEditorInput = () => {
    syncEditorContent();

    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || !sel.rangeCount) {
      setSlashMenu((prev) => (prev.open ? { ...prev, open: false } : prev));
      return;
    }

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      const textBefore = node.textContent.slice(0, range.startOffset);
      const match = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
      if (match) {
        const rect = range.getBoundingClientRect();
        setSlashMenu({
          open: true,
          x: Math.min(window.innerWidth - 320, Math.max(260, rect.left)),
          y: Math.min(window.innerHeight - 340, rect.bottom + 8),
          query: match[1] || '',
          selectedIndex: 0,
        });
        return;
      }
    }

    if (slashMenu.open) {
      setSlashMenu((prev) => ({ ...prev, open: false }));
    }
  };

  // Save a snapshot of the current note state
  const createSnapshot = (reason: string) => {
    const currentHtml = editorRef.current?.innerHTML || note.content;
    const snap: NoteSnapshot = {
      id: `snap-${Date.now()}`,
      title: note.title,
      content: currentHtml,
      reason,
      createdAt: new Date().toISOString(),
    };
    const existing = note.snapshots || [];
    onUpdateNote({ snapshots: [snap, ...existing].slice(0, 15) });
    logEvent({
      level: 'info',
      source: 'editor',
      message: `Saved note snapshot: "${reason}"`,
      details: `Note: "${note.title}"`,
    });
  };

  const handleRestoreSnapshot = (snap: NoteSnapshot) => {
    createSnapshot('Before Snapshot Restore');
    if (editorRef.current) {
      editorRef.current.innerHTML = snap.content;
    }
    onUpdateNote({ title: snap.title, content: snap.content });
    computeStats(snap.content);
    setHistoryOpen(false);
  };

  // Replace selected text in the editor with Gemini's result
  const handleReplaceSelection = () => {
    if (!editorRef.current || !aiPanel.resultMarkdown) return;
    createSnapshot('Before AI Replace');
    const html = markdownToHtml(aiPanel.resultMarkdown);

    editorRef.current.focus();
    if (aiPanel.hasSelection && savedRangeRef.current) {
      restoreSavedSelection();
      document.execCommand('insertHTML', false, html);
    } else {
      editorRef.current.innerHTML = html;
    }

    syncEditorContent();
    setAiPanel((prev) => ({ ...prev, open: false, resultMarkdown: '' }));
  };

  // Insert Gemini's result below the current selection or at the bottom of the note
  const handleInsertBelow = () => {
    if (!editorRef.current || !aiPanel.resultMarkdown) return;
    const html = markdownToHtml(aiPanel.resultMarkdown);

    editorRef.current.focus();
    if (aiPanel.hasSelection && savedRangeRef.current) {
      const range = savedRangeRef.current.cloneRange();
      range.collapse(false);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      document.execCommand('insertHTML', false, `<br>${html}`);
    } else {
      editorRef.current.innerHTML = `${editorRef.current.innerHTML}${html}`;
    }

    syncEditorContent();
    setAiPanel((prev) => ({ ...prev, open: false, resultMarkdown: '' }));
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(aiPanel.resultMarkdown);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 1800);
  };

  // Tag handlers
  const handleAddTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const clean = tagInput.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
      if (clean && !note.tags.includes(clean)) {
        onUpdateNote({ tags: [...note.tags, clean] });
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateNote({ tags: note.tags.filter((t) => t !== tagToRemove) });
  };

  const handleAutoTitleAndTag = async () => {
    if (autoTagging) return;
    setAutoTagging(true);
    const currentHtml = editorRef.current?.innerHTML || note.content;
    const res = await generateNoteMetadata({
      noteContent: currentHtml,
      currentTitle: note.title,
      availableFolders: folders,
      settings,
    });
    setAutoTagging(false);

    if (res.ok) {
      const updates: Partial<Note> = {};
      if (res.title) updates.title = res.title;
      if (res.tags && res.tags.length > 0) {
        updates.tags = Array.from(new Set([...note.tags, ...res.tags]));
      }
      if (res.folder) updates.folder = res.folder;
      onUpdateNote(updates);
    } else if (res.error) {
      setAiPanel((prev) => ({
        ...prev,
        open: true,
        error: res.error || null,
      }));
    }
  };

  const handleExportMarkdown = async () => {
    const md = `# ${note.title || 'Untitled Note'}\n\n${htmlToMarkdown(
      note.content
    )}`;
    if (window.electronAPI) {
      await window.electronAPI.exportMarkdown({
        title: note.title || 'Untitled Note',
        markdown: md,
      });
    } else {
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${note.title || 'note'}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const readMinutes = Math.max(1, Math.ceil(wordStats.words / 200));

  return (
    <main className="editor-container">
      {/* Top Drag Header & Quick Actions */}
      <header className="editor-topbar">
        <div className="editor-stats">
          <span>{wordStats.words} words</span>
          <span className="dot-sep">•</span>
          <span>{wordStats.chars} chars</span>
          <span className="dot-sep">•</span>
          <span>~{readMinutes} min read</span>
        </div>

        <div className="editor-topbar-actions no-drag">
          <button
            className="ask-gemini-top-btn"
            onClick={() => {
              saveCurrentSelection();
              const selText = window.getSelection()?.toString().trim() || '';
              const fullText = editorRef.current?.innerText?.trim() || '';
              setAiPanel({
                open: true,
                targetText: selText || fullText,
                hasSelection: Boolean(selText),
                loading: false,
                resultMarkdown: '',
                error: null,
                lastAction: 'custom',
                customPrompt: '',
              });
            }}
          >
            <Sparkles size={14} />
            <span>Ask Gemini</span>
          </button>

          <button
            className={`chat-notes-top-btn ${chatOpen ? 'active' : ''}`}
            onClick={onToggleChat}
            title="Chat with All Notes (⌘J)"
          >
            <MessageSquare size={14} />
            <span>Chat with Notes</span>
          </button>

          <button
            className={`icon-btn ${historyOpen ? 'pinned-active' : ''}`}
            onClick={() => setHistoryOpen((prev) => !prev)}
            title={`Version Snapshots (${(note.snapshots || []).length})`}
          >
            <History size={16} />
          </button>

          <button
            className={`icon-btn ${focusMode ? 'pinned-active' : ''}`}
            onClick={onToggleFocusMode}
            title={
              focusMode
                ? 'Exit Zen Focus Mode (⌘\\)'
                : 'Enter Zen Focus Mode (⌘\\)'
            }
          >
            {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            className={`icon-btn ${note.pinned ? 'pinned-active' : ''}`}
            onClick={() => onUpdateNote({ pinned: !note.pinned })}
            title={note.pinned ? 'Unpin from Favorites' : 'Pin to Favorites'}
          >
            <Star size={16} fill={note.pinned ? 'currentColor' : 'none'} />
          </button>

          <button
            className="icon-btn"
            onClick={handleExportMarkdown}
            title="Export Note as Markdown (.md)"
          >
            <Download size={16} />
          </button>

          <button
            className="icon-btn danger"
            onClick={() => onTrashNote(note.id)}
            title="Move Note to Trash"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {/* Rich Formatting Bar */}
      <div className="formatting-toolbar">
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat('formatBlock', 'H1');
          }}
          title="Heading 1"
        >
          <Heading1 size={15} />
        </button>
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat('formatBlock', 'H2');
          }}
          title="Heading 2"
        >
          <Heading2 size={15} />
        </button>
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat('formatBlock', 'H3');
          }}
          title="Heading 3"
        >
          <Heading3 size={15} />
        </button>

        <div className="toolbar-divider" />

        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat('bold');
          }}
          title="Bold (⌘B)"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat('italic');
          }}
          title="Italic (⌘I)"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat('underline');
          }}
          title="Underline (⌘U)"
        >
          <Underline size={15} />
        </button>
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat('strikeThrough');
          }}
          title="Strikethrough"
        >
          <Strikethrough size={15} />
        </button>

        <div className="toolbar-divider" />

        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat('insertUnorderedList');
          }}
          title="Bullet List"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat('insertOrderedList');
          }}
          title="Numbered List"
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat('formatBlock', 'BLOCKQUOTE');
          }}
          title="Quote Block"
        >
          <Quote size={15} />
        </button>
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat('formatBlock', 'PRE');
          }}
          title="Code Block"
        >
          <Code size={15} />
        </button>
        <button
          type="button"
          className="format-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            execFormat('insertHorizontalRule');
          }}
          title="Horizontal Divider"
        >
          <Minus size={15} />
        </button>

        <div className="toolbar-spacer" />
        <span className="slash-hint">
          Tip: Select text for AI tools or type <code>/</code> for commands
        </span>
      </div>

      {/* Main Scrollable Writing Surface */}
      <div className="editor-scroll-area">
        <div className="editor-paper">
          <input
            type="text"
            className="note-title-input"
            placeholder="Note Title..."
            value={note.title}
            onChange={(e) => onUpdateNote({ title: e.target.value })}
          />

          <div className="note-tags-row">
            <div className="note-folder-select-wrap">
              <Folder size={12} className="accent-icon" />
              <select
                value={note.folder || 'General'}
                onChange={(e) => onUpdateNote({ folder: e.target.value })}
                title="Move Note to Notebook Folder"
              >
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="auto-metadata-btn"
              onClick={handleAutoTitleAndTag}
              disabled={autoTagging}
              title="Let Gemini generate a smart title, #tags, and folder from your note"
            >
              {autoTagging ? (
                <>
                  <Loader2 size={12} className="spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Wand2 size={12} />
                  <span>Auto-Title & Tag</span>
                </>
              )}
            </button>

            {note.tags.map((tag) => (
              <span key={tag} className="tag-badge">
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  title="Remove tag"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <div className="add-tag-input-wrap">
              <Plus size={12} />
              <input
                type="text"
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTagKeyDown}
              />
            </div>
          </div>

          {/* Version Snapshots Drawer */}
          {historyOpen && (
            <div className="snapshots-inline-card">
              <div className="ai-card-header">
                <div className="ai-card-title">
                  <History size={15} className="accent-icon" />
                  <span>
                    Note Version Snapshots ({(note.snapshots || []).length})
                  </span>
                </div>
                <div className="snapshots-header-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => createSnapshot('Manual Checkpoint')}
                  >
                    <Plus size={12} />
                    <span>Save Checkpoint</span>
                  </button>
                  <button
                    className="icon-mini-btn"
                    onClick={() => setHistoryOpen(false)}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
              {(!note.snapshots || note.snapshots.length === 0) ? (
                <p className="snapshots-empty-text">
                  No snapshots saved yet. Snapshots are created automatically
                  before AI replacements or when you click "Save Checkpoint".
                </p>
              ) : (
                <div className="snapshots-list">
                  {note.snapshots.map((snap) => (
                    <div key={snap.id} className="snapshot-item-row">
                      <div>
                        <strong>{snap.reason}</strong>
                        <span className="snapshot-time">
                          {new Date(snap.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => handleRestoreSnapshot(snap)}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Inline Gemini Assistant Drawer / Card */}
          {aiPanel.open && (
            <div className="ai-inline-card">
              <div className="ai-card-header">
                <div className="ai-card-title">
                  <Sparkles size={15} className="accent-icon" />
                  <span>
                    Gemini Writing Assistant{' '}
                    <small>
                      ({aiPanel.hasSelection ? 'Selected Text' : 'Full Note'})
                    </small>
                  </span>
                </div>
                <button
                  className="icon-mini-btn"
                  onClick={() => setAiPanel((prev) => ({ ...prev, open: false }))}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Quick AI Action Pills */}
              <div className="ai-action-pills">
                <button
                  type="button"
                  className="ai-pill"
                  disabled={aiPanel.loading}
                  onClick={() =>
                    triggerAIAction(
                      'rewrite',
                      aiPanel.targetText,
                      aiPanel.hasSelection
                    )
                  }
                >
                  <Wand2 size={13} />
                  <span>Improve Writing</span>
                </button>
                <button
                  type="button"
                  className="ai-pill"
                  disabled={aiPanel.loading}
                  onClick={() =>
                    triggerAIAction(
                      'summarize',
                      aiPanel.targetText,
                      aiPanel.hasSelection
                    )
                  }
                >
                  <FileText size={13} />
                  <span>Summarize</span>
                </button>
                <button
                  type="button"
                  className="ai-pill"
                  disabled={aiPanel.loading}
                  onClick={() =>
                    triggerAIAction(
                      'fix_grammar',
                      aiPanel.targetText,
                      aiPanel.hasSelection
                    )
                  }
                >
                  <Check size={13} />
                  <span>Fix Grammar</span>
                </button>
                <button
                  type="button"
                  className="ai-pill"
                  disabled={aiPanel.loading}
                  onClick={() =>
                    triggerAIAction(
                      'shorten',
                      aiPanel.targetText,
                      aiPanel.hasSelection
                    )
                  }
                >
                  <Minimize2 size={13} />
                  <span>Make Concise</span>
                </button>
                <button
                  type="button"
                  className="ai-pill"
                  disabled={aiPanel.loading}
                  onClick={() =>
                    triggerAIAction(
                      'expand',
                      aiPanel.targetText,
                      aiPanel.hasSelection
                    )
                  }
                >
                  <Maximize2 size={13} />
                  <span>Expand</span>
                </button>
                <button
                  type="button"
                  className="ai-pill"
                  disabled={aiPanel.loading}
                  onClick={() =>
                    triggerAIAction(
                      'action_items',
                      aiPanel.targetText,
                      aiPanel.hasSelection
                    )
                  }
                >
                  <CheckSquare size={13} />
                  <span>Action Items</span>
                </button>
                <button
                  type="button"
                  className="ai-pill"
                  disabled={aiPanel.loading}
                  onClick={() =>
                    triggerAIAction(
                      'tone_professional',
                      aiPanel.targetText,
                      aiPanel.hasSelection
                    )
                  }
                >
                  <Briefcase size={13} />
                  <span>Professional Tone</span>
                </button>
                <button
                  type="button"
                  className="ai-pill"
                  disabled={aiPanel.loading}
                  onClick={() =>
                    triggerAIAction(
                      'continue_writing',
                      aiPanel.targetText,
                      aiPanel.hasSelection
                    )
                  }
                >
                  <Sparkles size={13} />
                  <span>Continue Writing</span>
                </button>
                <button
                  type="button"
                  className="ai-pill"
                  disabled={aiPanel.loading}
                  onClick={() =>
                    triggerAIAction(
                      'pros_cons',
                      aiPanel.targetText,
                      aiPanel.hasSelection
                    )
                  }
                >
                  <Scale size={13} />
                  <span>Pros & Cons</span>
                </button>
                <button
                  type="button"
                  className="ai-pill"
                  disabled={aiPanel.loading}
                  onClick={() =>
                    triggerAIAction(
                      'study_flashcards',
                      aiPanel.targetText,
                      aiPanel.hasSelection
                    )
                  }
                >
                  <BookOpen size={13} />
                  <span>Study Flashcards</span>
                </button>
                <button
                  type="button"
                  className="ai-pill"
                  disabled={aiPanel.loading}
                  onClick={() =>
                    triggerAIAction(
                      'explain_simply',
                      aiPanel.targetText,
                      aiPanel.hasSelection
                    )
                  }
                >
                  <Lightbulb size={13} />
                  <span>Explain Simply</span>
                </button>
                <button
                  type="button"
                  className="ai-pill"
                  disabled={aiPanel.loading}
                  onClick={() =>
                    triggerAIAction(
                      'translate',
                      aiPanel.targetText,
                      aiPanel.hasSelection,
                      'Spanish'
                    )
                  }
                >
                  <Languages size={13} />
                  <span>Translate (ES)</span>
                </button>
              </div>

              {/* Custom Instruction Input */}
              <form
                className="ai-custom-prompt-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!aiPanel.customPrompt.trim()) return;
                  triggerAIAction(
                    'custom',
                    aiPanel.targetText,
                    aiPanel.hasSelection,
                    aiPanel.customPrompt
                  );
                }}
              >
                <input
                  type="text"
                  placeholder="Ask Gemini anything (e.g. 'Turn this into an email', 'Translate to Spanish', 'Create pros & cons')..."
                  value={aiPanel.customPrompt}
                  onChange={(e) =>
                    setAiPanel((prev) => ({
                      ...prev,
                      customPrompt: e.target.value,
                    }))
                  }
                />
                <button
                  type="submit"
                  className="ai-send-btn"
                  disabled={aiPanel.loading || !aiPanel.customPrompt.trim()}
                >
                  {aiPanel.loading ? (
                    <Loader2 size={14} className="spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </form>

              {/* Loading State */}
              {aiPanel.loading && (
                <div className="ai-loading-box">
                  <Loader2 size={16} className="spin accent-icon" />
                  <span>Gemini is thinking...</span>
                </div>
              )}

              {/* Error State */}
              {aiPanel.error && (
                <div className="ai-error-box">
                  <span>{aiPanel.error}</span>
                  <div className="ai-error-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={onOpenLogs}
                    >
                      <Terminal size={13} />
                      <span>View Logs & Error Code</span>
                    </button>
                    {aiPanel.error.toLowerCase().includes('api key') && (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={onOpenSettings}
                      >
                        Configure API Key
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Generated Result Preview & Actions */}
              {!aiPanel.loading && aiPanel.resultMarkdown && (
                <div className="ai-result-container">
                  <div
                    className="ai-result-preview"
                    dangerouslySetInnerHTML={{
                      __html: markdownToHtml(aiPanel.resultMarkdown),
                    }}
                  />
                  <div className="ai-result-actions">
                    {aiPanel.hasSelection && (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={handleReplaceSelection}
                      >
                        <Replace size={14} />
                        <span>Replace Selection</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={
                        aiPanel.hasSelection ? 'secondary-btn' : 'primary-btn'
                      }
                      onClick={handleInsertBelow}
                    >
                      <ArrowDownLeft size={14} />
                      <span>
                        {aiPanel.hasSelection
                          ? 'Insert Below Selection'
                          : 'Insert into Note'}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={handleCopyResult}
                    >
                      {copiedFeedback ? (
                        <>
                          <Check size={14} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() =>
                        triggerAIAction(
                          aiPanel.lastAction,
                          aiPanel.targetText,
                          aiPanel.hasSelection,
                          aiPanel.customPrompt
                        )
                      }
                    >
                      <RefreshCw size={14} />
                      <span>Retry</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Rich ContentEditable Surface */}
          <div
            ref={editorRef}
            className="rich-editor-surface"
            contentEditable
            suppressContentEditableWarning
            onInput={handleEditorInput}
            onKeyDown={handleEditorKeyDown}
            onMouseUp={handleMouseUpOrKeyUp}
            onKeyUp={handleMouseUpOrKeyUp}
            data-placeholder="Start writing, or type '/' for Gemini AI & formatting commands..."
          />
        </div>
      </div>

      {/* Floating Selection Bubble Menu */}
      {selectionMenu.visible && (
        <div
          className="floating-selection-toolbar"
          style={{
            left: `${selectionMenu.x}px`,
            top: `${selectionMenu.y}px`,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="bubble-ai-btn primary"
            onClick={() =>
              triggerAIAction('rewrite', selectionMenu.selectedText, true)
            }
          >
            <Sparkles size={13} />
            <span>Improve</span>
          </button>
          <button
            type="button"
            className="bubble-ai-btn"
            onClick={() =>
              triggerAIAction('summarize', selectionMenu.selectedText, true)
            }
          >
            <span>Summarize</span>
          </button>
          <button
            type="button"
            className="bubble-ai-btn"
            onClick={() =>
              triggerAIAction('fix_grammar', selectionMenu.selectedText, true)
            }
          >
            <span>Fix Grammar</span>
          </button>
          <button
            type="button"
            className="bubble-ai-btn"
            onClick={() =>
              triggerAIAction('expand', selectionMenu.selectedText, true)
            }
          >
            <span>Expand</span>
          </button>
          <button
            type="button"
            className="bubble-ai-btn"
            onClick={() => {
              setSelectionMenu((prev) => ({ ...prev, visible: false }));
              setAiPanel({
                open: true,
                targetText: selectionMenu.selectedText,
                hasSelection: true,
                loading: false,
                resultMarkdown: '',
                error: null,
                lastAction: 'custom',
                customPrompt: '',
              });
            }}
          >
            <span>Ask AI...</span>
          </button>
          <div className="bubble-sep" />
          <button
            type="button"
            className="bubble-icon-btn"
            onClick={() => execFormat('bold')}
            title="Bold"
          >
            <Bold size={13} />
          </button>
          <button
            type="button"
            className="bubble-icon-btn"
            onClick={() => execFormat('italic')}
            title="Italic"
          >
            <Italic size={13} />
          </button>
        </div>
      )}

      {/* Floating Slash Command Menu */}
      {slashMenu.open && filteredSlashCommands.length > 0 && (
        <div
          className="slash-command-menu"
          style={{
            left: `${slashMenu.x}px`,
            top: `${slashMenu.y}px`,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="slash-menu-header">
            COMMAND PALETTE {slashMenu.query ? `(/${slashMenu.query})` : ''}
          </div>
          {filteredSlashCommands.map((cmd, idx) => (
            <button
              key={cmd.id}
              type="button"
              className={`slash-menu-item ${
                idx === slashMenu.selectedIndex ? 'selected' : ''
              }`}
              onMouseEnter={() =>
                setSlashMenu((prev) => ({ ...prev, selectedIndex: idx }))
              }
              onClick={() => executeSlashCommand(cmd)}
            >
              <div className="slash-item-icon">{cmd.icon}</div>
              <div className="slash-item-text">
                <span className="slash-item-label">{cmd.label}</span>
                <span className="slash-item-desc">{cmd.description}</span>
              </div>
              {cmd.category === 'ai' && <span className="ai-badge">AI</span>}
            </button>
          ))}
        </div>
      )}
    </main>
  );
};
