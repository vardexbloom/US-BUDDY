import React, { useState, useEffect } from "react";
import {
  createPendingAction,
  updatePendingAction,
  executeAction,
  logActivity,
  hashPayload,
} from "../lib/data";

interface ConfirmModalProps {
  initialActionId: string;
  initialTo: string;
  initialBody: string;
  onApproveSuccess: (to: string, hash: string) => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  initialActionId,
  initialTo,
  initialBody,
  onApproveSuccess,
  onCancel,
}) => {
  const [actionId, setActionId] = useState(initialActionId);
  const [to, setTo] = useState(initialTo);
  const [body, setBody] = useState(initialBody);
  const [isEditing, setIsEditing] = useState(false);
  const [currentHash, setCurrentHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    hashPayload({ to: initialTo, body: initialBody }).then(setCurrentHash);
  }, [initialTo, initialBody]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, actionId, to]);

  const handleReviewChanges = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      const newPayload = { to: to.trim(), body: body.trim() };
      const newHash = await hashPayload(newPayload);

      // Requirement: Editing the draft creates a new pending row
      const newAction = await createPendingAction("send_message", newPayload);
      setActionId(newAction.id);
      setCurrentHash(newHash);
      setIsEditing(false);
      await logActivity("Edited message draft", {
        previousActionId: actionId,
        newActionId: newAction.id,
        newHash,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update draft");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      if (actionId) {
        await updatePendingAction(actionId, { status: "cancelled" });
      }
      await logActivity(`Cancelled message to ${to}`);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
      onCancel();
    }
  };

  const handleApprove = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      const payload = { to: to.trim(), body: body.trim() };
      const computedHash = await hashPayload(payload);

      // 1. Approve in pending_actions with approved_hash
      await updatePendingAction(actionId, {
        status: "approved",
        approved_hash: computedHash,
      });

      // 2. Call execute-action edge function
      await executeAction(actionId, payload);

      await logActivity(`Approved message to ${to} (version ${computedHash.slice(0, 8)}), simulated`);
      onApproveSuccess(to, computedHash);
    } catch (err: any) {
      setErrorMessage(err.message || "Execution refused or failed");
      setBusy(false);
    }
  };

  return (
    <div className="ov">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Confirmation required"
      >
        <h2>Send this message?</h2>
        <p className="mu">Nothing is sent until you approve this exact version.</p>

        {errorMessage && (
          <div className="note" role="alert" style={{ borderColor: "#e57373", color: "#c62828" }}>
            {errorMessage}
          </div>
        )}

        <dl>
          <dt>Action</dt>
          <dd>Send a message</dd>

          <dt>Recipient</dt>
          <dd>
            {isEditing ? (
              <input
                id="mto"
                aria-label="Recipient"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={busy}
              />
            ) : (
              to
            )}
          </dd>

          <dt>Content</dt>
          <dd>
            {isEditing ? (
              <textarea
                id="mbd"
                aria-label="Message"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={busy}
              />
            ) : (
              <div className="draft">{body}</div>
            )}
          </dd>

          <dt>Consequence</dt>
          <dd>The recipient gets exactly this text. This prototype only simulates sending.</dd>
        </dl>

        <div className="row">
          {isEditing ? (
            <button
              type="button"
              className="btn"
              onClick={handleReviewChanges}
              disabled={busy}
            >
              Review changes
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => setIsEditing(true)}
              disabled={busy}
            >
              Edit draft
            </button>
          )}

          <button
            type="button"
            className="btn"
            onClick={handleCancel}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn pri"
            onClick={handleApprove}
            disabled={isEditing || busy}
          >
            {busy ? "Processing…" : "Approve and send"}
          </button>
        </div>
      </div>
    </div>
  );
};
