import React, { useState } from 'react';
import {
  X,
  Key,
  Sparkles,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Palette,
  Columns,
  Sun,
  Moon,
} from 'lucide-react';
import { AccentTheme, AppSettings, GeminiModel, LayoutMode } from '../types';
import { runGeminiAction } from '../services/gemini';
import { ACCENT_SWATCHES } from './Sidebar';

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSave,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [model, setModel] = useState<GeminiModel>(
    settings.model || 'gemini-3-flash-preview'
  );
  const [theme, setTheme] = useState<'dark' | 'light'>(
    settings.theme || 'dark'
  );
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(
    settings.accentTheme || 'sapphire'
  );
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(
    settings.layoutMode || 'three-column'
  );
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...settings,
      apiKey: apiKey.trim(),
      model,
      theme,
      accentTheme,
      layoutMode,
    });
    onClose();
  };

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await runGeminiAction({
      action: 'summarize',
      targetText: 'Gemini Notes is connected and working properly.',
      noteTitle: 'Connection Test',
      settings: {
        ...settings,
        apiKey: apiKey.trim(),
        model,
      },
    });
    setTesting(false);
    if (res.ok) {
      const activeModel = res.usedModel || model;
      if (res.usedModel && res.usedModel !== model) {
        setModel(res.usedModel);
      }
      setTestResult({
        ok: true,
        message: `Connected to ${activeModel} successfully!`,
      });
    } else {
      setTestResult({
        ok: false,
        message: res.error || 'Connection failed.',
      });
    }
  };

  const handleOpenFolder = () => {
    if (window.electronAPI) {
      window.electronAPI.openStorageFolder();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card settings-modal-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <Sparkles size={17} className="accent-icon" />
            <h3>Gemini AI & Appearance Settings</h3>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          {/* Color Palette & Layout Section */}
          <div className="settings-section-card">
            <div className="settings-section-title">
              <Palette size={14} className="accent-icon" />
              <span>Color Palette & Layout</span>
            </div>

            <div className="palette-grid">
              {ACCENT_SWATCHES.map((sw) => (
                <button
                  key={sw.id}
                  type="button"
                  className={`palette-choice-btn ${
                    accentTheme === sw.id ? 'active' : ''
                  }`}
                  onClick={() => {
                    setAccentTheme(sw.id);
                    document.documentElement.setAttribute(
                      'data-accent',
                      sw.id
                    );
                  }}
                >
                  <span
                    className="palette-choice-dot"
                    style={{ backgroundColor: sw.color }}
                  />
                  <span>{sw.label}</span>
                </button>
              ))}
            </div>

            <div className="appearance-layout-row">
              <div className="segmented-toggle-group">
                <button
                  type="button"
                  className={`segmented-option ${
                    theme === 'dark' ? 'active' : ''
                  }`}
                  onClick={() => {
                    setTheme('dark');
                    document.documentElement.setAttribute(
                      'data-theme',
                      'dark'
                    );
                  }}
                >
                  <Moon size={13} />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  className={`segmented-option ${
                    theme === 'light' ? 'active' : ''
                  }`}
                  onClick={() => {
                    setTheme('light');
                    document.documentElement.setAttribute(
                      'data-theme',
                      'light'
                    );
                  }}
                >
                  <Sun size={13} />
                  <span>Light</span>
                </button>
              </div>

              <div className="segmented-toggle-group">
                <button
                  type="button"
                  className={`segmented-option ${
                    layoutMode === 'three-column' ? 'active' : ''
                  }`}
                  onClick={() => setLayoutMode('three-column')}
                >
                  <Columns size={13} />
                  <span>3-Column (Apple Notes)</span>
                </button>
                <button
                  type="button"
                  className={`segmented-option ${
                    layoutMode === 'two-column' ? 'active' : ''
                  }`}
                  onClick={() => setLayoutMode('two-column')}
                >
                  <span>2-Column Compact</span>
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>
              <Key size={14} />
              <span>Gemini API Key</span>
            </label>
            <div className="api-key-input-row">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide API Key' : 'Show API Key'}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="form-hint">
              Stored locally on your Mac. Get a key from Google AI Studio (
              <code>aistudio.google.com</code>) or set{' '}
              <code>GEMINI_API_KEY</code> in your environment.
            </p>
          </div>

          <div className="form-group">
            <label>
              <Sparkles size={14} />
              <span>Gemini Model</span>
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as GeminiModel)}
            >
              {![
                'gemini-3-flash-preview',
                'gemini-2.5-flash',
                'gemini-2.5-pro',
                'gemini-2.0-flash',
              ].includes(model) && (
                <option value={model}>{model} (Auto-detected)</option>
              )}
              <option value="gemini-3-flash-preview">
                Gemini 3 Flash (Latest & Recommended)
              </option>
              <option value="gemini-2.5-flash">
                Gemini 2.5 Flash (Auto-upgrades to latest Flash)
              </option>
              <option value="gemini-2.5-pro">
                Gemini 2.5 Pro (Deep Reasoning & Complex Editing)
              </option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            </select>
          </div>

          <div className="test-connection-row">
            <button
              type="button"
              className="secondary-btn"
              onClick={handleTestKey}
              disabled={testing || !apiKey.trim()}
            >
              {testing ? (
                <>
                  <Loader2 size={14} className="spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <span>Test Gemini Connection</span>
              )}
            </button>

            {testResult && (
              <div
                className={`test-feedback ${
                  testResult.ok ? 'success' : 'error'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <AlertCircle size={15} />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {window.electronAPI && (
            <div className="form-group storage-info-box">
              <div>
                <strong>Local Storage Location</strong>
                <p className="form-hint">{settings.storagePath}</p>
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={handleOpenFolder}
              >
                <FolderOpen size={14} />
                <span>Show in Finder</span>
              </button>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-btn">
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
