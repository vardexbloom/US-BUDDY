import React from "react";

export interface ChatMessage {
  r: "u" | "a" | "s" | "e" | "o"; // u: user, a: assistant, s: system, e: error, o: out-of-context
  t?: string; // text
  q?: string; // query (for retry/new topic)
  f?: string | null; // followup
  c?: string[]; // chips
  mem?: string | null; // memory proposal
  x?: boolean; // whether this is an explanation
}

interface MessageProps {
  message: ChatMessage;
  index: number;
  isLast: boolean;
  onChipClick: (text: string) => void;
  onExplain: () => void;
  onRetry: (index: number) => void;
  onNewTopic: (index: number) => void;
  onDismissOutOfContext: (index: number) => void;
  onSaveMemory: (index: number) => void;
  onDismissMemory: (index: number) => void;
}

// Markdown parser preserving prototype behavior
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc pl-5 my-2">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const parseInline = (str: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = str;
    let keyIdx = 0;

    while (remaining.length > 0) {
      const match = remaining.match(/\*\*(.+?)\*\*/);
      if (match && match.index !== undefined) {
        if (match.index > 0) {
          parts.push(remaining.substring(0, match.index));
        }
        parts.push(<strong key={keyIdx++}>{match[1]}</strong>);
        remaining = remaining.substring(match.index + match[0].length);
      } else {
        parts.push(remaining);
        break;
      }
    }
    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const listMatch = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
    const headingMatch = line.match(/^#{1,4}\s+(.*)/);

    if (listMatch) {
      inList = true;
      listItems.push(<li key={`li-${listItems.length}`}>{parseInline(listMatch[1])}</li>);
    } else {
      flushList();
      if (headingMatch) {
        elements.push(
          <h4 key={`h-${i}`} className="text-[15px] font-semibold my-2">
            {parseInline(headingMatch[1])}
          </h4>
        );
      } else if (line.trim()) {
        elements.push(
          <p key={`p-${i}`} className="my-1 leading-relaxed">
            {parseInline(line)}
          </p>
        );
      }
    }
  }
  flushList();

  return elements;
}

export const Message: React.FC<MessageProps> = ({
  message: m,
  index: i,
  isLast,
  onChipClick,
  onExplain,
  onRetry,
  onNewTopic,
  onDismissOutOfContext,
  onSaveMemory,
  onDismissMemory,
}) => {
  if (m.r === "u") {
    return <div className="msg u">{m.t}</div>;
  }

  if (m.r === "s") {
    return <div className="note">{m.t}</div>;
  }

  if (m.r === "e") {
    return (
      <div className="note" role="alert">
        The request failed. Your message is still here.{" "}
        <button type="button" className="btn ml-2" onClick={() => onRetry(i)}>
          Try again
        </button>
      </div>
    );
  }

  if (m.r === "o") {
    return (
      <div className="note">
        <b>Out of context</b> for this project — want to start a separate topic?
        <div className="chips">
          <button type="button" onClick={() => onNewTopic(i)}>
            New topic
          </button>
          <button type="button" onClick={() => onDismissOutOfContext(i)}>
            Continue project
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="msg a">{renderMarkdown(m.t || "")}</div>

      {m.mem && (
        <div className="note">
          Remember this? “{m.mem}”
          <div className="chips">
            <button type="button" onClick={() => onSaveMemory(i)}>
              Save to memory
            </button>
            <button type="button" onClick={() => onDismissMemory(i)}>
              No thanks
            </button>
          </div>
        </div>
      )}

      {isLast && (m.f || (m.c && m.c.length > 0)) && (
        <div className="fu">
          {m.f && <div className="mb-2">{m.f}</div>}
          {m.c && m.c.length > 0 && (
            <div className="chips">
              {m.c.map((chip, cIdx) => (
                <button
                  key={cIdx}
                  type="button"
                  onClick={() => onChipClick(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isLast && !m.x && (
        <div className="chips" style={{ margin: "-12px 0 24px" }}>
          <button type="button" onClick={onExplain}>
            Explain
          </button>
        </div>
      )}
    </>
  );
};
