"use client";

import { useEffect, useState, useTransition } from "react";
import UtmLinkManager from "@/components/UtmLinkManager";

interface PlatformSupport {
  available: string[];
  unavailable: string[];
  notes: string;
}

interface PlatformAggregate {
  platform: string;
  postsCount: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagementRate: number;
  supportedMetrics: PlatformSupport;
}

interface DailyPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
}

interface TopPost {
  id: string;
  caption: string;
  platform: string;
  publishedAt: string | null;
  campaignName?: string | null;
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
  };
}

interface OverviewData {
  timeframeDays: number;
  totalPosts: number;
  totals: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    overallEngagementRate: number;
  };
  platformBreakdown: PlatformAggregate[];
  timeSeries: DailyPoint[];
  topPosts: TopPost[];
}

interface AISummaryData {
  summary: string;
  topHighlights: string[];
  recommendations: string[];
  dataGapsOrCaveats: string[];
}

const PLATFORM_ICONS: Record<string, string> = {
  INSTAGRAM: "📸",
  FACEBOOK: "📘",
  LINKEDIN: "💼",
  TIKTOK: "🎵",
  X: "𝕏",
  YOUTUBE: "▶️",
};

export default function AnalyticsDashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [timeframe, setTimeframe] = useState<number>(30);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // AI Ask state
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiSummary, setAiSummary] = useState<AISummaryData | null>(null);
  const [isAskingAi, startAskAiTransition] = useTransition();

  // Selected post for modal
  const [selectedPostHistory, setSelectedPostHistory] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadOverview = async () => {
    try {
      setLoading(true);
      const url = new URL("/api/rest/analytics/overview", window.location.origin);
      url.searchParams.set("days", timeframe.toString());
      if (selectedPlatform !== "ALL") {
        url.searchParams.set("platform", selectedPlatform);
      }

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      } else {
        showToast(json.error?.message || "Failed to load metrics", "error");
      }
    } catch {
      showToast("Error connecting to analytics service", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [timeframe, selectedPlatform]);

  const handleSyncMetrics = async () => {
    try {
      setSyncing(true);
      const res = await fetch("/api/rest/analytics/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.ok) {
        showToast(`Synchronized real metrics for ${json.data.syncedCount ?? 0} published posts!`);
        await loadOverview();
      } else {
        showToast(json.error?.message || "Metrics sync failed", "error");
      }
    } catch {
      showToast("Network error syncing metrics", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleAskAI = (presetQuestion?: string) => {
    const q = presetQuestion || aiQuestion;
    if (!q.trim()) return;

    startAskAiTransition(async () => {
      try {
        const res = await fetch("/api/rest/analytics/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, days: timeframe }),
        });
        const json = await res.json();
        if (json.ok) {
          setAiSummary(json.data.summary);
          setAiQuestion("");
          showToast("Generated grounded analytics intelligence!");
        } else {
          showToast(json.error?.message || "AI summary generation failed", "error");
        }
      } catch {
        showToast("Error contacting AI intelligence advisor", "error");
      }
    });
  };

  const viewPostDetails = async (postId: string) => {
    try {
      setLoadingHistory(true);
      const res = await fetch(`/api/rest/analytics/posts/${postId}`);
      const json = await res.json();
      if (json.ok) {
        setSelectedPostHistory(json.data);
      } else {
        showToast(json.error?.message || "Failed to fetch post history", "error");
      }
    } catch {
      showToast("Network error viewing post", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-fade-in ${
            toast.type === "error"
              ? "bg-rose-950/80 border-rose-500/40 text-rose-200"
              : "bg-emerald-950/80 border-emerald-500/40 text-emerald-200"
          }`}
        >
          <span>{toast.type === "error" ? "⚠️" : "✓"}</span>
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">📈</span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Honest Metrics & Analytics</h1>
            <span className="badge badge-accent text-xs">Phase 11</span>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Strictly grounded metrics from social platform APIs. No fabricated numbers or guessed conversions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Platform selector */}
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="input text-xs py-2 px-3 rounded-lg bg-[var(--panel-solid)] border-[var(--border)]"
          >
            <option value="ALL">All Platforms</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="LINKEDIN">LinkedIn</option>
            <option value="TIKTOK">TikTok</option>
            <option value="X">X (Twitter)</option>
            <option value="YOUTUBE">YouTube</option>
          </select>

          {/* Timeframe pill tabs */}
          <div className="flex items-center bg-[var(--panel-solid)] border border-[var(--border)] rounded-lg p-1 text-xs">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setTimeframe(d)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  timeframe === d
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Export CSV button */}
            <a
              href={`/api/rest/analytics/export/csv?days=${timeframe}&platform=${selectedPlatform}`}
              download
              className="btn btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
              title="Download CSV raw metrics table"
            >
              <span>📥</span>
              <span>CSV</span>
            </a>

            {/* Trigger Slack Digest */}
            <button
              type="button"
              onClick={async () => {
                const webhookUrl = prompt("Enter Slack or Discord Incoming Webhook URL:", "");
                if (!webhookUrl) return;
                try {
                  const res = await fetch("/api/rest/analytics/export/slack", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ webhookUrl, days: timeframe }),
                  });
                  const json = await res.json();
                  if (json.ok) {
                    showToast(`Dispatched executive digest for past ${timeframe} days to webhook!`);
                  } else {
                    showToast(json.error?.message || "Failed to dispatch webhook digest", "error");
                  }
                } catch {
                  showToast("Network error dispatching webhook digest", "error");
                }
              }}
              className="btn btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
              title="Post report to Slack or Discord channel"
            >
              <span>💬</span>
              <span>Slack</span>
            </button>

            {/* Trigger live sync button */}
            <button
              onClick={handleSyncMetrics}
              disabled={syncing}
              className="btn btn-primary text-xs py-2 px-3.5 flex items-center gap-2"
            >
              <span className={syncing ? "animate-spin" : ""}>🔄</span>
              <span>{syncing ? "Syncing..." : "Sync Metrics"}</span>
            </button>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="card p-12 text-center text-[var(--muted)] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Aggregating authentic platform metrics...</p>
        </div>
      ) : data ? (
        <>
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="card p-4 bg-gradient-to-b from-indigo-950/20 to-[var(--panel)]">
              <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1">
                <span>Total Views</span>
                <span>👀</span>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {data.totals.views.toLocaleString()}
              </div>
              <div className="text-[11px] text-indigo-400 mt-1">Verified Impressions</div>
            </div>

            <div className="card p-4 bg-gradient-to-b from-rose-950/20 to-[var(--panel)]">
              <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1">
                <span>Total Likes</span>
                <span>❤️</span>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {data.totals.likes.toLocaleString()}
              </div>
              <div className="text-[11px] text-rose-400 mt-1">Direct Reactions</div>
            </div>

            <div className="card p-4 bg-gradient-to-b from-cyan-950/20 to-[var(--panel)]">
              <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1">
                <span>Comments</span>
                <span>💬</span>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {data.totals.comments.toLocaleString()}
              </div>
              <div className="text-[11px] text-cyan-400 mt-1">Conversations</div>
            </div>

            <div className="card p-4 bg-gradient-to-b from-purple-950/20 to-[var(--panel)]">
              <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1">
                <span>Shares & Reposts</span>
                <span>🔁</span>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {data.totals.shares.toLocaleString()}
              </div>
              <div className="text-[11px] text-purple-400 mt-1">Virality Factor</div>
            </div>

            <div className="card p-4 bg-gradient-to-b from-emerald-950/20 to-[var(--panel)]">
              <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1">
                <span>Tracked Clicks</span>
                <span>🔗</span>
              </div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {data.totals.clicks.toLocaleString()}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-1">FB & LinkedIn API only</div>
            </div>

            <div className="card p-4 bg-gradient-to-b from-amber-950/20 to-[var(--panel)]">
              <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1">
                <span>Engagement Rate</span>
                <span>⚡</span>
              </div>
              <div className="text-2xl font-bold text-amber-300 tracking-tight">
                {data.totals.overallEngagementRate}%
              </div>
              <div className="text-[11px] text-amber-400/80 mt-1">Weighted Interactions</div>
            </div>
          </div>

          {/* Grounded AI Performance Advisor */}
          <div className="card p-6 border-indigo-500/30 bg-gradient-to-r from-indigo-950/30 via-[var(--panel)] to-purple-950/20 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-gradient)] flex items-center justify-center text-white text-base">
                  🧠
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Grounded AI Performance Advisor</h2>
                  <p className="text-xs text-[var(--muted)]">
                    Rigorous analysis based strictly on authentic stored metrics. Unsupported claims are explicitly refused.
                  </p>
                </div>
              </div>
            </div>

            {/* Question prompt input & quick chips */}
            <div className="space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask AI about metrics (e.g. Which channel is driving real engagement? What are our data gaps?)..."
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAskAI()}
                  className="input text-sm flex-1"
                />
                <button
                  onClick={() => handleAskAI()}
                  disabled={isAskingAi}
                  className="btn btn-primary text-sm px-4 whitespace-nowrap"
                >
                  {isAskingAi ? "Analyzing..." : "Ask AI"}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[var(--muted)]">Quick Inquiries:</span>
                {[
                  "Which channel has the highest audience traction?",
                  "Can we claim a 300% ROI from these campaigns?",
                  "What metrics are unavailable across our channels?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => handleAskAI(q)}
                    disabled={isAskingAi}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--panel-hover)] border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-indigo-500/50 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Summary Render */}
            {aiSummary && (
              <div className="card p-5 bg-[var(--panel-solid)] border-indigo-500/20 space-y-4 animate-fade-in">
                <div className="border-b border-[var(--border)] pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Executive Performance Summary
                  </span>
                  <p className="text-sm text-gray-200 mt-1 leading-relaxed">{aiSummary.summary}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      Key Highlights
                    </span>
                    <ul className="space-y-1 text-xs text-[var(--muted)]">
                      {aiSummary.topHighlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-400 shrink-0">✓</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                      Strategic Recommendations
                    </span>
                    <ul className="space-y-1 text-xs text-[var(--muted)]">
                      {aiSummary.recommendations.map((r, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-cyan-400 shrink-0">→</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {aiSummary.dataGapsOrCaveats && aiSummary.dataGapsOrCaveats.length > 0 && (
                  <div className="border-t border-[var(--border)] pt-3 text-xs bg-amber-950/20 p-3 rounded-lg border border-amber-500/20">
                    <span className="font-semibold text-amber-300 block mb-1">
                      Platform Transparency & Data Gaps:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-200/80">
                      {aiSummary.dataGapsOrCaveats.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Honest Platform Capabilities Matrix (Spec §20) */}
          <div className="card p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>🛡️</span>
                <span>Honest Platform Capability Matrix</span>
              </h2>
              <p className="text-xs text-[var(--muted)]">
                OmniPost strictly respects real social platform API capabilities. No vanity estimates, no fabricated click counters.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.platformBreakdown.map((item) => (
                <div
                  key={item.platform}
                  className="card p-4 bg-[var(--panel-solid)] border-[var(--border)] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-white">
                      <span>{PLATFORM_ICONS[item.platform] || "📱"}</span>
                      <span>{item.platform}</span>
                    </div>
                    <span className="text-xs text-[var(--muted)]">{item.postsCount} posts</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center bg-black/30 p-2 rounded-lg">
                    <div>
                      <div className="text-[10px] text-[var(--muted)]">Views</div>
                      <div className="text-xs font-bold text-white">{item.views.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--muted)]">Reactions</div>
                      <div className="text-xs font-bold text-white">{(item.likes + item.comments).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--muted)]">Engage %</div>
                      <div className="text-xs font-bold text-amber-400">{item.engagementRate}%</div>
                    </div>
                  </div>

                  {/* Available vs Unavailable Matrix */}
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-emerald-400 font-medium">Available:</span>
                      {item.supportedMetrics.available.map((m) => (
                        <span key={m} className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                          {m}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-rose-400 font-medium">Unsupported:</span>
                      {item.supportedMetrics.unavailable.map((m) => (
                        <span key={m} className="px-1.5 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-500/20 line-through">
                          {m}
                        </span>
                      ))}
                    </div>

                    <p className="text-[10px] text-[var(--muted)] pt-1 border-t border-white/5">
                      {item.supportedMetrics.notes}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Time Series Activity Chart */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Daily Performance Timeline</h2>
                <p className="text-xs text-[var(--muted)]">
                  Captured metric velocity over the selected {timeframe}-day window.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-indigo-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Views
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Likes
                </span>
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" /> Comments
                </span>
              </div>
            </div>

            {/* Time series visual bars */}
            <div className="h-48 flex items-end gap-1.5 pt-6 pb-2 overflow-x-auto border-b border-[var(--border)]">
              {data.timeSeries.map((point) => {
                const maxViews = Math.max(...data.timeSeries.map((p) => p.views), 10);
                const heightPct = Math.max(8, Math.min(100, (point.views / maxViews) * 100));

                return (
                  <div
                    key={point.date}
                    className="flex-1 min-w-[24px] flex flex-col items-center gap-1 group relative h-full justify-end"
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col gap-0.5 bg-black/90 border border-[var(--border)] text-[10px] p-2 rounded shadow-xl pointer-events-none z-30 whitespace-nowrap">
                      <span className="font-semibold text-white">{point.date}</span>
                      <span className="text-indigo-300">Views: {point.views}</span>
                      <span className="text-rose-300">Likes: {point.likes}</span>
                      <span className="text-cyan-300">Comments: {point.comments}</span>
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full bg-gradient-to-t from-indigo-600/70 to-indigo-400 rounded-t group-hover:from-indigo-500 group-hover:to-indigo-300 transition-all"
                    />

                    <span className="text-[9px] text-[var(--muted)] group-hover:text-white truncate max-w-[28px]">
                      {point.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Posts Breakdown */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Top Performing Posts</h2>
                <p className="text-xs text-[var(--muted)]">
                  Ranked by combined verified impressions and engagement interactions.
                </p>
              </div>
              <span className="text-xs text-[var(--muted)]">{data.topPosts.length} post(s)</span>
            </div>

            {data.topPosts.length === 0 ? (
              <div className="text-center py-8 text-[var(--muted)] text-sm">
                No published posts recorded in this timeframe. Schedule or publish content to view metrics.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                      <th className="py-2.5 px-3">Platform</th>
                      <th className="py-2.5 px-3">Post Caption</th>
                      <th className="py-2.5 px-3">Campaign</th>
                      <th className="py-2.5 px-3 text-right">Views</th>
                      <th className="py-2.5 px-3 text-right">Likes</th>
                      <th className="py-2.5 px-3 text-right">Comments</th>
                      <th className="py-2.5 px-3 text-right">Shares</th>
                      <th className="py-2.5 px-3 text-right">Clicks</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {data.topPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-[var(--panel-hover)] transition-colors">
                        <td className="py-3 px-3 font-semibold text-white whitespace-nowrap">
                          <span className="mr-1.5">{PLATFORM_ICONS[post.platform.toUpperCase()] || "📱"}</span>
                          {post.platform}
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-gray-200" title={post.caption}>
                          {post.caption}
                        </td>
                        <td className="py-3 px-3 text-[var(--muted)] whitespace-nowrap">
                          {post.campaignName || "—"}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-indigo-300">
                          {post.metrics.views.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-rose-300">
                          {post.metrics.likes.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-cyan-300">
                          {post.metrics.comments.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-purple-300">
                          {post.metrics.shares.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-emerald-300">
                          {post.metrics.clicks > 0 ? post.metrics.clicks.toLocaleString() : "—"}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => viewPostDetails(post.id)}
                            className="btn btn-secondary text-[11px] py-1 px-2.5"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* UTM Link Shortener & Attribution Section */}
          <UtmLinkManager />
        </>
      ) : null}

      {/* Post Analytics Modal */}
      {selectedPostHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-2xl w-full p-6 bg-[var(--panel-solid)] border-[var(--border)] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {PLATFORM_ICONS[selectedPostHistory.post.platform.toUpperCase()] || "📱"}
                </span>
                <h3 className="font-bold text-white text-base">
                  {selectedPostHistory.post.platform} Post Analytics
                </h3>
              </div>
              <button
                onClick={() => setSelectedPostHistory(null)}
                className="text-[var(--muted)] hover:text-white p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-black/30 border border-white/5 text-xs text-gray-200">
                <span className="font-semibold text-indigo-400 block mb-1">Post Caption:</span>
                {selectedPostHistory.post.caption}
              </div>

              {/* Latest snapshot */}
              {selectedPostHistory.latestMetrics ? (
                <div className="grid grid-cols-5 gap-2 text-center p-3 rounded-lg bg-[var(--panel-hover)] border border-[var(--border)]">
                  <div>
                    <div className="text-[10px] text-[var(--muted)]">Views</div>
                    <div className="text-sm font-bold text-indigo-400">
                      {selectedPostHistory.latestMetrics.views ?? "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--muted)]">Likes</div>
                    <div className="text-sm font-bold text-rose-400">
                      {selectedPostHistory.latestMetrics.likes ?? "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--muted)]">Comments</div>
                    <div className="text-sm font-bold text-cyan-400">
                      {selectedPostHistory.latestMetrics.comments ?? "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--muted)]">Shares</div>
                    <div className="text-sm font-bold text-purple-400">
                      {selectedPostHistory.latestMetrics.shares ?? "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--muted)]">Clicks</div>
                    <div className="text-sm font-bold text-emerald-400">
                      {selectedPostHistory.latestMetrics.clicks ?? "N/A"}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--muted)]">No metric snapshots recorded yet.</p>
              )}

              {/* Platform limits */}
              <div className="text-[11px] p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/20 text-amber-200/90">
                <span className="font-semibold block mb-0.5">Platform Limitations:</span>
                {selectedPostHistory.support.notes}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedPostHistory(null)}
                className="btn btn-secondary text-xs px-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
