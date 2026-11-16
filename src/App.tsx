import React, { useEffect, useState, useCallback } from 'react';
import { FilePlus, LayoutTemplate, Sparkles } from 'lucide-react';
import { AccentTheme, AppSettings, KnowledgeDocument, LogEntry, Note, ThemeMode } from './types';
import {
  DEFAULT_FOLDERS,
  DEFAULT_SETTINGS,
  loadKnowledgeDocsFromStorage,
  loadNotesFromStorage,
  loadSettingsFromStorage,
  saveKnowledgeDocsToStorage,
  saveNotesToStorage,
  saveSettingsToStorage,
} from './services/storage';
import { initLogger, logEvent, subscribeToLogs } from './services/logger';
import { markdownToHtml } from './services/gemini';
import { sanitizeHtml } from './services/sanitizer';
import { CURRENT_APP_VERSION, getLatestRelease } from './services/changelog';
import { FilterView, Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { SettingsModal } from './components/SettingsModal';
import { ChatSidebar } from './components/ChatSidebar';
import { TemplatesModal } from './components/TemplatesModal';
import { LogsModal } from './components/LogsModal';
import { CommandPalette } from './components/CommandPalette';
import { KnowledgeBaseModal } from './components/KnowledgeBaseModal';
import { WhatsNewModal } from './components/WhatsNewModal';

export const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [filterView, setFilterView] = useState<FilterView>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Load initial data & initialize logger
  useEffect(() => {
    const unsubscribe = subscribeToLogs(setLogs);
    async function init() {
      const [loadedNotes, loadedSettings, loadedDocs] = await Promise.all([
        loadNotesFromStorage(),
        loadSettingsFromStorage(),
        loadKnowledgeDocsFromStorage(),
        initLogger(),
      ]);
      setNotes(loadedNotes);
      if (loadedSettings.lastSeenVersion !== CURRENT_APP_VERSION) {
        const updatedSettings: AppSettings = {
          ...loadedSettings,
          lastSeenVersion: CURRENT_APP_VERSION,
        };
        setSettings(updatedSettings);
        saveSettingsToStorage(updatedSettings);
        setWhatsNewOpen(true);
      } else {
        setSettings(loadedSettings);
      }
      setKnowledgeDocs(loadedDocs);
      const firstActive = loadedNotes.find((n) => !n.trashed);
      if (firstActive) {
        setActiveNoteId(firstActive.id);
      }
      setInitialized(true);
    }
    init();
    return unsubscribe;
  }, []);

  // Apply theme and accent attributes to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
    document.documentElement.setAttribute(
      'data-accent',
      settings.accentTheme || 'sapphire'
    );
  }, [settings.theme, settings.accentTheme]);

  // Save notes & knowledge base documents whenever they change
  useEffect(() => {
    if (!initialized) return;
    saveNotesToStorage(notes);
  }, [notes, initialized]);

  useEffect(() => {
    if (!initialized) return;
    saveKnowledgeDocsToStorage(knowledgeDocs);
  }, [knowledgeDocs, initialized]);

  const handleCreateNote = useCallback(() => {
    const now = new Date().toISOString();
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: 'Untitled Note',
      content: '<p><br></p>',
      folder: selectedFolder || 'General',
      tags: selectedTag ? [selectedTag] : [],
      pinned: filterView === 'pinned',
      trashed: false,
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    };

    if (filterView === 'trash') {
      setFilterView('all');
    }

    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    logEvent({
      level: 'info',
      source: 'editor',
      message: `Created new note in folder "${newNote.folder}"`,
    });
  }, [filterView, selectedFolder, selectedTag]);

  const handleCreateFromTemplate = useCallback(
    (tpl: {
      title: string;
      content: string;
      folder: string;
      tags: string[];
    }) => {
      const now = new Date().toISOString();
      const newNote: Note = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: tpl.title,
        content: tpl.content,
        folder: tpl.folder || selectedFolder || 'General',
        tags: tpl.tags,
        pinned: false,
        trashed: false,
        snapshots: [],
        createdAt: now,
        updatedAt: now,
      };
      if (filterView === 'trash') {
        setFilterView('all');
      }
      setNotes((prev) => [newNote, ...prev]);
      setActiveNoteId(newNote.id);
      logEvent({
        level: 'info',
        source: 'editor',
        message: `Created note from template: "${tpl.title}"`,
      });
    },
    [filterView, selectedFolder]
  );

  const handleExportNotePdf = useCallback(
    async (overrideSettings?: Partial<AppSettings>) => {
      const targetNote = notes.find((n) => n.id === activeNoteId) || null;
      if (!targetNote) return;

      const effectiveSettings = overrideSettings
        ? { ...settings, ...overrideSettings }
        : settings;

      if (window.electronAPI?.exportPdf) {
        const res = await window.electronAPI.exportPdf({
          title: targetNote.title || 'Untitled Note',
          html: targetNote.content,
          pageSize: effectiveSettings.pdfPageSize || 'Letter',
          includeMetadata:
            effectiveSettings.pdfIncludeMetadata !== undefined
              ? effectiveSettings.pdfIncludeMetadata
              : true,
          folder: targetNote.folder,
          tags: targetNote.tags,
          updatedAt: targetNote.updatedAt,
          theme: effectiveSettings.theme,
        });
        if (res.ok) {
          logEvent({
            level: 'info',
            source: 'system',
            message: `Exported "${targetNote.title || 'Untitled Note'}" as PDF (${
              effectiveSettings.pdfPageSize || 'Letter'
            })`,
          });
        } else if (!res.canceled && res.error) {
          logEvent({
            level: 'error',
            source: 'system',
            code: 'GN-FS-001',
            message: `PDF export failed: ${res.error}`,
          });
        }
      } else {
        window.print();
      }
    },
    [notes, activeNoteId, settings]
  );

  // Global keyboard shortcuts (Cmd+N, Cmd+K, Cmd+Shift+K, Cmd+J, Cmd+L, Cmd+\, Cmd+,, Cmd+Shift+E)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExportNotePdf();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setKbOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateNote();
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLogsOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setChatOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setFocusMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCreateNote, handleExportNotePdf]);

  const handleUpdateActiveNote = useCallback(
    (updatedFields: Partial<Note>) => {
      if (!activeNoteId) return;
      const now = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) =>
          n.id === activeNoteId
            ? { ...n, ...updatedFields, updatedAt: now }
            : n
        )
      );
    },
    [activeNoteId]
  );

  const handleTrashNote = (id: string) => {
    setNotes((prev) => {
      const updated = prev.map((n) =>
        n.id === id
          ? {
              ...n,
              trashed: true,
              pinned: false,
              updatedAt: new Date().toISOString(),
            }
          : n
      );
      if (activeNoteId === id) {
        const nextNote = updated.find((n) => !n.trashed && n.id !== id);
        setActiveNoteId(nextNote ? nextNote.id : null);
      }
      return updated;
    });
    logEvent({
      level: 'info',
      source: 'storage',
      message: `Moved note (${id}) to Trash`,
    });
  };

  const handleRestoreNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, trashed: false, updatedAt: new Date().toISOString() }
          : n
      )
    );
  };

  const handleDeletePermanently = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes((prev) => {
      const remaining = prev.filter((n) => n.id !== id);
      if (activeNoteId === id) {
        const nextInTrash = remaining.find((n) => n.trashed);
        setActiveNoteId(nextInTrash ? nextInTrash.id : null);
      }
      return remaining;
    });
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettingsToStorage(newSettings);
    logEvent({
      level: 'info',
      source: 'system',
      message: `Saved Gemini Settings (model: ${newSettings.model}, accent: ${
        newSettings.accentTheme || 'sapphire'
      })`,
    });
  };

  const handleAddFolder = (folderName: string) => {
    const currentFolders = settings.folders || DEFAULT_FOLDERS;
    if (!currentFolders.includes(folderName)) {
      const updated = {
        ...settings,
        folders: [...currentFolders, folderName],
      };
      handleSaveSettings(updated);
    }
  };

  const handleToggleTheme = () => {
    const order: ThemeMode[] = ['dark', 'midnight', 'light', 'sepia'];
    const currentIndex = order.indexOf(settings.theme);
    const nextTheme = order[(currentIndex + 1) % order.length];
    handleSaveSettings({ ...settings, theme: nextTheme });
  };

  const handleSelectAccent = (accent: AccentTheme) => {
    handleSaveSettings({ ...settings, accentTheme: accent });
  };

  const handleToggleLayoutMode = () => {
    const nextMode =
      (settings.layoutMode || 'three-column') === 'three-column'
        ? 'two-column'
        : 'three-column';
    handleSaveSettings({ ...settings, layoutMode: nextMode });
  };

  const activeNote = notes.find((n) => n.id === activeNoteId) || null;
  const folders = settings.folders || DEFAULT_FOLDERS;
  const errorCount = logs.filter((l) => l.level === 'error').length;
  const currentAccent = settings.accentTheme || 'sapphire';
  const currentLayout = settings.layoutMode || 'three-column';

  return (
    <div className="app-shell">
      {!focusMode && (
        <Sidebar
          notes={notes}
          folders={folders}
          activeNoteId={activeNoteId}
          filterView={filterView}
          selectedFolder={selectedFolder}
          selectedTag={selectedTag}
          searchQuery={searchQuery}
          hasApiKey={Boolean(settings.apiKey?.trim())}
          errorCount={errorCount}
          knowledgeCount={knowledgeDocs.filter((d) => d.enabled).length}
          theme={settings.theme}
          accentTheme={currentAccent}
          layoutMode={currentLayout}
          onSelectNote={setActiveNoteId}
          onCreateNote={handleCreateNote}
          onOpenTemplates={() => setTemplatesOpen(true)}
          onChangeFilter={setFilterView}
          onSelectFolder={setSelectedFolder}
          onAddFolder={handleAddFolder}
          onSelectTag={setSelectedTag}
          onSearchChange={setSearchQuery}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenLogs={() => setLogsOpen(true)}
          onOpenKnowledgeBase={() => setKbOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleTheme={handleToggleTheme}
          onSelectAccent={handleSelectAccent}
          onToggleLayoutMode={handleToggleLayoutMode}
          onRestoreNote={handleRestoreNote}
          onDeletePermanently={handleDeletePermanently}
        />
      )}

      {activeNote ? (
        <Editor
          note={activeNote}
          folders={folders}
          settings={settings}
          chatOpen={chatOpen}
          focusMode={focusMode}
          accentTheme={currentAccent}
          layoutMode={currentLayout}
          knowledgeDocs={knowledgeDocs}
          onUpdateNote={handleUpdateActiveNote}
          onTrashNote={handleTrashNote}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenLogs={() => setLogsOpen(true)}
          onOpenKnowledgeBase={() => setKbOpen(true)}
          onToggleChat={() => setChatOpen((prev) => !prev)}
          onToggleFocusMode={() => setFocusMode((prev) => !prev)}
          onSelectAccent={handleSelectAccent}
          onToggleLayoutMode={handleToggleLayoutMode}
          onExportPdf={() => handleExportNotePdf()}
        />
      ) : (
        <div className="empty-editor-state">
          <div className="empty-state-box">
            <Sparkles size={36} className="accent-icon" />
            <h2>No Note Selected</h2>
            <p>
              Select a note from the sidebar, create a blank note, or start from
              a template.
            </p>
            <div className="empty-state-actions">
              <button className="primary-btn" onClick={handleCreateNote}>
                <FilePlus size={16} />
                <span>Blank Note</span>
              </button>
              <button
                className="secondary-btn"
                onClick={() => setTemplatesOpen(true)}
              >
                <LayoutTemplate size={16} />
                <span>From Template</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {chatOpen && (
        <ChatSidebar
          notes={notes}
          knowledgeDocs={knowledgeDocs}
          settings={settings}
          onClose={() => setChatOpen(false)}
          onSelectNote={(id) => setActiveNoteId(id)}
          onOpenKnowledgeBase={() => setKbOpen(true)}
          onCreateNoteFromAnswer={(title, htmlContent) =>
            handleCreateFromTemplate({
              title,
              content: htmlContent,
              folder: selectedFolder || 'General',
              tags: ['ai-synthesis'],
            })
          }
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {kbOpen && (
        <KnowledgeBaseModal
          docs={knowledgeDocs}
          onUpdateDocs={setKnowledgeDocs}
          onCreateNoteFromDoc={(doc) =>
            handleCreateFromTemplate({
              title: doc.name.replace(/\.[^.]+$/, ''),
              content: sanitizeHtml(markdownToHtml(doc.content)),
              folder: selectedFolder || 'General',
              tags: ['reference', doc.fileType],
            })
          }
          onClose={() => setKbOpen(false)}
        />
      )}

      {templatesOpen && (
        <TemplatesModal
          settings={settings}
          onSelectTemplate={handleCreateFromTemplate}
          onClose={() => setTemplatesOpen(false)}
        />
      )}

      {logsOpen && (
        <LogsModal logs={logs} onClose={() => setLogsOpen(false)} />
      )}

      {commandPaletteOpen && (
        <CommandPalette
          notes={notes}
          onClose={() => setCommandPaletteOpen(false)}
          onSelectNote={(id) => setActiveNoteId(id)}
          onCreateNote={handleCreateNote}
          onOpenTemplates={() => setTemplatesOpen(true)}
          onOpenKnowledgeBase={() => setKbOpen(true)}
          onToggleChat={() => setChatOpen((prev) => !prev)}
          onOpenLogs={() => setLogsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleFocusMode={() => setFocusMode((prev) => !prev)}
          onToggleTheme={handleToggleTheme}
          onExportPdf={() => handleExportNotePdf()}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          activeNoteTitle={activeNote?.title}
          onExportActiveNotePdf={(updated) => handleExportNotePdf(updated)}
          onOpenWhatsNew={() => {
            setSettingsOpen(false);
            setWhatsNewOpen(true);
          }}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {whatsNewOpen && (
        <WhatsNewModal
          release={getLatestRelease()}
          onClose={() => setWhatsNewOpen(false)}
          onOpenChangelogInSettings={() => {
            setWhatsNewOpen(false);
            setSettingsOpen(true);
          }}
        />
      )}
    </div>
  );
};
