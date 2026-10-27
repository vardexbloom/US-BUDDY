import React, { useState, useEffect } from "react";
import {
  updatePendingAction,
  executeAction,
  logActivity,
  hashPayload,
} from "../lib/data";

interface PermissionModalProps {
  actionId: string;
  source: string;
  why: string;
  onAllowSuccess: (source: string) => void;
  onDeny: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({
  actionId,
  source,
  why,
  onAllowSuccess,
  onDeny,
}) => {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        handleDeny();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, actionId, source]);

  const handleDeny = async () => {
    setBusy(true);
    try {
      if (actionId) {
        await updatePendingAction(actionId, { status: "cancelled" });
      }
      await logActivity(`Denied access to ${source}`);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
      onDeny();
    }
  };

  const handleAllowOnce = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      const payload = { source, why };
      const computedHash = await hashPayload(payload);

      // 1. Approve row in pending_actions
      await updatePendingAction(actionId, {
        status: "approved",
        approved_hash: computedHash,
      });

      // 2. Execute action edge function
      await executeAction(actionId, payload);

      await logActivity(`Allowed one-time access to ${source} (no connector, nothing read)`);
      onAllowSuccess(source);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to execute permission grant");
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
        <h2>Allow access?</h2>
        <p>
          Your AI is asking to look at: <b>{source}</b>
        </p>
        <p className="mu">Why: {why || "not stated"}</p>
        <p className="mu">
          Only for this request. This prototype has no connectors, so nothing would
          actually be read.
        </p>

        {errorMessage && (
          <div
            className="note"
            role="alert"
            style={{ borderColor: "#e57373", color: "#c62828" }}
          >
            {errorMessage}
          </div>
        )}

        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={handleDeny}
            disabled={busy}
          >
            Deny
          </button>
          <button
            type="button"
            className="btn pri"
            onClick={handleAllowOnce}
            disabled={busy}
          >
            {busy ? "Processing…" : "Allow once"}
          </button>
        </div>
      </div>
    </div>
  );
};
