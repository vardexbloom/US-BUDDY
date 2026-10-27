import React, { useState, useEffect } from "react";
import {
  Profile,
  Notification,
  ActivityLog,
  getNotifications,
  createNotification,
  updateNotificationFeedback,
  dismissNotification,
  getActivityLogs,
  logActivity,
} from "../lib/data";
import { askAi } from "../lib/ai";

interface InboxProps {
  profile: Profile | null;
}

function isQuietHours(startStr: string, endStr: string): boolean {
  if (!startStr || !endStr) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startStr.split(":").map(Number);
  const [endH, endM] = endStr.split(":").map(Number);

  const startMin = (startH || 0) * 60 + (startM || 0);
  const endMin = (endH || 0) * 60 + (endM || 0);

  if (startMin <= endMin) {
    return currentMinutes >= startMin && currentMinutes < endMin;
  } else {
    // Overnight (e.g. 22:00 to 07:00)
    return currentMinutes >= startMin || currentMinutes < endMin;
  }
}

export const Inbox: React.FC<InboxProps> = ({ profile }) => {
  const [tab, setTab] = useState<"b" | "l">("b");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const quietStart = profile?.quiet_start || "22:00";
  const quietEnd = profile?.quiet_end || "07:00";

  const loadData = async () => {
    try {
      const [notifs, logs] = await Promise.all([
        getNotifications(),
        getActivityLogs(50),
      ]);
      setNotifications(notifs);
      setActivityLogs(logs);
    } catch (err) {
      console.error("Failed to load inbox data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateBriefing = async () => {
    setBusy(true);
    setStatusMsg("");

    try {
      const inQuiet = isQuietHours(quietStart, quietEnd);
      const prompt = `Return 1 to 3 short, genuinely useful proactive suggestions based on my active projects and profile.
Format each suggestion as:
Title: <short title>
Body: <concise description>`;

      const res = await askAi(prompt, [], true);
      const answer = res.answer || "";

      // Parse suggestions from response
      const items: { title: string; body: string }[] = [];
      const sections = answer.split(/\n\s*\n/);

      for (const section of sections) {
        const titleMatch = section.match(/(?:Title:|\*\*|##)\s*(.+?)(?:\*\*|\n|$)/i);
        const title = titleMatch ? titleMatch[1].replace(/[*#]/g, "").trim() : "";
        const bodyLines = section
          .split("\n")
          .filter((l) => !l.match(/^(?:Title:|\*\*|##)/i))
          .join(" ")
          .trim();

        if (title && (bodyLines || section)) {
          items.push({
            title: title.slice(0, 80),
            body: (bodyLines || section).slice(0, 300),
          });
        }
        if (items.length >= 3) break;
      }

      if (items.length === 0 && answer.trim()) {
        items.push({
          title: "Proactive Briefing",
          body: answer.trim().slice(0, 300),
        });
      }

      const createdList: Notification[] = [];
      for (const it of items) {
        const notif = await createNotification(it.title, it.body);
        createdList.push(notif);
      }

      await logActivity("Created a briefing", { count: items.length });
      setNotifications((prev) => [...createdList, ...prev]);

      if (items.length > 0) {
        setStatusMsg(
          inQuiet
            ? `Briefing created (Quiet hours active: ${quietStart}–${quietEnd}).`
            : ""
        );
      } else {
        setStatusMsg("Nothing useful to suggest yet. Add a project or memory first.");
      }
    } catch {
      setStatusMsg("Couldn’t create a briefing right now.");
    } finally {
      setBusy(false);
      // Refresh logs
      getActivityLogs(50).then(setActivityLogs).catch(() => {});
    }
  };

  const handleVote = async (id: string, voteType: "useful" | "unhelpful") => {
    const current = notifications.find((n) => n.id === id);
    if (!current) return;
    const nextVote = current.feedback === voteType ? null : voteType;

    try {
      await updateNotificationFeedback(id, nextVote);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, feedback: nextVote } : n))
      );
    } catch (err) {
      console.error("Failed to update feedback:", err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Failed to dismiss notification:", err);
    }
  };

  return (
    <div className="pg">
      <div className="col">
        <h2>Inbox</h2>
        <p className="mu">
          Briefings are created only when you ask. Quiet hours: {quietStart}–{quietEnd}.
        </p>

        <div className="tabs">
          <button
            type="button"
            className="btn"
            aria-pressed={tab === "b"}
            onClick={() => setTab("b")}
          >
            Briefings
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={tab === "l"}
            onClick={() => {
              setTab("l");
              getActivityLogs(50).then(setActivityLogs).catch(() => {});
            }}
          >
            Activity
          </button>
        </div>

        {tab === "b" ? (
          <>
            <div className="row" style={{ marginBottom: "16px" }}>
              <button
                type="button"
                className="btn pri"
                disabled={busy}
                onClick={handleGenerateBriefing}
              >
                {busy ? "Working…" : "Create briefing"}
              </button>
              {statusMsg && (
                <span className="mu" role="status">
                  {statusMsg}
                </span>
              )}
            </div>

            {loading ? (
              <p className="mu">Loading briefings…</p>
            ) : notifications.length > 0 ? (
              notifications.map((n) => (
                <div key={n.id} className="card">
                  <b>{n.title}</b>
                  <p style={{ margin: "4px 0 8px" }}>{n.body}</p>
                  <div className="row">
                    <button
                      type="button"
                      className="btn"
                      aria-pressed={n.feedback === "useful"}
                      onClick={() => handleVote(n.id, "useful")}
                    >
                      Useful
                    </button>
                    <button
                      type="button"
                      className="btn"
                      aria-pressed={n.feedback === "unhelpful"}
                      onClick={() => handleVote(n.id, "unhelpful")}
                    >
                      Not useful
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleDismiss(n.id)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="mu">No briefings yet.</p>
            )}
          </>
        ) : (
          <div>
            {activityLogs.length > 0 ? (
              activityLogs.map((l) => (
                <div key={l.id} className="card sm">
                  <span className="mu">
                    {new Date(l.created_at).toLocaleString()}
                  </span>
                  <br />
                  <span>{l.action}</span>
                </div>
              ))
            ) : (
              <p className="mu">No activity yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
