import React, { useState } from "react";
import { supabase } from "../lib/supabase";

interface AuthProps {
  onDemoLogin?: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onDemoLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          // Immediately signed in
        } else {
          setInfoMsg("Check your email for the confirmation link to complete registration.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          "Authentication failed. Check your Supabase connection in .env or try Demo Mode below."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pg flex items-center justify-center min-h-screen">
      <div className="col max-w-sm">
        <h1 className="text-3xl font-semibold mb-2">Your AI</h1>
        <p className="mu mb-6">
          {isSignUp
            ? "Create an account to start your personal AI assistant."
            : "Sign in to your personal AI assistant."}
        </p>

        {errorMsg && (
          <div
            className="note mb-4"
            role="alert"
            style={{ borderColor: "#e57373", color: "#c62828" }}
          >
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="note mb-4" role="status">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              required
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn pri mt-2 w-full py-2.5"
            disabled={loading}
          >
            {loading ? "Processing…" : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center flex flex-col gap-3">
          <button
            type="button"
            className="btn text-xs text-[var(--mu)]"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
              setInfoMsg(null);
            }}
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Create one"}
          </button>

          {onDemoLogin && (
            <div className="pt-4 border-t border-[var(--bd)] mt-2">
              <p className="mu text-xs mb-2">No Supabase account configured yet?</p>
              <button
                type="button"
                className="btn w-full py-2 text-sm"
                onClick={onDemoLogin}
              >
                Continue in Demo Mode →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
