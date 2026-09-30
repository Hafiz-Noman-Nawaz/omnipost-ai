import { requireSession } from "@/lib/session";
import {
  getSettings,
  listContent,
  listCampaigns,
  listBrands,
  listApprovalQueue,
  listScheduledPosts,
  listSocialAccounts,
  listComments,
  listAuditLogs,
} from "@omnipost/database";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { context } = await requireSession();
  const orgId = context.organizationId;

  // Concurrent data fetching for instant response
  const [
    settings,
    contentRes,
    campaignRes,
    brandsRes,
    approvalRes,
    scheduledRes,
    accountsRes,
    commentsRes,
    auditRes,
  ] = await Promise.all([
    getSettings(orgId).catch(() => ({ timezone: "UTC", autoReplyMaster: false })),
    listContent(orgId, { pageSize: 5 }).catch(() => ({ data: [], meta: { total: 0 } })),
    listCampaigns(orgId, { pageSize: 5 }).catch(() => ({ data: [], meta: { total: 0 } })),
    listBrands(orgId).catch(() => []),
    listApprovalQueue(context, { status: "AWAITING_APPROVAL" }).catch(() => ({
      posts: [],
      summary: { total: 0, awaitingApproval: 0, approved: 0, rejected: 0 },
    })),
    listScheduledPosts(context, { from: new Date() }).catch(() => []),
    listSocialAccounts(context).catch(() => []),
    listComments(context, { limit: 5 }).catch(() => ({ comments: [], total: 0 })),
    listAuditLogs(orgId, { pageSize: 5 }).catch(() => ({ data: [], meta: { page: 1, pageSize: 5, total: 0, totalPages: 0 } })),
  ]);

  const totalContent = contentRes.meta?.total ?? 0;
  const totalCampaigns = campaignRes.meta?.total ?? 0;
  const totalBrands = brandsRes.length;
  const awaitingApproval = approvalRes.summary?.awaitingApproval ?? approvalRes.posts?.length ?? 0;
  const scheduledCount = scheduledRes.length;
  const connectedAccountsCount = accountsRes.filter((a) => a.status === "CONNECTED").length;
  const pendingCommentsCount = commentsRes.total ?? 0;

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";
  const userName = context.user.name ?? context.user.email.split("@")[0];

  const platformIcons: Record<string, string> = {
    instagram: "📸",
    linkedin: "💼",
    twitter: "🐦",
    x: "🐦",
    tiktok: "🎵",
    facebook: "👥",
    youtube: "▶️",
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero Welcome & Quick Launch */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-indigo-950/70 via-slate-900/90 to-blue-950/50 border border-indigo-500/25 shadow-2xl backdrop-blur-xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Gemini 3.5 Flash Engine · Active & Ready
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {greeting}, {userName}
            </h1>
            <p className="text-sm text-[var(--muted)] max-w-2xl leading-relaxed">
              Welcome to your social media command center. Create multi-platform campaigns, automate comment replies, schedule posts across channels, and deploy your autonomous AI agent.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/agent"
              className="btn btn-primary shadow-lg shadow-indigo-500/25 flex items-center gap-2 hover:scale-[1.02] transition-transform"
            >
              <span>🤖</span>
              <span>Ask AI Agent</span>
            </Link>
            <Link href="/content" className="btn flex items-center gap-2 hover:bg-white/10">
              <span>✨</span>
              <span>New Post</span>
            </Link>
            <Link href="/calendar" className="btn flex items-center gap-2 hover:bg-white/10">
              <span>📅</span>
              <span>Calendar</span>
            </Link>
          </div>
        </div>

        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Real Performance KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <Link
          href="/campaigns"
          className="card card-interactive p-4 bg-gradient-to-br from-purple-500/15 to-indigo-500/5 border-purple-500/20 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Campaigns</span>
            <span className="text-lg">🎯</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">{totalCampaigns}</div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">Active projects</div>
          </div>
        </Link>

        <Link
          href="/content"
          className="card card-interactive p-4 bg-gradient-to-br from-blue-500/15 to-cyan-500/5 border-blue-500/20 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Media Vault</span>
            <span className="text-lg">📁</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">{totalContent}</div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">Assets & creatives</div>
          </div>
        </Link>

        <Link
          href="/approvals"
          className="card card-interactive p-4 bg-gradient-to-br from-amber-500/15 to-orange-500/5 border-amber-500/20 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Pending Review</span>
            <span className="text-lg">🛡️</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-300">{awaitingApproval}</div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">Awaiting sign-off</div>
          </div>
        </Link>

        <Link
          href="/calendar"
          className="card card-interactive p-4 bg-gradient-to-br from-emerald-500/15 to-teal-500/5 border-emerald-500/20 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Scheduled</span>
            <span className="text-lg">📅</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-300">{scheduledCount}</div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">In publishing queue</div>
          </div>
        </Link>

        <Link
          href="/accounts"
          className="card card-interactive p-4 bg-gradient-to-br from-indigo-500/15 to-blue-500/5 border-indigo-500/20 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Channels</span>
            <span className="text-lg">🔗</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">{connectedAccountsCount}</div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">Accounts connected</div>
          </div>
        </Link>

        <Link
          href="/comments"
          className="card card-interactive p-4 bg-gradient-to-br from-rose-500/15 to-pink-500/5 border-rose-500/20 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Inbox</span>
            <span className="text-lg">💬</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white">{pendingCommentsCount}</div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">Audience comments</div>
          </div>
        </Link>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Scheduled Queue & Content Pipeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Next-Up Scheduled Posts */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <h2 className="font-bold text-white text-base flex items-center gap-2">
                  <span>📅</span> Upcoming Publishing Queue
                </h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Posts scheduled for automated multi-channel delivery
                </p>
              </div>
              <Link href="/calendar" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                View Full Calendar →
              </Link>
            </div>

            {scheduledRes.length > 0 ? (
              <div className="space-y-3">
                {scheduledRes.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-[var(--panel-2)] border border-[var(--border)] flex items-center justify-between gap-4 hover:border-indigo-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-lg shrink-0">
                        {platformIcons[item.platform.toLowerCase()] ?? "📱"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate max-w-md">
                          {item.post.caption || "No caption provided"}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-0.5">
                          <span className="capitalize">{item.platform}</span>
                          <span>•</span>
                          <span>{new Date(item.scheduledAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}</span>
                        </div>
                      </div>
                    </div>
                    <span className="badge badge-accent text-[11px] shrink-0">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 px-4 text-center rounded-xl bg-[var(--panel-2)]/50 border border-dashed border-[var(--border)] space-y-3">
                <div className="text-3xl">🗓️</div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-white">No posts scheduled</div>
                  <div className="text-xs text-[var(--muted)] max-w-sm mx-auto">
                    Your publishing schedule is clear. Plan ahead by creating and scheduling content across your channels.
                  </div>
                </div>
                <Link href="/content" className="btn btn-primary text-xs inline-flex items-center gap-1.5 mt-2">
                  <span>✨</span> Schedule Content Now
                </Link>
              </div>
            )}
          </div>

          {/* Recent Content Assets */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <h2 className="font-bold text-white text-base flex items-center gap-2">
                  <span>📁</span> Recent Content Vault Items
                </h2>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Latest creatives and copy ready for multi-platform variation
                </p>
              </div>
              <Link href="/content" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                Open Vault →
              </Link>
            </div>

            {contentRes.data.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contentRes.data.slice(0, 4).map((item) => (
                  <Link
                    key={item.id}
                    href={`/content`}
                    className="p-3.5 rounded-xl bg-[var(--panel-2)] border border-[var(--border)] hover:border-indigo-500/30 transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1.5">
                        <span className="uppercase text-[10px] font-semibold tracking-wider">{item.type}</span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                        {item.title}
                      </div>
                      <div className="text-xs text-[var(--muted)] line-clamp-2 mt-1">
                        {item.description || "No description provided"}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5 text-indigo-400">
                      <span>Generate Variations →</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 px-4 text-center rounded-xl bg-[var(--panel-2)]/50 border border-dashed border-[var(--border)] space-y-3">
                <div className="text-3xl">📥</div>
                <div className="text-sm font-semibold text-white">Your vault is empty</div>
                <div className="text-xs text-[var(--muted)] max-w-sm mx-auto">
                  Upload images, videos, or raw copy to start generating tailored social variations.
                </div>
                <Link href="/content" className="btn text-xs inline-flex items-center gap-1.5 mt-2">
                  Upload First Creative
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Assistant, Automation & Activity */}
        <div className="space-y-6">
          {/* AI Copilot & Automation Controls */}
          <div className="card space-y-4 bg-gradient-to-br from-[var(--panel)] to-indigo-950/20">
            <h2 className="font-bold text-white text-base pb-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>⚡</span> System & Automation
              </span>
              <span className="badge badge-ok text-[10px]">Healthy</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-[var(--border)]">
                <span className="text-[var(--muted)]">AI Model</span>
                <span className="font-mono text-white font-medium bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  gemini-3.5-flash
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[var(--border)]">
                <span className="text-[var(--muted)]">Community Auto-Reply</span>
                <span className={`badge ${settings.autoReplyMaster ? "badge-ok" : "badge-warn"}`}>
                  {settings.autoReplyMaster ? "Active" : "Kill-Switch (Off)"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-[var(--border)]">
                <span className="text-[var(--muted)]">Brand Profiles</span>
                <span className="font-semibold text-white">{totalBrands} active</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-[var(--muted)]">Timezone</span>
                <span className="font-semibold text-white">{settings.timezone || "UTC"}</span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link className="btn btn-primary text-xs justify-center flex items-center gap-2" href="/agent">
                <span>🤖</span> Launch Autonomous Agent
              </Link>
              <Link className="btn text-xs justify-center flex items-center gap-2" href="/automation">
                <span>⚙️</span> Manage Automation Rules
              </Link>
            </div>
          </div>

          {/* Social Channels Health */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <h2 className="font-bold text-white text-sm flex items-center gap-2">
                <span>🔗</span> Connected Channels
              </h2>
              <Link href="/accounts" className="text-xs text-indigo-400 hover:text-indigo-300">
                Manage
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { name: "Instagram", icon: "📸", key: "instagram" },
                { name: "LinkedIn", icon: "💼", key: "linkedin" },
                { name: "Twitter / X", icon: "🐦", key: "twitter" },
                { name: "TikTok", icon: "🎵", key: "tiktok" },
                { name: "Facebook", icon: "👥", key: "facebook" },
                { name: "YouTube", icon: "▶️", key: "youtube" },
              ].map((platform) => {
                const connected = accountsRes.some(
                  (a) => a.platform.toLowerCase() === platform.key && a.status === "CONNECTED"
                );
                return (
                  <div
                    key={platform.name}
                    className="p-2.5 rounded-lg bg-[var(--panel-2)] border border-[var(--border)] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>{platform.icon}</span>
                      <span className="truncate text-white font-medium">{platform.name}</span>
                    </div>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        connected ? "bg-emerald-400 shadow-sm shadow-emerald-400" : "bg-white/20"
                      }`}
                      title={connected ? "Connected" : "Not connected"}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Activity Audit Feed */}
          <div className="card space-y-3">
            <h2 className="font-bold text-white text-sm pb-2 border-b border-[var(--border)] flex items-center gap-2">
              <span>⚡</span> Live Activity
            </h2>

            {auditRes.data && auditRes.data.length > 0 ? (
              <div className="space-y-2.5">
                {auditRes.data.slice(0, 4).map((log) => (
                  <div key={log.id} className="text-xs flex items-start gap-2.5">
                    <span className="text-indigo-400 mt-0.5">•</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-medium truncate capitalize">
                        {log.action.replace(".", " ")}
                      </div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} •{" "}
                        {log.actorType}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[var(--muted)] py-3 text-center">
                System activity logged in real-time.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

