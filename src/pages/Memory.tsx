import React, { useState, useEffect } from "react";
import {
  Memory as MemoryType,
  getMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  logActivity,
} from "../lib/data";

export const Memory: React.FC = () => {
  const [memories, setMemories] = useState<MemoryType[]>([]);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [loading, setLoading] = useState(true);

  const loadMemories = async () => {
    try {
      const data = await getMemories();
      setMemories(data);
    } catch (err) {
      console.error("Failed to load memories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newContent.trim();
    if (!content) return;

    try {
      const created = await createMemory(content, "user");
      await logActivity("Added a memory", { content });
      setMemories((prev) => [created, ...prev]);
      setNewContent("");
    } catch (err) {
      console.error("Failed to add memory:", err);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const updated = await updateMemory(id, { active: !currentActive });
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, active: updated.active } : m))
      );
    } catch (err) {
      console.error("Failed to toggle memory:", err);
    }
  };

  const handleStartEdit = (m: MemoryType) => {
    setEditingId(m.id);
    setEditContent(m.content);
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) return;

    try {
      const updated = await updateMemory(id, { content: trimmed });
      await logActivity("Edited memory", { id, content: trimmed });
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: updated.content } : m))
      );
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update memory:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMemory(id);
      await logActivity("Deleted a memory", { id });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Failed to delete memory:", err);
    }
  };

  return (
    <div className="pg">
      <div className="col">
        <h2>Memory</h2>
        <p className="mu">
          Only active memories shape answers. Nothing is saved without your approval.
        </p>

        <form onSubmit={handleAdd} className="row" style={{ marginBottom: "16px" }}>
          <input
            className="grow"
            aria-label="New memory"
            placeholder="Add a preference or fact…"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
          />
          <button type="submit" className="btn pri" disabled={!newContent.trim()}>
            Add
          </button>
        </form>

        {loading ? (
          <p className="mu">Loading memories…</p>
        ) : memories.length > 0 ? (
          memories.map((m) => (
            <div key={m.id} className="card">
              <div className="row">
                {editingId === m.id ? (
                  <>
                    <input
                      className="grow"
                      id="ed"
                      aria-label="Edit memory"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn pri"
                      onClick={() => handleSaveEdit(m.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="grow"
                      style={{ opacity: m.active ? 1 : 0.5 }}
                    >
                      {m.content}
                    </span>
                    <button
                      type="button"
                      className="btn"
                      aria-pressed={m.active}
                      onClick={() => handleToggleActive(m.id, m.active)}
                    >
                      {m.active ? "Active" : "Off"}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleStartEdit(m)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => handleDelete(m.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="mu">No memories yet.</p>
        )}
      </div>
    </div>
  );
};
