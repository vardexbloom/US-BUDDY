import React, { useState } from "react";
import { updateProfile, createMemory, logActivity, Profile } from "../lib/data";

interface OnboardingProps {
  initialProfile?: Profile | null;
  onComplete: (profile: Profile) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({
  initialProfile,
  onComplete,
}) => {
  const [name, setName] = useState(initialProfile?.name || "");
  const [style, setStyle] = useState<"concise" | "balanced" | "detailed">(
    initialProfile?.style || "balanced"
  );
  const [goals, setGoals] = useState(initialProfile?.goals || "");
  const [timezone, setTimezone] = useState(
    initialProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );
  const [quietStart, setQuietStart] = useState(
    initialProfile?.quiet_start || "22:00"
  );
  const [quietEnd, setQuietEnd] = useState(
    initialProfile?.quiet_end || "07:00"
  );
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);

    try {
      // 1. Update profiles table
      const updated = await updateProfile({
        name: name.trim() || null,
        style,
        goals: goals.trim() || null,
        timezone: timezone.trim() || null,
        quiet_start: quietStart,
        quiet_end: quietEnd,
        onboarded: true,
      });

      // 2. Add onboarding memories for style and goals
      await createMemory(`Prefers ${style} answers`, "onboarding");
      if (goals.trim()) {
        await createMemory(`Goals: ${goals.trim()}`, "onboarding");
      }

      // 3. Log activity
      await logActivity("Completed onboarding", {
        name: name.trim(),
        style,
      });

      onComplete(updated);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save profile settings");
      setBusy(false);
    }
  };

  return (
    <main style={{ height: "100%", overflow: "auto", padding: "32px 16px" }}>
      <div className="col">
        <h1>Welcome. Let’s set you up.</h1>
        <p className="mu">
          A few preferences so answers fit you. You can change or delete everything later.
        </p>

        {errorMsg && (
          <div className="note" role="alert" style={{ borderColor: "#e57373", color: "#c62828" }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4">
          <label htmlFor="pn">Name</label>
          <input
            id="pn"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
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
            placeholder="What are your current goals or focus areas?"
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
              {busy ? "Saving…" : "Get started"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
