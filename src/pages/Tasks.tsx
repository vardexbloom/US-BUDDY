import React, { useState, useEffect } from "react";
import {
  Task as TaskType,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  logActivity,
} from "../lib/data";

export const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  const loadTasks = async () => {
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;

    try {
      const created = await createTask(t, notes.trim() || undefined);
      await logActivity(`Added task: ${t}`, { title: t, notes: notes.trim() });
      setTasks((prev) => [created, ...prev]);
      setTitle("");
      setNotes("");
    } catch (err) {
      console.error("Failed to add task:", err);
    }
  };

  const handleToggleContext = async (id: string, currentContext: boolean) => {
    try {
      const updated = await updateTask(id, { use_as_context: !currentContext });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, use_as_context: updated.use_as_context } : t
        )
      );
    } catch (err) {
      console.error("Failed to toggle context:", err);
    }
  };

  const handleToggleDone = async (id: string, currentDone: boolean) => {
    try {
      const updated = await updateTask(id, { done: !currentDone });
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, done: updated.done } : t))
      );
    } catch (err) {
      console.error("Failed to toggle task done:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTask(id);
      await logActivity("Deleted task", { id });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  return (
    <div className="pg">
      <div className="col">
        <h2>Projects &amp; tasks</h2>
        <p className="mu">
          Items marked “Use as context” tell your AI what the current project is.
        </p>

        <form onSubmit={handleAdd} className="mt-4">
          <input
            aria-label="Title"
            placeholder="e.g. Real estate project, Whitefield"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            rows={2}
            aria-label="Notes"
            placeholder="Notes (optional)"
            style={{ marginTop: "8px" }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="row" style={{ marginTop: "8px" }}>
            <button
              type="submit"
              className="btn pri"
              disabled={!title.trim()}
            >
              Add
            </button>
          </div>
        </form>

        <div style={{ height: "16px" }} />

        {loading ? (
          <p className="mu">Loading projects &amp; tasks…</p>
        ) : tasks.length > 0 ? (
          tasks.map((t) => (
            <div key={t.id} className="card">
              <div className="row">
                <span
                  className="grow"
                  style={{
                    textDecoration: t.done ? "line-through" : "none",
                    opacity: t.done ? 0.6 : 1,
                  }}
                >
                  <b>{t.title}</b>
                  {t.notes && (
                    <>
                      <br />
                      <span className="mu">{t.notes}</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="btn"
                  aria-pressed={t.use_as_context}
                  onClick={() => handleToggleContext(t.id, t.use_as_context)}
                >
                  {t.use_as_context ? "In context" : "Use as context"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleToggleDone(t.id, t.done)}
                >
                  {t.done ? "Reopen" : "Done"}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleDelete(t.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="mu">Nothing here yet.</p>
        )}
      </div>
    </div>
  );
};
