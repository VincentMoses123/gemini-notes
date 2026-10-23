import React, { useState } from 'react';
import {
  X,
  LayoutTemplate,
  Sparkles,
  Loader2,
  ArrowRight,
  Folder,
} from 'lucide-react';
import { AppSettings, NoteTemplate } from '../types';
import { NOTE_TEMPLATES } from '../services/storage';
import { generateCustomTemplate } from '../services/gemini';

interface TemplatesModalProps {
  settings: AppSettings;
  onSelectTemplate: (tpl: {
    title: string;
    content: string;
    folder: string;
    tags: string[];
  }) => void;
  onClose: () => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  settings,
  onSelectTemplate,
  onClose,
}) => {
  const [customTopic, setCustomTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickBuiltin = (tpl: NoteTemplate) => {
    onSelectTemplate({
      title: tpl.defaultTitle,
      content: tpl.content,
      folder: tpl.folder,
      tags: tpl.tags,
    });
    onClose();
  };

  const handleGenerateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopic.trim() || generating) return;
    setGenerating(true);
    setError(null);

    const res = await generateCustomTemplate({
      topic: customTopic.trim(),
      settings,
    });

    setGenerating(false);

    if (res.ok && res.html) {
      onSelectTemplate({
        title: res.title || customTopic.trim(),
        content: res.html,
        folder: 'General',
        tags: res.tags || ['template'],
      });
      onClose();
    } else {
      setError(res.error || 'Could not generate custom template.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card templates-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <LayoutTemplate size={18} className="accent-icon" />
            <h3>New Note from Template</h3>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* AI Custom Template Generator */}
          <div className="ai-template-generator-box">
            <div className="ai-template-label">
              <Sparkles size={14} className="accent-icon" />
              <span>Generate Any Custom Template with Gemini</span>
            </div>
            <form
              className="ai-custom-prompt-row"
              onSubmit={handleGenerateCustom}
            >
              <input
                type="text"
                placeholder="e.g., 'Weekly Workout & Nutrition Log', 'Book Club Notes', 'Bug Report'..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                disabled={generating}
              />
              <button
                type="submit"
                className="primary-btn"
                disabled={generating || !customTopic.trim()}
              >
                {generating ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    <span>Building...</span>
                  </>
                ) : (
                  <>
                    <span>Create</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
            {error && <p className="template-error-text">{error}</p>}
          </div>

          <div className="section-label">BUILT-IN TEMPLATES</div>
          <div className="templates-grid">
            {NOTE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="template-card-btn"
                onClick={() => handlePickBuiltin(tpl)}
              >
                <div className="template-card-top">
                  <strong>{tpl.name}</strong>
                  <span className="template-folder-badge">
                    <Folder size={10} />
                    {tpl.folder}
                  </span>
                </div>
                <p>{tpl.description}</p>
                <div className="template-card-tags">
                  {tpl.tags.map((t) => (
                    <span key={t} className="mini-tag">
                      #{t}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
