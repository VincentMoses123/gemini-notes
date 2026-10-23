import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Star,
  Trash2,
  Settings,
  Sparkles,
  Tag,
  Sun,
  Moon,
  RotateCcw,
  Folder,
  LayoutTemplate,
  FolderPlus,
  Terminal,
  Command,
} from 'lucide-react';
import { Note } from '../types';

export type FilterView = 'all' | 'pinned' | 'trash';

interface SidebarProps {
  notes: Note[];
  folders: string[];
  activeNoteId: string | null;
  filterView: FilterView;
  selectedFolder: string | null;
  selectedTag: string | null;
  searchQuery: string;
  hasApiKey: boolean;
  errorCount: number;
  theme: 'dark' | 'light';
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onOpenTemplates: () => void;
  onChangeFilter: (view: FilterView) => void;
  onSelectFolder: (folder: string | null) => void;
  onAddFolder: (folderName: string) => void;
  onSelectTag: (tag: string | null) => void;
  onSearchChange: (q: string) => void;
  onOpenSettings: () => void;
  onOpenLogs: () => void;
  onOpenCommandPalette: () => void;
  onToggleTheme: () => void;
  onRestoreNote: (id: string, e: React.MouseEvent) => void;
  onDeletePermanently: (id: string, e: React.MouseEvent) => void;
}

function stripHtmlPreview(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const text = tmp.textContent || tmp.innerText || '';
  return text.replace(/\s+/g, ' ').trim() || 'Empty note...';
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  folders,
  activeNoteId,
  filterView,
  selectedFolder,
  selectedTag,
  searchQuery,
  hasApiKey,
  errorCount,
  theme,
  onSelectNote,
  onCreateNote,
  onOpenTemplates,
  onChangeFilter,
  onSelectFolder,
  onAddFolder,
  onSelectTag,
  onSearchChange,
  onOpenSettings,
  onOpenLogs,
  onOpenCommandPalette,
  onToggleTheme,
  onRestoreNote,
  onDeletePermanently,
}) => {
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const allTags = Array.from(
    new Set(
      notes
        .filter((n) => !n.trashed)
        .flatMap((n) => n.tags)
        .filter(Boolean)
    )
  ).sort();

  const filteredNotes = notes
    .filter((note) => {
      if (filterView === 'trash') {
        if (!note.trashed) return false;
      } else {
        if (note.trashed) return false;
        if (filterView === 'pinned' && !note.pinned) return false;
        if (selectedFolder && (note.folder || 'General') !== selectedFolder) {
          return false;
        }
        if (selectedTag && !note.tags.includes(selectedTag)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const plain = stripHtmlPreview(note.content).toLowerCase();
        const matchesTitle = note.title.toLowerCase().includes(q);
        const matchesTag = note.tags.some((t) => t.toLowerCase().includes(q));
        const matchesFolder = (note.folder || '')
          .toLowerCase()
          .includes(q);
        return matchesTitle || plain.includes(q) || matchesTag || matchesFolder;
      }

      return true;
    })
    .sort((a, b) => {
      if (filterView === 'all' && a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const activeCount = notes.filter((n) => !n.trashed).length;
  const pinnedCount = notes.filter((n) => !n.trashed && n.pinned).length;
  const trashCount = notes.filter((n) => n.trashed).length;

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newFolderName.trim();
    if (cleaned) {
      onAddFolder(cleaned);
      onSelectFolder(cleaned);
      onChangeFilter('all');
    }
    setNewFolderName('');
    setAddingFolder(false);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-titlebar-drag">
        <div className="app-brand">
          <div className="brand-icon">
            <Sparkles size={15} />
          </div>
          <span>Gemini Notes</span>
        </div>
        <div className="sidebar-top-btns no-drag">
          <button
            className="template-top-btn"
            onClick={onOpenTemplates}
            title="New Note from Template"
          >
            <LayoutTemplate size={14} />
          </button>
          <button
            className="new-note-btn"
            onClick={onCreateNote}
            title="New Note (⌘N)"
          >
            <Plus size={15} />
            <span>New</span>
          </button>
        </div>
      </div>

      <div className="sidebar-search">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Search notes, folders, #tags..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button
          type="button"
          className="cmd-k-trigger-btn"
          onClick={onOpenCommandPalette}
          title="Open Command Palette (⌘K)"
        >
          <Command size={11} />
          <span>K</span>
        </button>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${
            filterView === 'all' && !selectedTag && !selectedFolder
              ? 'active'
              : ''
          }`}
          onClick={() => {
            onChangeFilter('all');
            onSelectTag(null);
            onSelectFolder(null);
          }}
        >
          <FileText size={15} />
          <span>All Notes</span>
          <span className="nav-badge">{activeCount}</span>
        </button>

        <button
          className={`nav-item ${filterView === 'pinned' ? 'active' : ''}`}
          onClick={() => {
            onChangeFilter('pinned');
            onSelectTag(null);
            onSelectFolder(null);
          }}
        >
          <Star size={15} />
          <span>Favorites</span>
          {pinnedCount > 0 && <span className="nav-badge">{pinnedCount}</span>}
        </button>

        <button
          className={`nav-item ${filterView === 'trash' ? 'active' : ''}`}
          onClick={() => {
            onChangeFilter('trash');
            onSelectTag(null);
            onSelectFolder(null);
          }}
        >
          <Trash2 size={15} />
          <span>Trash</span>
          {trashCount > 0 && <span className="nav-badge">{trashCount}</span>}
        </button>
      </nav>

      {/* Notebooks / Folders Section */}
      <div className="sidebar-folders-section">
        <div className="section-label-row">
          <span className="section-label">NOTEBOOKS</span>
          <button
            type="button"
            className="icon-mini-btn"
            onClick={() => setAddingFolder(!addingFolder)}
            title="New Notebook Folder"
          >
            <FolderPlus size={13} />
          </button>
        </div>

        {addingFolder && (
          <form className="new-folder-form" onSubmit={handleCreateFolderSubmit}>
            <input
              type="text"
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
              onBlur={() => setAddingFolder(false)}
            />
          </form>
        )}

        <div className="folders-list">
          {folders.map((folder) => {
            const count = notes.filter(
              (n) => !n.trashed && (n.folder || 'General') === folder
            ).length;
            return (
              <button
                key={folder}
                type="button"
                className={`folder-nav-item ${
                  selectedFolder === folder && filterView !== 'trash'
                    ? 'active'
                    : ''
                }`}
                onClick={() => {
                  onChangeFilter('all');
                  onSelectFolder(selectedFolder === folder ? null : folder);
                }}
              >
                <Folder size={13} />
                <span>{folder}</span>
                {count > 0 && <span className="nav-badge">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="sidebar-tags-section">
          <div className="section-label">TAGS</div>
          <div className="sidebar-tags-list">
            {allTags.map((tag) => (
              <button
                key={tag}
                className={`tag-filter-chip ${
                  selectedTag === tag ? 'active' : ''
                }`}
                onClick={() => {
                  onChangeFilter('all');
                  onSelectTag(selectedTag === tag ? null : tag);
                }}
              >
                <Tag size={11} />
                <span>{tag}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="notes-list-header">
        <span>
          {filterView === 'trash'
            ? 'TRASHED NOTES'
            : selectedFolder
            ? `📁 ${selectedFolder.toUpperCase()}`
            : selectedTag
            ? `#${selectedTag.toUpperCase()}`
            : filterView === 'pinned'
            ? 'FAVORITES'
            : 'NOTES'}
        </span>
        <span className="notes-count">{filteredNotes.length}</span>
      </div>

      <div className="notes-list">
        {filteredNotes.length === 0 ? (
          <div className="empty-notes-list">
            <p>No notes found</p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`note-card ${
                note.id === activeNoteId ? 'active' : ''
              }`}
              onClick={() => onSelectNote(note.id)}
            >
              <div className="note-card-top">
                <span className="note-card-title">
                  {note.title.trim() || 'Untitled Note'}
                </span>
                {note.pinned && !note.trashed && (
                  <Star size={12} className="pinned-star" fill="currentColor" />
                )}
              </div>
              <p className="note-card-preview">
                {stripHtmlPreview(note.content)}
              </p>
              <div className="note-card-footer">
                <span className="note-card-date">
                  {formatRelativeDate(note.updatedAt)} •{' '}
                  {note.folder || 'General'}
                </span>
                {note.trashed ? (
                  <div className="trash-item-actions">
                    <button
                      className="icon-mini-btn"
                      title="Restore Note"
                      onClick={(e) => onRestoreNote(note.id, e)}
                    >
                      <RotateCcw size={12} />
                    </button>
                    <button
                      className="icon-mini-btn danger"
                      title="Delete Permanently"
                      onClick={(e) => onDeletePermanently(note.id, e)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  note.tags.length > 0 && (
                    <div className="note-card-tags">
                      {note.tags.slice(0, 2).map((t) => (
                        <span key={t} className="mini-tag">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <button className="footer-settings-btn" onClick={onOpenSettings}>
          <Settings size={15} />
          <span>Settings</span>
          <span
            className={`api-status-dot ${hasApiKey ? 'connected' : 'missing'}`}
            title={hasApiKey ? 'Gemini API Key Configured' : 'API Key Needed'}
          />
        </button>
        <button
          className={`footer-logs-btn ${errorCount > 0 ? 'has-errors' : ''}`}
          onClick={onOpenLogs}
          title="Diagnostics, Activity Logs & Error Codes (⌘L)"
        >
          <Terminal size={14} />
          <span>Logs</span>
          {errorCount > 0 && (
            <span className="logs-error-badge">{errorCount}</span>
          )}
        </button>
        <button
          className="footer-theme-btn"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </aside>
  );
};
