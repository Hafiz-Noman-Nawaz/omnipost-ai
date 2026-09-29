import { requireSession } from "@/lib/session";
import { getSettings, listContent, listCampaigns, listBrands } from "@omnipost/database";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { context } = await requireSession();
  const orgId = context.organizationId;

  const [settings, contentRes, campaignRes, brandsRes] = await Promise.all([
    getSettings(orgId).catch(() => ({ timezone: "UTC", autoReplyMaster: false })),
    listContent(orgId, { pageSize: 1 }).catch(() => ({ data: [], meta: { total: 0 } })),
    listCampaigns(orgId, { pageSize: 1 }).catch(() => ({ data: [], meta: { total: 0 } })),
    listBrands(orgId).catch(() => []),
  ]);

  const totalContent = contentRes.meta.total;
  const totalCampaigns = campaignRes.meta.total;
  const totalBrands = brandsRes.length;

  const quickStats = [
    {
      label: "Vault Assets",
      value: totalContent.toString(),
      subtext: "Images, videos & text",
      icon: "📁",
      href: "/content",
      color: "from-blue-500/20 to-indigo-500/10",
      border: "border-blue-500/25",
    },
    {
      label: "Campaigns",
      value: totalCampaigns.toString(),
      subtext: "Organized multi-platform",
      icon: "🎯",
      href: "/campaigns",
      color: "from-purple-500/20 to-indigo-500/10",
      border: "border-purple-500/25",
    },
    {
      label: "Brand Profiles",
      value: totalBrands.toString(),
      subtext: "Tones & safety guidelines",
      icon: "🏷️",
      href: "/campaigns",
      color: "from-cyan-500/20 to-blue-500/10",
      border: "border-cyan-500/25",
    },
    {
      label: "AI Engine",
      value: "Phase 4 Active",
      subtext: "Multi-platform generator",
      icon: "✨",
      href: "/content",
      color: "from-emerald-500/20 to-teal-500/10",
      border: "border-emerald-500/25",
    },
  ];

  const upcomingModules = [
    { label: "Approvals Queue", phase: 5, icon: "🛡️", status: "Live", href: "/approvals" },
    { label: "Publishing Calendar", phase: 6, icon: "📅", status: "Live", href: "/calendar" },
    { label: "Social Accounts", phase: 7, icon: "🔗", status: "Live", href: "/accounts" },
    { label: "Comment Moderation", phase: 9, icon: "💬", status: "Live", href: "/comments" },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-blue-950/40 border border-indigo-500/20 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-xs font-semibold text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              OmniPost Agent · Phase 9 Live
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Welcome back, {context.user.name ?? context.user.email.split("@")[0]}
            </h1>
            <p className="text-sm text-[var(--muted)] max-w-xl">
              Your AI-powered social automation workspace is active. Generate platform-adapted captions, organize multi-channel campaigns, review AI drafts, and moderate community conversations.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <Link className="btn btn-primary" href="/content">
              ✨ AI Content Studio
            </Link>
            <Link className="btn" href="/campaigns">
              🎯 New Campaign
            </Link>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`card card-interactive p-5 bg-gradient-to-br ${stat.color} ${stat.border} flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                {stat.label}
              </span>
              <span className="text-xl">{stat.icon}</span>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-white tracking-tight">{stat.value}</div>
              <div className="text-xs text-[var(--muted)] mt-1">{stat.subtext}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Grid: Phase Status & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Product Architecture Roadmap */}
        <div className="lg:col-span-2 card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <h2 className="font-bold text-white text-base flex items-center gap-2">
              <span>🏗️</span> Platform Engine Roadmap
            </h2>
            <span className="badge badge-accent text-xs">Phase 4 Active</span>
          </div>

          <div className="space-y-2.5">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                <div>
                  <div className="text-sm font-semibold text-white">Phase 1 — Application Foundation</div>
                  <div className="text-xs text-[var(--muted)]">Auth, sessions, RBAC, tenant isolation, security</div>
                </div>
              </div>
              <span className="badge badge-ok text-[11px]">Completed</span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                <div>
                  <div className="text-sm font-semibold text-white">Phase 2 — Content Vault</div>
                  <div className="text-xs text-[var(--muted)]">Bulk upload, media storage, tagging, deduplication</div>
                </div>
              </div>
              <span className="badge badge-ok text-[11px]">Completed</span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold">✓</span>
                <div>
                  <div className="text-sm font-semibold text-white">Phase 3 — Campaign System</div>
                  <div className="text-xs text-[var(--muted)]">Lifecycle transitions, audiences, brand guidelines, CTAs</div>
                </div>
              </div>
              <span className="badge badge-ok text-[11px]">Completed</span>
            </div>

            <div className="p-3 rounded-xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-between shadow-lg shadow-indigo-500/10">
              <div className="flex items-center gap-3">
                <span className="text-indigo-400 font-bold animate-pulse">⚡</span>
                <div>
                  <div className="text-sm font-semibold text-white">Phase 4 — AI Content Generation</div>
                  <div className="text-xs text-[var(--muted)]">LLM abstraction, platform variations, safety firewall, editing</div>
                </div>
              </div>
              <span className="badge badge-accent text-[11px]">Active</span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between opacity-70">
              <div className="flex items-center gap-3">
                <span className="text-[var(--muted)]">○</span>
                <div>
                  <div className="text-sm font-medium text-white">Phase 5 — Approval Workflow & Queue</div>
                  <div className="text-xs text-[var(--muted)]">Bulk approvals, rejections, preview renders</div>
                </div>
              </div>
              <span className="text-xs text-[var(--muted)]">Next</span>
            </div>
          </div>
        </div>

        {/* Right Col: Quick Status & Upcoming Pipelines */}
        <div className="space-y-6">
          <div className="card space-y-4">
            <h2 className="font-bold text-white text-base pb-3 border-b border-[var(--border)]">
              ⚙️ Organization Status
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
                <span className="text-[var(--muted)]">Timezone</span>
                <span className="font-semibold text-white">{settings.timezone}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
                <span className="text-[var(--muted)]">Auto-Reply Switch</span>
                <span className={`badge ${settings.autoReplyMaster ? "badge-ok" : "badge-warn"}`}>
                  {settings.autoReplyMaster ? "Enabled" : "Off (Safe)"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--border)]">
                <span className="text-[var(--muted)]">Security Isolation</span>
                <span className="badge badge-ok">Tenant Enforced</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[var(--muted)]">User Access</span>
                <span className="font-semibold text-white">{context.user.role}</span>
              </div>
            </div>

            <Link className="btn w-full text-xs justify-center" href="/settings">
              Manage Organization Settings →
            </Link>
          </div>

          <div className="card space-y-3">
            <h2 className="font-bold text-white text-sm">
              Upcoming Modules
            </h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {upcomingModules.map((m) => (
                <div key={m.label} className="p-2.5 rounded-lg bg-[var(--panel-2)] border border-[var(--border)]">
                  <div className="text-base mb-1">{m.icon}</div>
                  <div className="font-medium text-white truncate">{m.label}</div>
                  <div className="text-[10px] text-[var(--muted)] truncate">P{m.phase} · {m.status}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
