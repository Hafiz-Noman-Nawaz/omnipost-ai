export interface NavItem {
  href: string;
  label: string;
  phase: number;
  icon: string;
  /** Optional phase note shown as a badge in the sidebar. */
  note?: string;
}

/**
 * Primary navigation (spec §24). Items whose phase has not landed render as
 * "Coming in Phase N" placeholders so the shell matches the product map.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", phase: 1, icon: "📊" },
  { href: "/content", label: "Content Vault", phase: 2, icon: "📁" },
  { href: "/campaigns", label: "Campaigns", phase: 3, icon: "🎯" },
  { href: "/calendar", label: "Calendar", phase: 6, icon: "📅" },
  { href: "/approvals", label: "Approvals", phase: 5, icon: "🛡️" },
  { href: "/comments", label: "Comments", phase: 9, icon: "💬" },
  { href: "/analytics", label: "Analytics", phase: 11, icon: "📈" },
  { href: "/accounts", label: "Connected Accounts", phase: 7, icon: "🔗" },
  { href: "/automation", label: "Automation", phase: 10, icon: "⚡" },
  { href: "/responses", label: "Response Library", phase: 10, icon: "📚" },
  { href: "/agent", label: "AI Agent", phase: 12, icon: "🤖" },
  { href: "/settings", label: "Settings", phase: 1, icon: "⚙️" },
];
