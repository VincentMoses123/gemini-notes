import React, { useEffect } from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { ChangelogRelease } from '../types';

interface WhatsNewModalProps {
  release: ChangelogRelease;
  onClose: () => void;
  onOpenChangelogInSettings: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  release,
  onClose,
  onOpenChangelogInSettings,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card whats-new-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <Sparkles size={17} className="accent-icon" />
            <h3 id="whats-new-modal-title">What&apos;s New in Gemini Notes</h3>
            <span className="whats-new-version-pill">v{release.version}</span>
            <span className="beta-badge-pill">{release.channel || 'BETA'}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close What's New"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="whats-new-hero">
            <span className="whats-new-date">{release.date}</span>
            <h4>{release.title}</h4>
            <p>{release.summary}</p>
          </div>

          <div className="whats-new-highlights">
            {release.highlights.map((item) => (
              <div key={item.title} className="whats-new-highlight-card">
                <CheckCircle2
                  size={16}
                  className="accent-icon whats-new-highlight-icon"
                />
                <div className="whats-new-highlight-content">
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="whats-new-footer">
          <span className="whats-new-footer-note">
            Shown once per update • Full release history is available anytime in
            Settings (⌘,)
          </span>
          <div className="whats-new-footer-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={onOpenChangelogInSettings}
            >
              View Full Changelog in Settings
            </button>
            <button type="button" className="primary-btn" onClick={onClose}>
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
