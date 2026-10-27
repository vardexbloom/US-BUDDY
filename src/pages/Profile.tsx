import React, { useState, useEffect } from "react";
import {
  Profile as ProfileType,
  updateProfile,
  resetAllUserData,
  logActivity,
} from "../lib/data";

interface ProfileProps {
  profile: ProfileType | null;
  onProfileUpdate: (updated: ProfileType) => void;
  onResetData: () => void;
  theme: "auto" | "light" | "dark";
  onThemeChange: (theme: "auto" | "light" | "dark") => void;
}

export const Profile: React.FC<ProfileProps> = ({
  profile,
  onProfileUpdate,
  onResetData,
  theme,
  onThemeChange,
}) => {
  const [name, setName] = useState(profile?.name || "");
  const [style, setStyle] = useState<"concise" | "balanced" | "detailed">(
    profile?.style || "balanced"
  );
  const [goals, setGoals] = useState(profile?.goals || "");
  const [timezone, setTimezone] = useState(
    profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );
  const [quietStart, setQuietStart] = useState(
    profile?.quiet_start || "22:00"
  );
  const [quietEnd, setQuietEnd] = useState(
    profile?.quiet_end || "07:00"
  );
  const [busy, setBusy] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setStyle(profile.style || "balanced");
      setGoals(profile.goals || "");
      setTimezone(profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      setQuietStart(profile.quiet_start || "22:00");
      setQuietEnd(profile.quiet_end || "07:00");
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const updated = await updateProfile({
        name: name.trim() || null,
        style,
        goals: goals.trim() || null,
        timezone: timezone.trim() || null,
        quiet_start: quietStart,
        quiet_end: quietEnd,
      });

      await logActivity("Updated profile", { name: name.trim(), style });
      onProfileUpdate(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update profile");
    } finally {
      setBusy(false);
    }
  };

  const handleResetData = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }

    setBusy(true);
    try {
      await resetAllUserData();
      localStorage.removeItem("yai_chat");
      onResetData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to erase data");
      setBusy(false);
      setResetConfirm(false);
    }
  };

  return (
    <div className="pg">
      <div className="col">
        <h1>Profile</h1>
        <p className="mu">Preferences used to shape answers.</p>

        {errorMsg && (
          <div className="note" role="alert" style={{ borderColor: "#e57373", color: "#c62828" }}>
            {errorMsg}
          </div>
        )}

        {saveSuccess && (
          <div className="note" role="status">
            Profile saved successfully.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4">
          <label htmlFor="pn">Name</label>
          <input
            id="pn"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label htmlFor="ps">Communication style</label>
          <select
            id="ps"
            name="style"
            value={style}
            onChange={(e) =>
              setStyle(e.target.value as "concise" | "balanced" | "detailed")
            }
          >
            <option value="concise">concise</option>
            <option value="balanced">balanced</option>
            <option value="detailed">detailed</option>
          </select>

          <label htmlFor="pg">Goals</label>
          <textarea
            id="pg"
            name="goals"
            rows={3}
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
          />

          <label htmlFor="pt">Timezone</label>
          <input
            id="pt"
            name="tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />

          <div className="row">
            <div className="grow">
              <label htmlFor="q1">Quiet hours start</label>
              <input
                id="q1"
                type="time"
                name="qs"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
              />
            </div>
            <div className="grow">
              <label htmlFor="q2">Quiet hours end</label>
              <input
                id="q2"
                type="time"
                name="qe"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="row" style={{ marginTop: "16px" }}>
            <button type="submit" className="btn pri" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>

        <h4>Theme</h4>
        <div className="row">
          {(["auto", "light", "dark"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className="btn capitalize"
              aria-pressed={theme === t}
              onClick={() => onThemeChange(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <h4>Your data</h4>
        <button
          type="button"
          className="btn"
          style={{
            borderColor: resetConfirm ? "#e57373" : undefined,
            color: resetConfirm ? "#c62828" : undefined,
          }}
          disabled={busy}
          onClick={handleResetData}
        >
          {resetConfirm ? "Click again to erase everything" : "Erase all data"}
        </button>
      </div>
    </div>
  );
};
