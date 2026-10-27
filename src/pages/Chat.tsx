import React, { useState, useEffect, useRef } from "react";
import { Message, ChatMessage } from "../components/Message";
import { Composer } from "../components/Composer";
import { ConfirmModal } from "../components/ConfirmModal";
import { PermissionModal } from "../components/PermissionModal";
import { askAi } from "../lib/ai";
import {
  Profile,
  Task,
  getTasks,
  createMemory,
  createPendingAction,
  logActivity,
} from "../lib/data";

interface ChatProps {
  profile: Profile | null;
  onResetRef?: React.MutableRefObject<(() => void) | null>;
}

type ModalState =
  | {
      type: "send_message";
      actionId: string;
      to: string;
      body: string;
    }
  | {
      type: "read_data";
      actionId: string;
      source: string;
      why: string;
    }
  | null;

const STARTER_CHIPS = [
  "I’m thinking about starting a real estate project.",
  "What should I consider before buying an apartment?",
];

export const Chat: React.FC<ChatProps> = ({ profile, onResetRef }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("yai_chat");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState(false);
  const [scopeOff, setScopeOff] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalState>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync tasks on mount
  useEffect(() => {
    getTasks()
      .then(setTasks)
      .catch((err) => console.error("Failed to load tasks:", err));
  }, []);

  // Save chat to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("yai_chat", JSON.stringify(messages.slice(-60)));
    } catch {}
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  // Provide new chat handler to parent
  useEffect(() => {
    if (onResetRef) {
      onResetRef.current = () => {
        setMessages([]);
        setScopeOff(false);
      };
    }
    return () => {
      if (onResetRef) onResetRef.current = null;
    };
  }, [onResetRef]);

  const activeProjects = tasks.filter((t) => t.use_as_context && !t.done);
  const projectContextSummary = activeProjects.map((t) => t.title).join(", ");

  const handleSend = async (rawText: string, forcedScopeOff = scopeOff) => {
    const text = rawText.trim();
    if (!text || busy) return;

    setBusy(true);

    // Filter out existing out-of-context notices
    const baseMessages = messages.filter((m) => m.r !== "o");
    const nextMessages: ChatMessage[] = [...baseMessages, { r: "u", t: text }];
    setMessages(nextMessages);

    try {
      // Build history for askAi
      const history = nextMessages
        .slice(-11, -1)
        .filter((m) => m.r === "u" || m.r === "a")
        .map((m) => ({
          role: (m.r === "u" ? "user" : "assistant") as "user" | "assistant",
          text: m.t || "",
        }));

      const reply = await askAi(text, history, forcedScopeOff);

      if (reply.scope === "out" && activeProjects.length > 0 && !forcedScopeOff) {
        setMessages((prev) => [...prev, { r: "o", q: text }]);
      } else {
        const isExplanation = /^\s*(explain|go deeper)/i.test(text);
        setMessages((prev) => [
          ...prev,
          {
            r: "a",
            t: String(reply.answer || ""),
            f: reply.followup || null,
            c: (reply.chips || []).slice(0, 3),
            mem: reply.memory || null,
            x: isExplanation,
          },
        ]);

        // Process actions
        if (reply.action) {
          if (reply.action.type === "send_message") {
            const payload = {
              to: String(reply.action.to || ""),
              body: String(reply.action.body || ""),
            };
            const pending = await createPendingAction("send_message", payload);
            setActiveModal({
              type: "send_message",
              actionId: pending.id,
              to: payload.to,
              body: payload.body,
            });
          } else if (reply.action.type === "read_data") {
            const payload = {
              source: String(reply.action.source || "your data"),
              why: String(reply.action.why || ""),
            };
            const pending = await createPendingAction("read_data", payload);
            setActiveModal({
              type: "read_data",
              actionId: pending.id,
              source: payload.source,
              why: payload.why,
            });
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { r: "e", q: text }]);
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = (idx: number) => {
    const query = messages[idx]?.q;
    if (!query) return;
    // Remove the error message and the previous user message
    const updated = [...messages];
    updated.splice(idx - 1, 2);
    setMessages(updated);
    handleSend(query);
  };

  const handleNewTopic = (idx: number) => {
    const query = messages[idx]?.q;
    if (!query) return;
    setMessages([]);
    setScopeOff(true);
    handleSend(query, true);
  };

  const handleDismissOutOfContext = (idx: number) => {
    setMessages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveMemory = async (idx: number) => {
    const memText = messages[idx]?.mem;
    if (!memText) return;
    try {
      await createMemory(memText, "ai_approved");
      await logActivity(`Saved memory: ${memText}`);
      setMessages((prev) =>
        prev.map((m, i) => (i === idx ? { ...m, mem: null } : m))
      );
    } catch (err) {
      console.error("Failed to save memory:", err);
    }
  };

  const handleDismissMemory = (idx: number) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, mem: null } : m))
    );
  };

  const handleConfirmApprove = (to: string) => {
    setActiveModal(null);
    setMessages((prev) => [
      ...prev,
      {
        r: "s",
        t: `Approved: message to ${to}. Demo only, nothing was actually sent.`,
      },
    ]);
  };

  const handleConfirmCancel = () => {
    setActiveModal(null);
    setMessages((prev) => [
      ...prev,
      { r: "s", t: "Cancelled. Nothing was done." },
    ]);
  };

  const handlePermissionAllow = (source: string) => {
    setActiveModal(null);
    setMessages((prev) => [
      ...prev,
      {
        r: "s",
        t: `Access to ${source} allowed once. This prototype has no connectors, so nothing was read.`,
      },
    ]);
  };

  const handlePermissionDeny = () => {
    setActiveModal(null);
    setMessages((prev) => [
      ...prev,
      { r: "s", t: "Cancelled. Nothing was done." },
    ]);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="cw">
      <div className="pg" id="sc" ref={scrollRef}>
        <div className="col">
          {isEmpty ? (
            <>
              <h1>
                What’s on your mind{profile?.name ? `, ${profile.name}` : ""}?
              </h1>
              <p className="mu">
                Ask a question, explore an idea, or continue a project.
              </p>
              <div className="chips">
                {STARTER_CHIPS.map((chip, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </>
          ) : (
            messages.map((m, i) => (
              <Message
                key={i}
                message={m}
                index={i}
                isLast={i === messages.length - 1}
                onChipClick={handleSend}
                onExplain={() => handleSend("explain")}
                onRetry={handleRetry}
                onNewTopic={handleNewTopic}
                onDismissOutOfContext={handleDismissOutOfContext}
                onSaveMemory={handleSaveMemory}
                onDismissMemory={handleDismissMemory}
              />
            ))
          )}

          {busy && (
            <p className="mu" role="status" aria-live="polite">
              Thinking…
            </p>
          )}
        </div>
      </div>

      <Composer
        busy={busy}
        projectContextSummary={projectContextSummary}
        onSend={handleSend}
      />

      {/* Confirmation Modals */}
      {activeModal?.type === "send_message" && (
        <ConfirmModal
          initialActionId={activeModal.actionId}
          initialTo={activeModal.to}
          initialBody={activeModal.body}
          onApproveSuccess={handleConfirmApprove}
          onCancel={handleConfirmCancel}
        />
      )}

      {activeModal?.type === "read_data" && (
        <PermissionModal
          actionId={activeModal.actionId}
          source={activeModal.source}
          why={activeModal.why}
          onAllowSuccess={handlePermissionAllow}
          onDeny={handlePermissionDeny}
        />
      )}
    </div>
  );
};
