"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/components/navigation";

interface ActionItem {
  id: string;
  category: "Navigation" | "Quick Action" | "Safety & Control";
  title: string;
  description: string;
  icon: string;
  badge?: string;
  href?: string;
  action?: () => void;
}

export default function CommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const actions: ActionItem[] = [
    // Quick Actions
    {
      id: "qa-agent",
      category: "Quick Action",
      title: "Ask Social Media Agent",
      description: "Give prompt or command to autonomous ReAct agent",
      icon: "🤖",
      badge: "AI",
      href: "/agent",
    },
    {
      id: "qa-schedule",
      category: "Quick Action",
      title: "Schedule or Dispatch Post",
      description: "Open publishing calendar and time slot picker",
      icon: "📅",
      href: "/calendar",
    },
    {
      id: "qa-content",
      category: "Quick Action",
      title: "Upload Asset to Vault",
      description: "Add image or video to Content Vault with SHA-256 deduplication",
      icon: "📁",
      href: "/content",
    },
    {
      id: "qa-approvals",
      category: "Quick Action",
      title: "Review Approval Queue",
      description: "Inspect posts awaiting human sign-off or safety check",
      icon: "🛡️",
      href: "/approvals",
    },
    {
      id: "qa-comments",
      category: "Quick Action",
      title: "Moderate Inbound Comments",
      description: "Review sentiment and escalate urgent inquiries",
      icon: "💬",
      href: "/comments",
    },
    // Safety & Control
    {
      id: "sc-killswitch",
      category: "Safety & Control",
      title: "Emergency Auto-Reply Kill-Switch",
      description: "Immediately halt or audit automated comment replies",
      icon: "🚨",
      badge: "Safety",
      href: "/automation",
    },
    {
      id: "sc-audit",
      category: "Safety & Control",
      title: "Audit Log & System Settings",
      description: "Inspect immutable audit log and rate limit counters",
      icon: "⚙️",
      href: "/settings",
    },
    // Navigation to all primary views
    ...NAV_ITEMS.map((item) => ({
      id: `nav-${item.href}`,
      category: "Navigation" as const,
      title: `Go to ${item.label}`,
      description: item.note ?? `Navigate to ${item.label} (Phase ${item.phase})`,
      icon: item.icon,
      badge: `P${item.phase}`,
      href: item.href,
    })),
  ];

  // Filter actions based on query
  const filtered = actions.filter((act) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      act.title.toLowerCase().includes(q) ||
      act.description.toLowerCase().includes(q) ||
      act.category.toLowerCase().includes(q)
    );
  });

  // Open / Close with keyboard shortcuts (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input on open & reset selected index
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle keyboard navigation inside the command bar
  const handleKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        executeItem(filtered[selectedIndex]);
      }
    }
  };

  const executeItem = (item: ActionItem) => {
    setIsOpen(false);
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <>
      {/* Top Bar Quick Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] hover:bg-[var(--panel-hover)] text-xs text-[var(--muted)] hover:text-white transition-all shadow-sm"
        title="Open Command Bar (Ctrl+K / Cmd+K)"
      >
        <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search or jump to...</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 font-mono text-[10px] bg-black/40 border border-white/10 px-1.5 py-0.5 rounded text-[var(--muted-dark)]">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div
            className="fixed inset-0"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-xl rounded-2xl bg-[var(--panel-solid)] border border-indigo-500/30 shadow-2xl shadow-indigo-950/50 overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-150">
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)] bg-[var(--panel)]">
              <svg className="w-5 h-5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyNav}
                placeholder="Type a command or search sections..."
                className="flex-1 bg-transparent text-sm text-white placeholder-[var(--muted)] outline-none"
              />
              <span className="text-[11px] text-[var(--muted-dark)] border border-white/10 rounded px-1.5 py-0.5 bg-black/30 font-mono">
                ESC
              </span>
            </div>

            {/* List Results */}
            <div className="max-h-96 overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--muted)]">
                  No commands or pages matching &ldquo;{query}&rdquo;
                </div>
              ) : (
                filtered.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => executeItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors ${
                        isSelected
                          ? "bg-indigo-600/25 border border-indigo-500/40 text-white"
                          : "text-[var(--text)] hover:bg-[var(--panel-hover)] border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="text-lg shrink-0">{item.icon}</span>
                        <div className="truncate">
                          <div className="text-xs font-semibold flex items-center gap-2">
                            <span>{item.title}</span>
                            {item.badge && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--muted)] truncate">
                            {item.description}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-[var(--muted-dark)] font-mono ml-2 shrink-0">
                        {item.category}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Bar */}
            <div className="px-4 py-2 border-t border-[var(--border)] bg-black/40 flex items-center justify-between text-[11px] text-[var(--muted-dark)]">
              <div className="flex items-center gap-2">
                <span>Navigate: <kbd className="font-mono bg-white/5 px-1 rounded">↑</kbd> <kbd className="font-mono bg-white/5 px-1 rounded">↓</kbd></span>
                <span>Select: <kbd className="font-mono bg-white/5 px-1 rounded">↵</kbd></span>
              </div>
              <span className="font-mono">OmniPost Command Palette</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
