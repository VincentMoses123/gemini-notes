import React, { useState, useEffect } from 'react';
import {
  Search,
  FileText,
  Plus,
  LayoutTemplate,
  MessageSquare,
  Terminal,
  Settings,
  Maximize2,
  Sun,
} from 'lucide-react';
import { Note } from '../types';

interface CommandPaletteProps {
  notes: Note[];
  onClose: () => void;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onOpenTemplates: () => void;
  onToggleChat: () => void;
  onOpenLogs: () => void;
  onOpenSettings: () => void;
  onToggleFocusMode: () => void;
  onToggleTheme: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  notes,
  onClose,
  onSelectNote,
  onCreateNote,
  onOpenTemplates,
  onToggleChat,
  onOpenLogs,
  onOpenSettings,
  onToggleFocusMode,
  onToggleTheme,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const activeNotes = notes.filter((n) => !n.trashed);

  const actions = [
    {
      id: 'act-new',
      label: 'Create New Blank Note',
      hint: '⌘N',
      icon: <Plus size={15} />,
      run: onCreateNote,
    },
    {
      id: 'act-tpl',
      label: 'New Note from AI / Built-in Template',
      hint: 'Templates',
      icon: <LayoutTemplate size={15} />,
      run: onOpenTemplates,
    },
    {
      id: 'act-chat',
      label: 'Toggle Chat with All Notes Sidebar',
      hint: '⌘J',
      icon: <MessageSquare size={15} />,
      run: onToggleChat,
    },
    {
      id: 'act-focus',
      label: 'Toggle Zen Focus Writing Mode',
      hint: '⌘\\',
      icon: <Maximize2 size={15} />,
      run: onToggleFocusMode,
    },
    {
      id: 'act-logs',
      label: 'Open Diagnostics, Activity Logs & Error Codes',
      hint: '⌘L',
      icon: <Terminal size={15} />,
      run: onOpenLogs,
    },
    {
      id: 'act-theme',
      label: 'Switch Dark / Light Theme',
      hint: 'Theme',
      icon: <Sun size={15} />,
      run: onToggleTheme,
    },
    {
      id: 'act-settings',
      label: 'Open Gemini API & App Settings',
      hint: '⌘,',
      icon: <Settings size={15} />,
      run: onOpenSettings,
    },
  ];

  const q = query.trim().toLowerCase();

  const matchingNotes = activeNotes
    .filter(
      (n) =>
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.folder.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    )
    .slice(0, 6)
    .map((n) => ({
      id: `note-${n.id}`,
      label: n.title || 'Untitled Note',
      hint: `📁 ${n.folder || 'General'}`,
      icon: <FileText size={15} />,
      run: () => onSelectNote(n.id),
    }));

  const matchingActions = actions.filter(
    (a) => !q || a.label.toLowerCase().includes(q)
  );

  const combinedItems = [...matchingActions, ...matchingNotes];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (combinedItems.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % combinedItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (combinedItems.length > 0) {
        setSelectedIndex(
          (prev) => (prev - 1 + combinedItems.length) % combinedItems.length
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = combinedItems[selectedIndex];
      if (item) {
        onClose();
        item.run();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card command-palette-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="command-palette-search">
          <Search size={16} className="accent-icon" />
          <input
            type="text"
            placeholder="Type a command or search notes (⌘K)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <span className="esc-hint">ESC</span>
        </div>

        <div className="command-palette-list">
          {combinedItems.length === 0 ? (
            <div className="empty-logs-state">No matching commands or notes</div>
          ) : (
            combinedItems.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                className={`command-palette-item ${
                  idx === selectedIndex ? 'selected' : ''
                }`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => {
                  onClose();
                  item.run();
                }}
              >
                <div className="cp-item-left">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                <span className="cp-item-hint">{item.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
