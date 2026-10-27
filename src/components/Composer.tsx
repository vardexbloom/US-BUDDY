import React, { useState, useRef, useEffect } from "react";

interface ComposerProps {
  busy: boolean;
  projectContextSummary: string;
  onSend: (text: string) => void;
}

export const Composer: React.FC<ComposerProps> = ({
  busy,
  projectContextSummary,
  onSend,
}) => {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!busy && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [busy]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="comp">
      <div className="col">
        <form onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            id="in"
            aria-label="Message your AI"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or continue your work…"
          />
          <div className="bar">
            <span className="mu sm">
              {projectContextSummary
                ? `Project context: ${projectContextSummary}`
                : "No project context set"}
            </span>
            <button
              type="submit"
              className="send"
              aria-label="Send message"
              disabled={busy || !text.trim()}
            >
              ↑
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
