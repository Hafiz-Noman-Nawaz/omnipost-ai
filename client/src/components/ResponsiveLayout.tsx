"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { NAV_ITEMS } from "@/components/navigation";
import LogoutButton from "@/components/LogoutButton";
import CommandBar from "@/components/CommandBar";

interface ResponsiveLayoutProps {
  user: {
    email: string;
    role: string;
    name?: string | null;
  };
  children: React.ReactNode;
}

export default function ResponsiveLayout({ user, children }: ResponsiveLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const activeItem = NAV_ITEMS.find((item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)));

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-[var(--border)] bg-[var(--panel)] backdrop-blur-xl p-5 sticky top-0 h-screen z-20">
        {/* Brand header */}
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-gradient)] flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/25">
            ⚡
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              OmniPost
              <span className="badge badge-accent text-[10px] px-1.5 py-0.5">AI</span>
            </div>
            <div className="text-xs text-[var(--muted)]">Automation Agent</div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-indigo-600/20 text-white font-medium border border-indigo-500/30 shadow-sm"
                    : "text-[var(--muted)] hover:text-white hover:bg-[var(--panel-hover)]"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-base">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.href === "/agent" ? (
                  <span className="badge badge-accent text-[10px] px-1.5 py-0">AI</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* User Card in desktop sidebar */}
        <div className="pt-4 mt-auto border-t border-[var(--border)]">
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--panel-2)] border border-[var(--border)]">
            <div className="truncate text-xs">
              <div className="font-semibold text-white truncate">{user.name ?? user.email.split("@")[0]}</div>
              <div className="text-[var(--muted)] truncate text-[11px]">{user.email}</div>
            </div>
            <span className="badge badge-ok text-[10px] px-1.5 shrink-0">{user.role}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--border)] px-4 sm:px-6 py-3.5 bg-[var(--panel)] backdrop-blur-xl">
          {/* Mobile brand & toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="md:hidden p-2 -ml-1 text-[var(--muted)] hover:text-white rounded-lg hover:bg-[var(--panel-hover)] transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white md:text-base">
                {activeItem?.label ?? "OmniPost Agent"}
              </span>
              <span className="hidden sm:inline-flex badge badge-ok text-[10px]">Active</span>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            <CommandBar />
            <span className="hidden lg:inline text-xs text-[var(--muted)]">
              Personal automation platform · Phase 12 (All Phases Operational)
            </span>
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-[var(--border)]">
              <span className="text-xs text-[var(--muted)] truncate max-w-[150px]">{user.email}</span>
            </div>
            <LogoutButton />
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[var(--panel-solid)] border-r border-[var(--border)] p-5 z-50">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent-gradient)] flex items-center justify-center text-white font-bold">
                    ⚡
                  </div>
                  <span className="font-bold text-white">OmniPost Agent</span>
                </div>
                <button
                  type="button"
                  className="p-1.5 text-[var(--muted)] hover:text-white rounded-lg hover:bg-[var(--panel-hover)]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  ✕
                </button>
              </div>

              <nav className="flex-1 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm ${
                        isActive
                          ? "bg-indigo-600/20 text-white font-medium border border-indigo-500/30"
                          : "text-[var(--muted)] hover:text-white hover:bg-[var(--panel-hover)]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-[var(--border)] text-xs text-[var(--muted)] flex items-center justify-between">
                <span>{user.email}</span>
                <span className="badge badge-ok">{user.role}</span>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--panel-solid)]/95 backdrop-blur-xl border-t border-[var(--border)] px-2 py-2 flex items-center justify-around">
          <Link
            href="/dashboard"
            className={`flex flex-col items-center gap-0.5 text-[10px] ${
              pathname === "/dashboard" ? "text-indigo-400 font-semibold" : "text-[var(--muted)]"
            }`}
          >
            <span className="text-base">📊</span>
            <span>Home</span>
          </Link>
          <Link
            href="/content"
            className={`flex flex-col items-center gap-0.5 text-[10px] ${
              pathname.startsWith("/content") ? "text-indigo-400 font-semibold" : "text-[var(--muted)]"
            }`}
          >
            <span className="text-base">📁</span>
            <span>Vault</span>
          </Link>
          <Link
            href="/campaigns"
            className={`flex flex-col items-center gap-0.5 text-[10px] ${
              pathname.startsWith("/campaigns") ? "text-indigo-400 font-semibold" : "text-[var(--muted)]"
            }`}
          >
            <span className="text-base">🎯</span>
            <span>Campaigns</span>
          </Link>
          <Link
            href="/calendar"
            className={`flex flex-col items-center gap-0.5 text-[10px] ${
              pathname.startsWith("/calendar") ? "text-indigo-400 font-semibold" : "text-[var(--muted)]"
            }`}
          >
            <span className="text-base">📅</span>
            <span>Calendar</span>
          </Link>
          <Link
            href="/approvals"
            className={`flex flex-col items-center gap-0.5 text-[10px] ${
              pathname.startsWith("/approvals") ? "text-indigo-400 font-semibold" : "text-[var(--muted)]"
            }`}
          >
            <span className="text-base">🛡️</span>
            <span>Approvals</span>
          </Link>
          <Link
            href="/settings"
            className={`flex flex-col items-center gap-0.5 text-[10px] ${
              pathname.startsWith("/settings") ? "text-indigo-400 font-semibold" : "text-[var(--muted)]"
            }`}
          >
            <span className="text-base">⚙️</span>
            <span>Settings</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
