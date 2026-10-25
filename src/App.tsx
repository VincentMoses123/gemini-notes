import React, { useEffect, useState, useCallback } from 'react';
import { FilePlus, LayoutTemplate, Sparkles } from 'lucide-react';
import { AccentTheme, AppSettings, LogEntry, Note } from './types';
import {
  DEFAULT_FOLDERS,
  DEFAULT_SETTINGS,
  loadNotesFromStorage,
  loadSettingsFromStorage,
  saveNotesToStorage,
  saveSettingsToStorage,
} from './services/storage';
import { initLogger, logEvent, subscribeToLogs } from './services/logger';
import { FilterView, Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { SettingsModal } from './components/SettingsModal';
import { ChatSidebar } from './components/ChatSidebar';
import { TemplatesModal } from './components/TemplatesModal';
import { LogsModal } from './components/LogsModal';
import { CommandPalette } from './components/CommandPalette';

export const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [filterView, setFilterView] = useState<FilterView>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
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
      const [loadedNotes, loadedSettings] = await Promise.all([
        loadNotesFromStorage(),
        loadSettingsFromStorage(),
        initLogger(),
      ]);
      setNotes(loadedNotes);
      setSettings(loadedSettings);
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

  // Save notes whenever they change
  useEffect(() => {
    if (!initialized) return;
    saveNotesToStorage(notes);
  }, [notes, initialized]);

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

  // Global keyboard shortcuts (Cmd+N, Cmd+K, Cmd+J, Cmd+L, Cmd+\, Cmd+,)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateNote();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
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
  }, [handleCreateNote]);

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
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
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
          onUpdateNote={handleUpdateActiveNote}
          onTrashNote={handleTrashNote}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenLogs={() => setLogsOpen(true)}
          onToggleChat={() => setChatOpen((prev) => !prev)}
          onToggleFocusMode={() => setFocusMode((prev) => !prev)}
          onSelectAccent={handleSelectAccent}
          onToggleLayoutMode={handleToggleLayoutMode}
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
          settings={settings}
          onClose={() => setChatOpen(false)}
          onSelectNote={(id) => setActiveNoteId(id)}
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
          onToggleChat={() => setChatOpen((prev) => !prev)}
          onOpenLogs={() => setLogsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleFocusMode={() => setFocusMode((prev) => !prev)}
          onToggleTheme={handleToggleTheme}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
};
