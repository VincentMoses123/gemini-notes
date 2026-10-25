import React, { useState } from 'react';
import {
  FileText,
  Search,
  Star,
  Trash2,
  Settings,
  Sun,
  Moon,
  RotateCcw,
  Folder,
  LayoutTemplate,
  FolderPlus,
  Terminal,
  Command,
  SquarePen,
  PanelLeftClose,
  Columns,
  Hash,
} from 'lucide-react';
import { AccentTheme, LayoutMode, Note } from '../types';
import { formatShortNoteTime, getNoteDateBucket } from '../services/storage';

export type FilterView = 'all' | 'pinned' | 'trash';

export const ACCENT_SWATCHES: {
  id: AccentTheme;
  label: string;
  color: string;
}[] = [
  { id: 'sapphire', label: 'Ocean Sapphire', color: '#0a84ff' },
  { id: 'emerald', label: 'Emerald Studio', color: '#10b981' },
  { id: 'copper', label: 'Warm Copper', color: '#f59e0b' },
  { id: 'indigo', label: 'Royal Indigo', color: '#6366f1' },
  { id: 'slate', label: 'Graphite Slate', color: '#38bdf8' },
];

const CHRONO_BUCKETS: Array<
  'Today' | 'Yesterday' | 'Previous 7 Days' | 'Previous 30 Days' | 'Earlier'
> = ['Today', 'Yesterday', 'Previous 7 Days', 'Previous 30 Days', 'Earlier'];

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
  accentTheme: AccentTheme;
  layoutMode: LayoutMode;
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
  onSelectAccent: (accent: AccentTheme) => void;
  onToggleLayoutMode: () => void;
  onRestoreNote: (id: string, e: React.MouseEvent) => void;
  onDeletePermanently: (id: string, e: React.MouseEvent) => void;
}

function stripHtmlPreview(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const text = tmp.textContent || tmp.innerText || '';
  return text.replace(/\s+/g, ' ').trim() || 'No additional text';
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
  accentTheme,
  layoutMode,
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
  onSelectAccent,
  onToggleLayoutMode,
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

  const currentViewTitle =
    filterView === 'trash'
      ? 'Recently Deleted'
      : selectedFolder
      ? selectedFolder
      : selectedTag
      ? `#${selectedTag}`
      : filterView === 'pinned'
      ? 'Pinned'
      : 'All Notes';

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

  // Group notes into Pinned (when in 'all' view) + Chronological Buckets
  const showSeparatePinnedGroup = filterView === 'all';
  const pinnedGroupNotes = showSeparatePinnedGroup
    ? filteredNotes.filter((n) => n.pinned && !n.trashed)
    : [];
  const chronologicalSourceNotes = showSeparatePinnedGroup
    ? filteredNotes.filter((n) => !n.pinned || n.trashed)
    : filteredNotes;

  const groupedByBucket = CHRONO_BUCKETS.map((bucket) => ({
    bucket,
    items: chronologicalSourceNotes.filter(
      (n) => getNoteDateBucket(n.updatedAt) === bucket
    ),
  })).filter((g) => g.items.length > 0);

  const renderNoteRow = (note: Note) => {
    const isSelected = note.id === activeNoteId;
    return (
      <div
        key={note.id}
        className={`apple-note-row note-card ${isSelected ? 'active' : ''}`}
        onClick={() => onSelectNote(note.id)}
      >
        <div className="apple-note-row-top">
          <span className="apple-note-title">
            {note.title.trim() || 'New Note'}
          </span>
          {note.pinned && !note.trashed && (
            <Star size={11} className="pinned-star" fill="currentColor" />
          )}
        </div>

        <div className="apple-note-row-second">
          <span className="apple-note-time">
            {formatShortNoteTime(note.updatedAt)}
          </span>
          <span className="apple-note-snippet">
            {stripHtmlPreview(note.content)}
          </span>
        </div>

        <div className="apple-note-row-meta">
          <span className="apple-note-folder">
            <Folder size={10} />
            <span>{note.folder || 'General'}</span>
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
    );
  };

  const renderGroupedNoteList = () => {
    if (filteredNotes.length === 0) {
      return (
        <div className="empty-notes-list">
          <p>No notes in {currentViewTitle}</p>
        </div>
      );
    }

    return (
      <>
        {pinnedGroupNotes.length > 0 && (
          <div className="apple-note-group">
            <div className="apple-note-group-header">PINNED</div>
            <div className="apple-note-group-items">
              {pinnedGroupNotes.map(renderNoteRow)}
            </div>
          </div>
        )}
        {groupedByBucket.map(({ bucket, items }) => (
          <div key={bucket} className="apple-note-group">
            <div className="apple-note-group-header">
              {bucket.toUpperCase()}
            </div>
            <div className="apple-note-group-items">
              {items.map(renderNoteRow)}
            </div>
          </div>
        ))}
      </>
    );
  };

  const renderFooterWithSwatches = () => (
    <div className="apple-sidebar-footer">
      <div className="theme-swatch-bar">
        <span className="swatch-bar-label">ACCENT</span>
        <div className="swatch-dots">
          {ACCENT_SWATCHES.map((sw) => (
            <button
              key={sw.id}
              type="button"
              className={`theme-swatch-dot ${
                accentTheme === sw.id ? 'active' : ''
              }`}
              style={{ backgroundColor: sw.color }}
              onClick={() => onSelectAccent(sw.id)}
              title={`Theme: ${sw.label}`}
            />
          ))}
        </div>
      </div>

      <div className="sidebar-footer-actions">
        <button
          className="footer-settings-btn"
          onClick={onOpenSettings}
          title="Settings & Palette (⌘,)"
        >
          <Settings size={14} />
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
          <Terminal size={13} />
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
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </div>
  );

  // ==================== TWO-COLUMN COMPACT MODE ====================
  if (layoutMode === 'two-column') {
    return (
      <aside className="apple-navigation-shell two-column-mode">
        <div className="apple-notelist-pane compact-single-pane">
          <div className="notelist-topbar compact-traffic-clearance">
            <div className="notelist-title-wrap no-drag">
              <button
                type="button"
                className="icon-btn"
                onClick={onToggleLayoutMode}
                title="Expand Folders Sidebar (3-Column Apple Notes View)"
              >
                <Columns size={15} />
              </button>
              <select
                className="compact-folder-switcher"
                value={
                  filterView === 'trash'
                    ? '__trash__'
                    : filterView === 'pinned'
                    ? '__pinned__'
                    : selectedFolder || '__all__'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  onSelectTag(null);
                  if (val === '__all__') {
                    onChangeFilter('all');
                    onSelectFolder(null);
                  } else if (val === '__pinned__') {
                    onChangeFilter('pinned');
                    onSelectFolder(null);
                  } else if (val === '__trash__') {
                    onChangeFilter('trash');
                    onSelectFolder(null);
                  } else {
                    onChangeFilter('all');
                    onSelectFolder(val);
                  }
                }}
              >
                <option value="__all__">All Notes ({activeCount})</option>
                <option value="__pinned__">Pinned ({pinnedCount})</option>
                <optgroup label="Folders">
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </optgroup>
                <option value="__trash__">
                  Recently Deleted ({trashCount})
                </option>
              </select>
            </div>

            <div className="notelist-top-actions no-drag">
              <button
                type="button"
                className="apple-toolbar-icon-btn"
                onClick={onOpenTemplates}
                title="New Note from Template"
              >
                <LayoutTemplate size={15} />
              </button>
              <button
                type="button"
                className="apple-compose-btn"
                onClick={onCreateNote}
                title="New Note (⌘N)"
              >
                <SquarePen size={15} />
              </button>
            </div>
          </div>

          <div className="sidebar-search">
            <Search size={13} className="search-icon" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <button
              type="button"
              className="cmd-k-trigger-btn"
              onClick={onOpenCommandPalette}
              title="Open Command Palette (⌘K)"
            >
              <Command size={10} />
              <span>K</span>
            </button>
          </div>

          <div className="notes-list apple-grouped-scroll">
            {renderGroupedNoteList()}
          </div>

          {renderFooterWithSwatches()}
        </div>
      </aside>
    );
  }

  // ==================== THREE-COLUMN APPLE NOTES MODE (DEFAULT) ====================
  return (
    <aside className="apple-navigation-shell three-column-mode">
      {/* PANE 1: FOLDERS & SMART VIEWS */}
      <div className="apple-folders-pane">
        <div className="folders-pane-header">
          <span className="folders-pane-brand">Notes</span>
          <button
            type="button"
            className="icon-mini-btn no-drag"
            onClick={onToggleLayoutMode}
            title="Switch to Compact 2-Column Layout"
          >
            <PanelLeftClose size={14} />
          </button>
        </div>

        <div className="folders-pane-scroll">
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
              <FileText size={14} className="nav-item-icon" />
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
              <Star size={14} className="nav-item-icon" />
              <span>Pinned</span>
              {pinnedCount > 0 && (
                <span className="nav-badge">{pinnedCount}</span>
              )}
            </button>

            <button
              className={`nav-item ${filterView === 'trash' ? 'active' : ''}`}
              onClick={() => {
                onChangeFilter('trash');
                onSelectTag(null);
                onSelectFolder(null);
              }}
            >
              <Trash2 size={14} className="nav-item-icon" />
              <span>Recently Deleted</span>
              {trashCount > 0 && (
                <span className="nav-badge">{trashCount}</span>
              )}
            </button>
          </nav>

          {/* Folders Section */}
          <div className="sidebar-folders-section">
            <div className="section-label-row">
              <span className="section-label">FOLDERS</span>
              <button
                type="button"
                className="icon-mini-btn"
                onClick={() => setAddingFolder(!addingFolder)}
                title="New Folder"
              >
                <FolderPlus size={13} />
              </button>
            </div>

            {addingFolder && (
              <form
                className="new-folder-form"
                onSubmit={handleCreateFolderSubmit}
              >
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
                      onSelectTag(null);
                      onSelectFolder(selectedFolder === folder ? null : folder);
                    }}
                  >
                    <Folder size={14} className="nav-item-icon" />
                    <span>{folder}</span>
                    <span className="nav-badge">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags Section */}
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
                      onSelectFolder(null);
                      onSelectTag(selectedTag === tag ? null : tag);
                    }}
                  >
                    <Hash size={10} />
                    <span>{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {renderFooterWithSwatches()}
      </div>

      {/* PANE 2: APPLE NOTES LIST COLUMN */}
      <div className="apple-notelist-pane">
        <div className="notelist-topbar">
          <div className="notelist-header-title">
            <h3>{currentViewTitle}</h3>
            <span className="notelist-subtitle-count">
              {filteredNotes.length}{' '}
              {filteredNotes.length === 1 ? 'note' : 'notes'}
            </span>
          </div>

          <div className="notelist-top-actions no-drag">
            <button
              type="button"
              className="apple-toolbar-icon-btn"
              onClick={onOpenTemplates}
              title="New Note from Template"
            >
              <LayoutTemplate size={15} />
            </button>
            <button
              type="button"
              className="apple-compose-btn"
              onClick={onCreateNote}
              title="New Note (⌘N)"
            >
              <SquarePen size={15} />
            </button>
          </div>
        </div>

        <div className="sidebar-search">
          <Search size={13} className="search-icon" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <button
            type="button"
            className="cmd-k-trigger-btn"
            onClick={onOpenCommandPalette}
            title="Open Command Palette (⌘K)"
          >
            <Command size={10} />
            <span>K</span>
          </button>
        </div>

        <div className="notes-list apple-grouped-scroll">
          {renderGroupedNoteList()}
        </div>
      </div>
    </aside>
  );
};
