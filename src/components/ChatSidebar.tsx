import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  FileText,
  FilePlus,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import { AppSettings, ChatMessage, Note } from '../types';
import { chatWithAllNotes, markdownToHtml } from '../services/gemini';

interface ChatSidebarProps {
  notes: Note[];
  settings: AppSettings;
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
  onCreateNoteFromAnswer: (title: string, htmlContent: string) => void;
  onOpenSettings: () => void;
}

const STARTER_PROMPTS = [
  'Summarize the key points across all my notes',
  'What action items or open tasks do I have?',
  'Find common themes and ideas in my notes',
];

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  notes,
  settings,
  onClose,
  onSelectNote,
  onCreateNoteFromAnswer,
  onOpenSettings,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeNotesCount = notes.filter((n) => !n.trashed).length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setLoading(true);
    setError(null);

    const res = await chatWithAllNotes({
      question: trimmed,
      history: updatedHistory,
      notes,
      settings,
    });

    setLoading(false);

    if (res.ok && res.answer) {
      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: res.answer,
        citedNotes: res.citedNotes,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } else {
      setError(res.error || 'Failed to get an answer from Gemini.');
    }
  };

  return (
    <aside className="chat-sidebar">
      <div className="chat-sidebar-header">
        <div className="chat-sidebar-title">
          <Sparkles size={16} className="accent-icon" />
          <div>
            <h4>Chat with All Notes</h4>
            <span>{activeNotesCount} notes indexed in context</span>
          </div>
        </div>
        <div className="chat-header-actions">
          {messages.length > 0 && (
            <button
              className="icon-btn"
              onClick={() => setMessages([])}
              title="Clear Chat History"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button className="icon-btn" onClick={onClose} title="Close (⌘J)">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="chat-messages-area">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">
              <MessageSquare size={24} className="accent-icon" />
            </div>
            <h5>Ask Gemini Across Your Notes</h5>
            <p>
              Gemini reads all {activeNotesCount} of your active notes to answer
              questions, connect ideas, and find tasks.
            </p>
            <div className="starter-prompts-list">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="starter-prompt-btn"
                  onClick={() => sendQuestion(prompt)}
                >
                  <Sparkles size={12} className="accent-icon" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`chat-bubble-row ${msg.role}`}>
              <div className={`chat-bubble ${msg.role}`}>
                {msg.role === 'assistant' ? (
                  <>
                    <div
                      className="chat-markdown-body"
                      dangerouslySetInnerHTML={{
                        __html: markdownToHtml(msg.content),
                      }}
                    />
                    {msg.citedNotes && msg.citedNotes.length > 0 && (
                      <div className="cited-notes-box">
                        <span className="cited-label">Referenced notes:</span>
                        <div className="cited-chips">
                          {msg.citedNotes.map((cn) => (
                            <button
                              key={cn.id}
                              type="button"
                              className="cited-note-chip"
                              onClick={() => onSelectNote(cn.id)}
                            >
                              <FileText size={11} />
                              <span>{cn.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="chat-bubble-footer">
                      <button
                        type="button"
                        className="save-chat-note-btn"
                        onClick={() =>
                          onCreateNoteFromAnswer(
                            'AI Synthesis Note',
                            markdownToHtml(msg.content)
                          )
                        }
                      >
                        <FilePlus size={12} />
                        <span>Save as New Note</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="chat-loading-row">
            <Loader2 size={15} className="spin accent-icon" />
            <span>Searching & synthesizing your notes...</span>
          </div>
        )}

        {error && (
          <div className="ai-error-box">
            <span>{error}</span>
            {error.toLowerCase().includes('api key') && (
              <button
                type="button"
                className="secondary-btn"
                onClick={onOpenSettings}
              >
                Settings
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        className="chat-input-bar"
        onSubmit={(e) => {
          e.preventDefault();
          sendQuestion(input);
        }}
      >
        <input
          type="text"
          placeholder="Ask anything about your notes..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="ai-send-btn"
          disabled={loading || !input.trim()}
        >
          <Send size={14} />
        </button>
      </form>
    </aside>
  );
};
