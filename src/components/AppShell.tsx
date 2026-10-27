import React, { useState } from "react";
import { Sidebar, NavPage } from "./Sidebar";
import { supabase } from "../lib/supabase";

interface AppShellProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  onNewChat?: () => void;
  children: React.ReactNode;
}

const PAGE_TITLES: Record<NavPage, string> = {
  chat: "Chat",
  memory: "Memory",
  tasks: "Projects",
  inbox: "Inbox",
  profile: "Profile",
};

export const AppShell: React.FC<AppShellProps> = ({
  currentPage,
  onNavigate,
  onNewChat,
  children,
}) => {
  const [isNavOpen, setIsNavOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="app">
      <Sidebar
        currentPage={currentPage}
        isOpen={isNavOpen}
        onNavigate={onNavigate}
        onClose={() => setIsNavOpen(false)}
      />

      <main>
        <header>
          <button
            type="button"
            className="btn menu"
            onClick={() => setIsNavOpen(!isNavOpen)}
            aria-label="Open navigation"
          >
            Menu
          </button>
          <span>{PAGE_TITLES[currentPage]}</span>
          <span className="sp" />
          {currentPage === "chat" && onNewChat && (
            <button
              type="button"
              className="btn"
              onClick={onNewChat}
            >
              New chat
            </button>
          )}
          <button
            type="button"
            className="btn text-xs text-[var(--mu)] hover:text-[var(--tx)] ml-2"
            onClick={handleSignOut}
            title="Sign out of account"
          >
            Sign out
          </button>
        </header>

        {children}
      </main>
    </div>
  );
};
