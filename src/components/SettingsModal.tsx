import React, { useEffect, useState } from 'react';
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
  BookOpen,
  FileDown,
  Cpu,
  History,
} from 'lucide-react';
import {
  AccentTheme,
  AppSettings,
  ExportFormat,
  GeminiModel,
  LayoutMode,
  PdfPageSize,
  SystemInfo,
  ThemeMode,
} from '../types';
import { runGeminiAction } from '../services/gemini';
import { APP_CHANGELOG, CURRENT_APP_VERSION } from '../services/changelog';
import { ACCENT_SWATCHES } from './Sidebar';

interface SettingsModalProps {
  settings: AppSettings;
  activeNoteTitle?: string;
  onExportActiveNotePdf?: (overrideSettings?: AppSettings) => void;
  onOpenWhatsNew?: () => void;
  onSave: (newSettings: AppSettings) => void;
  onClose: () => void;
}

const MODEL_OPTIONS: { value: GeminiModel; label: string }[] = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Latest & Recommended)' },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Deep Reasoning & Synthesis)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Auto-upgrades to latest Flash)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Complex Editing)' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];

const THEME_OPTIONS: {
  id: ThemeMode;
  label: string;
  subtitle: string;
  previewBg: string;
  previewCard: string;
  previewText: string;
  Icon: React.ElementType;
}[] = [
  {
    id: 'dark',
    label: 'Dark',
    subtitle: 'Studio Dark',
    previewBg: '#141517',
    previewCard: '#26282e',
    previewText: '#f3f4f6',
    Icon: Moon,
  },
  {
    id: 'midnight',
    label: 'Midnight',
    subtitle: 'OLED Black',
    previewBg: '#07090d',
    previewCard: '#1a202c',
    previewText: '#f8fafc',
    Icon: Sparkles,
  },
  {
    id: 'light',
    label: 'Light',
    subtitle: 'Daylight Paper',
    previewBg: '#fbfbfa',
    previewCard: '#eaecf0',
    previewText: '#111827',
    Icon: Sun,
  },
  {
    id: 'sepia',
    label: 'Sepia',
    subtitle: 'Warm Parchment',
    previewBg: '#f6edd7',
    previewCard: '#e6d8b9',
    previewText: '#2b2114',
    Icon: BookOpen,
  },
];

const EXPORT_FORMAT_OPTIONS: { id: ExportFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF (.pdf)' },
  { id: 'markdown', label: 'Markdown (.md)' },
];

const PDF_PAGE_SIZE_OPTIONS: PdfPageSize[] = ['Letter', 'A4', 'Legal'];

const LAYOUT_OPTIONS: { id: LayoutMode; label: string; Icon?: React.ElementType }[] = [
  { id: 'three-column', label: '3-Column (Apple Notes)', Icon: Columns },
  { id: 'two-column', label: '2-Column Compact' },
];

export function formatArchLabel(arch?: string): string {
  const normalized = (arch || 'arm64').toLowerCase();
  if (normalized.includes('arm')) return 'Apple Silicon (arm64)';
  if (normalized === 'x64' || normalized === 'x86_64') return 'Intel (x64)';
  if (normalized === 'universal') return 'Universal macOS (arm64 + x64)';
  return `macOS (${normalized})`;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  activeNoteTitle,
  onExportActiveNotePdf,
  onOpenWhatsNew,
  onSave,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [model, setModel] = useState<GeminiModel>(settings.model || 'gemini-3-flash-preview');
  const [theme, setTheme] = useState<ThemeMode>(settings.theme || 'dark');
  const [accentTheme, setAccentTheme] = useState<AccentTheme>(settings.accentTheme || 'sapphire');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(settings.layoutMode || 'three-column');
  const [defaultExportFormat, setDefaultExportFormat] = useState<ExportFormat>(
    settings.defaultExportFormat || 'pdf'
  );
  const [pdfPageSize, setPdfPageSize] = useState<PdfPageSize>(settings.pdfPageSize || 'Letter');
  const [pdfIncludeMetadata, setPdfIncludeMetadata] = useState<boolean>(
    settings.pdfIncludeMetadata !== undefined ? settings.pdfIncludeMetadata : true
  );
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    arch: window.electronAPI?.arch || settings.arch || 'arm64',
    platform: window.electronAPI?.platform || settings.platform || 'darwin',
  });

  useEffect(() => {
    let mounted = true;
    window.electronAPI
      ?.getSystemInfo?.()
      .then((info) => {
        if (mounted && info) setSystemInfo(info);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const persistAppearance = (overrides: Partial<AppSettings>) => {
    onSave({
      ...settings,
      apiKey: apiKey.trim(),
      model,
      theme,
      accentTheme,
      layoutMode,
      defaultExportFormat,
      pdfPageSize,
      pdfIncludeMetadata,
      ...overrides,
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...settings,
      apiKey: apiKey.trim(),
      model,
      theme,
      accentTheme,
      layoutMode,
      defaultExportFormat,
      pdfPageSize,
      pdfIncludeMetadata,
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
      settings: { ...settings, apiKey: apiKey.trim(), model },
    });
    setTesting(false);
    if (res.ok) {
      const activeModel = res.usedModel || model;
      if (res.usedModel && res.usedModel !== model) setModel(res.usedModel);
      setTestResult({ ok: true, message: `Connected to ${activeModel} successfully!` });
    } else {
      setTestResult({ ok: false, message: res.error || 'Connection failed.' });
    }
  };

  const resolvedArch = systemInfo.arch || settings.arch || 'arm64';
  const archLabel = formatArchLabel(resolvedArch);
  const isArm64 = resolvedArch.toLowerCase().includes('arm');
  const isStandardModel = MODEL_OPTIONS.some((m) => m.value === model);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card settings-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Sparkles size={17} className="accent-icon" />
            <h3>Gemini AI & Appearance Settings</h3>
            <span className="beta-badge-pill">v{CURRENT_APP_VERSION} • BETA</span>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          <div className="settings-section-card">
            <div className="settings-section-title">
              <Palette size={14} className="accent-icon" />
              <span>App Theme, Accent Colors & Layout</span>
            </div>

            <div className="settings-subgroup">
              <span className="settings-sublabel">APP THEME</span>
              <div className="theme-mode-grid">
                {THEME_OPTIONS.map(
                  ({ id, label, subtitle, previewBg, previewCard, previewText, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={`theme-choice-card ${theme === id ? 'active' : ''}`}
                      onClick={() => {
                        setTheme(id);
                        document.documentElement.setAttribute('data-theme', id);
                        persistAppearance({ theme: id });
                      }}
                    >
                      <div
                        className="theme-choice-preview"
                        style={{
                          backgroundColor: previewBg,
                          borderColor: previewCard,
                          color: previewText,
                        }}
                      >
                        <Icon size={14} />
                      </div>
                      <div className="theme-choice-text">
                        <span className="theme-choice-name">{label}</span>
                        <span className="theme-choice-sub">{subtitle}</span>
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="settings-subgroup">
              <span className="settings-sublabel">ACCENT COLOR</span>
              <div className="palette-grid">
                {ACCENT_SWATCHES.map((sw) => (
                  <button
                    key={sw.id}
                    type="button"
                    className={`palette-choice-btn ${accentTheme === sw.id ? 'active' : ''}`}
                    onClick={() => {
                      setAccentTheme(sw.id);
                      document.documentElement.setAttribute('data-accent', sw.id);
                      persistAppearance({ accentTheme: sw.id });
                    }}
                  >
                    <span className="palette-choice-dot" style={{ backgroundColor: sw.color }} />
                    <span>{sw.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-subgroup">
              <span className="settings-sublabel">WORKSPACE LAYOUT</span>
              <div className="segmented-toggle-group">
                {LAYOUT_OPTIONS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`segmented-option ${layoutMode === id ? 'active' : ''}`}
                    onClick={() => {
                      setLayoutMode(id);
                      persistAppearance({ layoutMode: id });
                    }}
                  >
                    {Icon && <Icon size={13} />}
                    <span>{label}</span>
                  </button>
                ))}
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
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="off"
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
              <code>aistudio.google.com</code>) or set <code>GEMINI_API_KEY</code> in your
              environment.
            </p>
          </div>

          <div className="form-group">
            <label>
              <Sparkles size={14} />
              <span>Gemini Model</span>
            </label>
            <select value={model} onChange={(e) => setModel(e.target.value as GeminiModel)}>
              {!isStandardModel && <option value={model}>{model} (Auto-detected)</option>}
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
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
              <div className={`test-feedback ${testResult.ok ? 'success' : 'error'}`}>
                {testResult.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          <div className="settings-section-card">
            <div className="settings-section-title">
              <FileDown size={14} className="accent-icon" />
              <span>Note Export & PDF Settings</span>
            </div>

            <div className="pdf-export-settings-row">
              <span className="form-hint">Quick Export Default</span>
              <div className="segmented-toggle-group">
                {EXPORT_FORMAT_OPTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={`segmented-option ${defaultExportFormat === id ? 'active' : ''}`}
                    onClick={() => setDefaultExportFormat(id)}
                  >
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pdf-export-settings-row">
              <span className="form-hint">PDF Page Size</span>
              <div className="segmented-toggle-group">
                {PDF_PAGE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`segmented-option ${pdfPageSize === size ? 'active' : ''}`}
                    onClick={() => setPdfPageSize(size)}
                  >
                    <span>{size}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pdf-export-settings-row">
              <label className="checkbox-toggle-label">
                <input
                  type="checkbox"
                  checked={pdfIncludeMetadata}
                  onChange={(e) => setPdfIncludeMetadata(e.target.checked)}
                />
                <span>Include folder, tags & timestamp header in PDFs</span>
              </label>

              {onExportActiveNotePdf && (
                <button
                  type="button"
                  className="export-now-btn"
                  onClick={() => {
                    const updated: AppSettings = {
                      ...settings,
                      apiKey: apiKey.trim(),
                      model,
                      theme,
                      accentTheme,
                      layoutMode,
                      defaultExportFormat,
                      pdfPageSize,
                      pdfIncludeMetadata,
                    };
                    onSave(updated);
                    onExportActiveNotePdf(updated);
                  }}
                >
                  <FileDown size={14} />
                  <span>Export &ldquo;{activeNoteTitle || 'Active Note'}&rdquo; as PDF</span>
                </button>
              )}
            </div>
          </div>

          <div className="form-group storage-info-box">
            <div className="system-storage-details">
              <div className="system-arch-row">
                <strong>Runtime Architecture</strong>
                <span
                  className={`arch-badge ${isArm64 ? 'apple-silicon' : 'intel'}`}
                  title="Native macOS process architecture"
                >
                  <Cpu size={12} />
                  <span>{archLabel}</span>
                </span>
              </div>
              <p className="form-hint">Storage: {settings.storagePath || 'Local App Data'}</p>
            </div>
            {window.electronAPI && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => window.electronAPI?.openStorageFolder()}
              >
                <FolderOpen size={14} />
                <span>Show in Finder</span>
              </button>
            )}
          </div>

          <div className="settings-section-card">
            <div className="changelog-header-bar">
              <div className="settings-section-title">
                <History size={14} className="accent-icon" />
                <span>Beta Changelog &amp; Release Notes</span>
              </div>
              {onOpenWhatsNew && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={onOpenWhatsNew}
                >
                  Show &quot;What&apos;s New&quot; Popup
                </button>
              )}
            </div>

            <div className="changelog-list">
              {APP_CHANGELOG.map((rel, idx) => (
                <div key={rel.version} className="changelog-release-card">
                  <div className="changelog-release-header">
                    <div className="changelog-release-title-group">
                      <span className="whats-new-version-pill">v{rel.version}</span>
                      <span className="beta-badge-pill">
                        {idx === 0 ? 'LATEST BETA' : rel.channel}
                      </span>
                    </div>
                    <span className="whats-new-date">{rel.date}</span>
                  </div>
                  <strong>{rel.title}</strong>
                  <p>{rel.summary}</p>
                  <ul className="changelog-highlights">
                    {rel.highlights.map((h) => (
                      <li key={h.title}>
                        <strong>{h.title}:</strong> {h.description}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

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
