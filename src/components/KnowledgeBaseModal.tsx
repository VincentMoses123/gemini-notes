import React, { useRef, useState } from 'react';
import {
  X,
  Database,
  Upload,
  Plus,
  Search,
  Trash2,
  Eye,
  FilePlus,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { KnowledgeDocType, KnowledgeDocument } from '../types';
import { logEvent } from '../services/logger';

interface KnowledgeBaseModalProps {
  docs: KnowledgeDocument[];
  onUpdateDocs: (docs: KnowledgeDocument[]) => void;
  onCreateNoteFromDoc: (doc: KnowledgeDocument) => void;
  onClose: () => void;
}

function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function inferBrowserDocType(filename: string): KnowledgeDocType {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'csv') return 'csv';
  if (ext === 'json') return 'json';
  if (ext === 'txt') return 'txt';
  return 'doc';
}

export const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({
  docs,
  onUpdateDocs,
  onCreateNoteFromDoc,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingSnippet, setAddingSnippet] = useState(false);
  const [snippetTitle, setSnippetTitle] = useState('');
  const [snippetBody, setSnippetBody] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCount = docs.filter((d) => d.enabled).length;
  const filteredDocs = docs.filter((d) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return d.name.toLowerCase().includes(q) || d.content.toLowerCase().includes(q);
  });

  const handleImportFiles = async () => {
    setStatusError(null);
    if (window.electronAPI?.importKnowledgeFiles) {
      setImporting(true);
      const res = await window.electronAPI.importKnowledgeFiles();
      setImporting(false);
      if (res.ok && res.docs && res.docs.length > 0) {
        onUpdateDocs([...res.docs, ...docs]);
        logEvent({
          level: 'info',
          source: 'system',
          message: `Imported ${res.docs.length} document(s) into Personal Knowledge Base`,
        });
      } else if (!res.canceled && res.error) {
        setStatusError(res.error);
      }
      return;
    }
    fileInputRef.current?.click();
  };

  const handleBrowserFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setImporting(true);
    setStatusError(null);
    const now = new Date().toISOString();
    const imported: KnowledgeDocument[] = [];

    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) {
        setStatusError(`Skipped "${file.name}": exceeds the 25 MB file size limit.`);
        continue;
      }
      const extType = inferBrowserDocType(file.name);
      if (extType === 'pdf') {
        setStatusError('PDF text extraction requires the desktop app; import .md, .txt, or .csv here.');
        continue;
      }
      const content = (await file.text()).trim().slice(0, 120000);
      if (!content) continue;
      imported.push({
        id: `kb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        fileType: extType,
        content,
        sizeBytes: file.size,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    setImporting(false);
    if (imported.length > 0) {
      onUpdateDocs([...imported, ...docs]);
    }
  };

  const handleSaveSnippet = (e: React.FormEvent) => {
    e.preventDefault();
    const title = snippetTitle.trim();
    const content = snippetBody.trim();
    if (!title || !content) return;

    const now = new Date().toISOString();
    const doc: KnowledgeDocument = {
      id: `kb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: title.endsWith('.md') || title.endsWith('.txt') ? title : `${title}.md`,
      fileType: 'md',
      content: content.slice(0, 120000),
      sizeBytes: new Blob([content]).size,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    onUpdateDocs([doc, ...docs]);
    logEvent({
      level: 'info',
      source: 'system',
      message: `Added snippet "${doc.name}" to Personal Knowledge Base`,
    });
    setSnippetTitle('');
    setSnippetBody('');
    setAddingSnippet(false);
  };

  const toggleDocEnabled = (id: string) => {
    onUpdateDocs(
      docs.map((d) =>
        d.id === id ? { ...d, enabled: !d.enabled, updatedAt: new Date().toISOString() } : d
      )
    );
  };

  const removeDoc = (doc: KnowledgeDocument) => {
    onUpdateDocs(docs.filter((d) => d.id !== doc.id));
    logEvent({
      level: 'info',
      source: 'system',
      message: `Removed "${doc.name}" from Personal Knowledge Base`,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card kb-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Database size={17} className="accent-icon" />
            <h3>Personal Knowledge Base</h3>
            <span className="kb-header-pill">
              {activeCount}/{docs.length} Active in AI
            </span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body kb-modal-body">
          <p className="form-hint">
            Import personal PDFs, Markdown specs, text files, CSVs, or snippets. Active documents
            are stored privately on your Mac (0o600 permissions) and automatically referenced by{' '}
            <strong>Chat with All Notes (⌘J)</strong> and <strong>Inline Editor AI (/)</strong>.
          </p>

          <div className="kb-toolbar-row">
            <div className="kb-search-box">
              <Search size={13} className="search-icon" />
              <input
                type="text"
                placeholder="Filter knowledge docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="secondary-btn"
              onClick={() => setAddingSnippet((prev) => !prev)}
            >
              <Plus size={14} />
              <span>{addingSnippet ? 'Cancel Snippet' : 'Paste Snippet'}</span>
            </button>

            <button
              type="button"
              className="primary-btn"
              onClick={handleImportFiles}
              disabled={importing}
            >
              {importing ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
              <span>{importing ? 'Extracting...' : 'Import Files'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.md,.markdown,.txt,.csv,.json,.rtf,.html,.htm"
              multiple
              hidden
              onChange={handleBrowserFilesSelected}
            />
          </div>

          {statusError && (
            <div className="test-feedback error">
              <AlertCircle size={14} />
              <span>{statusError}</span>
            </div>
          )}

          {addingSnippet && (
            <form className="settings-section-card kb-snippet-form" onSubmit={handleSaveSnippet}>
              <input
                type="text"
                placeholder="Document title (e.g., Company Style Guide, Q4 Specs)..."
                value={snippetTitle}
                onChange={(e) => setSnippetTitle(e.target.value)}
                autoFocus
              />
              <textarea
                rows={4}
                placeholder="Paste reference documentation, guidelines, or background notes..."
                value={snippetBody}
                onChange={(e) => setSnippetBody(e.target.value)}
              />
              <div className="kb-snippet-actions">
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={!snippetTitle.trim() || !snippetBody.trim()}
                >
                  Save to Knowledge Base
                </button>
              </div>
            </form>
          )}

          <div className="kb-doc-list">
            {filteredDocs.length === 0 ? (
              <div className="kb-empty-state">
                <Database size={28} className="accent-icon" />
                <p>
                  {docs.length === 0
                    ? 'No reference documents yet. Click "Import Files" to add PDFs, Markdown, or text docs.'
                    : 'No matching documents found.'}
                </p>
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isExpanded = expandedId === doc.id;
                const wordCount = doc.content.trim().split(/\s+/).filter(Boolean).length;
                return (
                  <div
                    key={doc.id}
                    className={`kb-doc-card ${doc.enabled ? 'enabled' : 'disabled'}`}
                  >
                    <div className="kb-doc-main-row">
                      <span className={`kb-type-badge type-${doc.fileType}`}>
                        {doc.fileType.toUpperCase()}
                      </span>
                      <div className="kb-doc-meta">
                        <strong>{doc.name}</strong>
                        <span>
                          {wordCount.toLocaleString()} words • {formatByteSize(doc.sizeBytes)}
                        </span>
                      </div>
                      <div className="kb-doc-actions">
                        <button
                          type="button"
                          className={`kb-toggle-pill ${doc.enabled ? 'active' : ''}`}
                          onClick={() => toggleDocEnabled(doc.id)}
                          title="Include or exclude from Gemini AI context"
                        >
                          <CheckCircle2 size={12} />
                          <span>{doc.enabled ? 'Active in AI' : 'Paused'}</span>
                        </button>
                        <button
                          type="button"
                          className="icon-mini-btn"
                          onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                          title="Preview extracted text"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          className="icon-mini-btn"
                          onClick={() => {
                            onCreateNoteFromDoc(doc);
                            onClose();
                          }}
                          title="Create editable Note from this document"
                        >
                          <FilePlus size={13} />
                        </button>
                        <button
                          type="button"
                          className="icon-mini-btn danger"
                          onClick={() => removeDoc(doc)}
                          title="Remove document"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="kb-preview-box">
                        {doc.content.slice(0, 1400)}
                        {doc.content.length > 1400 ? '\n… (truncated preview)' : ''}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
