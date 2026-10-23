import React, { useState } from 'react';
import {
  X,
  Terminal,
  AlertCircle,
  AlertTriangle,
  Info,
  Trash2,
  Copy,
  Check,
  BookOpen,
  FolderOpen,
  Clock,
  Cpu,
} from 'lucide-react';
import { LogEntry } from '../types';
import { ERROR_CODE_CATALOG, clearAllLogs } from '../services/logger';

interface LogsModalProps {
  logs: LogEntry[];
  onClose: () => void;
}

export const LogsModal: React.FC<LogsModalProps> = ({ logs, onClose }) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'codes'>('logs');
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [copied, setCopied] = useState(false);

  const filteredLogs = logs.filter((entry) => {
    if (levelFilter === 'all') return true;
    return entry.level === levelFilter;
  });

  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warnCount = logs.filter((l) => l.level === 'warn').length;

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleOpenStorageFolder = () => {
    if (window.electronAPI) {
      window.electronAPI.openStorageFolder();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card logs-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <Terminal size={18} className="accent-icon" />
            <h3>Diagnostics, Activity Logs & Error Codes</h3>
          </div>
          <div className="logs-header-actions">
            {window.electronAPI && (
              <button
                type="button"
                className="secondary-btn"
                onClick={handleOpenStorageFolder}
                title="Open app-logs.json in Finder"
              >
                <FolderOpen size={13} />
                <span>Log Folder</span>
              </button>
            )}
            <button
              type="button"
              className="secondary-btn"
              onClick={handleCopyLogs}
            >
              {copied ? (
                <>
                  <Check size={13} />
                  <span>Copied JSON</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Logs</span>
                </>
              )}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => clearAllLogs()}
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
            <button className="icon-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="logs-tabs-bar">
          <div className="logs-main-tabs">
            <button
              type="button"
              className={`logs-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              <Terminal size={14} />
              <span>Live Activity Logs ({logs.length})</span>
            </button>
            <button
              type="button"
              className={`logs-tab-btn ${activeTab === 'codes' ? 'active' : ''}`}
              onClick={() => setActiveTab('codes')}
            >
              <BookOpen size={14} />
              <span>Error Code Reference ({ERROR_CODE_CATALOG.length})</span>
            </button>
          </div>

          {activeTab === 'logs' && (
            <div className="logs-filter-pills">
              <button
                type="button"
                className={`filter-pill ${levelFilter === 'all' ? 'active' : ''}`}
                onClick={() => setLevelFilter('all')}
              >
                All ({logs.length})
              </button>
              <button
                type="button"
                className={`filter-pill error ${
                  levelFilter === 'error' ? 'active' : ''
                }`}
                onClick={() => setLevelFilter('error')}
              >
                Errors ({errorCount})
              </button>
              <button
                type="button"
                className={`filter-pill warn ${
                  levelFilter === 'warn' ? 'active' : ''
                }`}
                onClick={() => setLevelFilter('warn')}
              >
                Warnings ({warnCount})
              </button>
              <button
                type="button"
                className={`filter-pill info ${
                  levelFilter === 'info' ? 'active' : ''
                }`}
                onClick={() => setLevelFilter('info')}
              >
                Info
              </button>
            </div>
          )}
        </div>

        <div className="logs-body">
          {activeTab === 'logs' ? (
            filteredLogs.length === 0 ? (
              <div className="empty-logs-state">
                <p>No log entries match the selected filter.</p>
              </div>
            ) : (
              <div className="logs-entries-list">
                {filteredLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className={`log-entry-card ${entry.level}`}
                  >
                    <div className="log-entry-top">
                      <span className={`log-level-badge ${entry.level}`}>
                        {entry.level === 'error' && <AlertCircle size={12} />}
                        {entry.level === 'warn' && <AlertTriangle size={12} />}
                        {entry.level === 'info' && <Info size={12} />}
                        {entry.level.toUpperCase()}
                      </span>

                      {entry.code && (
                        <button
                          type="button"
                          className="error-code-chip"
                          onClick={() => setActiveTab('codes')}
                          title="Click to view Error Code documentation"
                        >
                          {entry.code}
                        </button>
                      )}

                      <span className="log-source-tag">{entry.source}</span>

                      {entry.model && (
                        <span className="log-meta-pill">
                          <Cpu size={11} />
                          {entry.model}
                        </span>
                      )}

                      {entry.durationMs !== undefined && (
                        <span className="log-meta-pill">
                          <Clock size={11} />
                          {entry.durationMs}ms
                        </span>
                      )}

                      <span className="log-timestamp">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="log-entry-message">{entry.message}</div>

                    {entry.details && (
                      <pre className="log-entry-details">{entry.details}</pre>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="error-codes-reference-list">
              {ERROR_CODE_CATALOG.map((def) => (
                <div key={def.code} className="error-code-ref-card">
                  <div className="error-code-ref-header">
                    <span className="error-code-chip">{def.code}</span>
                    <strong>{def.title}</strong>
                    <span className={`log-level-badge ${def.severity}`}>
                      {def.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="error-ref-line">
                    <strong>Cause:</strong> {def.cause}
                  </p>
                  <p className="error-ref-line resolution">
                    <strong>How to Fix:</strong> {def.resolution}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
