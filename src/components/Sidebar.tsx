import React from "react";

export type NavPage = "chat" | "memory" | "tasks" | "inbox" | "profile";

interface SidebarProps {
  currentPage: NavPage;
  isOpen: boolean;
  onNavigate: (page: NavPage) => void;
  onClose: () => void;
}

const NAV_ITEMS: { id: NavPage; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "memory", label: "Memory" },
  { id: "tasks", label: "Projects" },
  { id: "inbox", label: "Inbox" },
  { id: "profile", label: "Profile" },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  isOpen,
  onNavigate,
  onClose,
}) => {
  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="scrim"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}
      <aside className={isOpen ? "open" : ""}>
        <div className="logo text-lg font-semibold tracking-tight">Your AI</div>
        {NAV_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="nav"
            aria-current={currentPage === id ? "page" : undefined}
            onClick={() => {
              onNavigate(id);
              onClose();
            }}
          >
            {label}
          </button>
        ))}
      </aside>
    </>
  );
};
