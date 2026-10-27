import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import { Profile as ProfileType, getProfile } from "./lib/data";
import { Auth } from "./pages/Auth";
import { Onboarding } from "./pages/Onboarding";
import { Chat } from "./pages/Chat";
import { Memory } from "./pages/Memory";
import { Tasks } from "./pages/Tasks";
import { Inbox } from "./pages/Inbox";
import { Profile } from "./pages/Profile";
import { AppShell } from "./components/AppShell";
import { NavPage } from "./components/Sidebar";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isDemoUser, setIsDemoUser] = useState(() => {
    return localStorage.getItem("yai_demo") === "true";
  });
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<NavPage>("chat");
  const [theme, setTheme] = useState<"auto" | "light" | "dark">(() => {
    try {
      return (localStorage.getItem("yai_theme") as any) || "auto";
    } catch {
      return "auto";
    }
  });

  const chatResetRef = useRef<(() => void) | null>(null);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.dataset.theme = "dark";
    } else if (theme === "light") {
      root.classList.remove("dark");
      root.dataset.theme = "light";
    } else {
      root.classList.remove("dark");
      root.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("yai_theme", theme);
    } catch {}
  }, [theme]);

  // Auth & Profile loader
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        if (isDemoUser) {
          const prof = await getProfile();
          if (mounted) {
            setProfile(prof);
            setSession({ user: { id: "demo-user", email: "demo@yourai.local" } });
          }
          return;
        }

        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setSession(currentSession);

        if (currentSession?.user) {
          const prof = await getProfile();
          if (mounted) setProfile(prof);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted || isDemoUser) return;
      setSession(newSession);
      if (newSession?.user) {
        try {
          const prof = await getProfile();
          if (mounted) setProfile(prof);
        } catch (err) {
          console.error("Error fetching profile on auth change:", err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isDemoUser]);

  const handleDemoLogin = async () => {
    localStorage.setItem("yai_demo", "true");
    setIsDemoUser(true);
    const prof = await getProfile();
    setProfile(prof);
    setSession({ user: { id: "demo-user", email: "demo@yourai.local" } });
  };

  const handleSignOut = async () => {
    localStorage.removeItem("yai_demo");
    setIsDemoUser(false);
    setSession(null);
    setProfile(null);
    try {
      await supabase.auth.signOut();
    } catch {}
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center h-screen">
        <p className="mu" role="status">
          Loading Your AI…
        </p>
      </main>
    );
  }

  // Not authenticated: show Auth screen
  if (!session && !isDemoUser) {
    return <Auth onDemoLogin={handleDemoLogin} />;
  }

  // Authenticated but not onboarded: show Onboarding screen
  if (!profile || !profile.onboarded) {
    return (
      <Onboarding
        initialProfile={profile}
        onComplete={(completedProfile) => {
          setProfile(completedProfile);
          setCurrentPage("chat");
        }}
      />
    );
  }

  // Authenticated & onboarded: Main AppShell with screens
  return (
    <AppShell
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      onNewChat={
        currentPage === "chat" ? () => chatResetRef.current?.() : undefined
      }
    >
      {currentPage === "chat" && (
        <Chat profile={profile} onResetRef={chatResetRef} />
      )}
      {currentPage === "memory" && <Memory />}
      {currentPage === "tasks" && <Tasks />}
      {currentPage === "inbox" && <Inbox profile={profile} />}
      {currentPage === "profile" && (
        <Profile
          profile={profile}
          onProfileUpdate={(updated) => setProfile(updated)}
          onResetData={handleSignOut}
          theme={theme}
          onThemeChange={setTheme}
        />
      )}
    </AppShell>
  );
}
