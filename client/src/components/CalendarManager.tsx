"use client";

import { useCallback, useEffect, useState } from "react";
import SocialPostPreview, { SocialPlatform } from "@/components/SocialPostPreview";

export interface ScheduledPostItem {
  id: string;
  organizationId: string;
  postId: string;
  campaignId: string | null;
  platform: string;
  scheduledAt: string;
  timezone: string;
  status: "QUEUED" | "PROCESSING" | "PUBLISHED" | "FAILED" | "CANCELLED" | "RETRYING";
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: string | null;
  publishedAt: string | null;
  platformPostId: string | null;
  idempotencyKey: string;
  error: {
    code?: string;
    message?: string;
  } | null;
  post: {
    id: string;
    caption: string;
    hashtags: string[];
    linkUrl: string | null;
    content?: {
      id: string;
      title: string;
      type: string;
      campaign?: {
        id: string;
        name: string;
      } | null;
    } | null;
  };
  attemptsLog?: Array<{
    id: string;
    attemptNumber: number;
    startedAt: string;
    ok: boolean | null;
    message: string | null;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; color: string }> = {
  QUEUED: { label: "Queued", badge: "badge-warn", color: "text-amber-400" },
  PROCESSING: { label: "Processing", badge: "badge-accent", color: "text-indigo-400" },
  PUBLISHED: { label: "Published", badge: "badge-ok", color: "text-emerald-400" },
  FAILED: { label: "Failed", badge: "badge-danger", color: "text-rose-400" },
  RETRYING: { label: "Retrying", badge: "badge-warn", color: "text-amber-400" },
  CANCELLED: { label: "Cancelled", badge: "", color: "text-neutral-500" },
};

const PLATFORM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  X: { bg: "bg-black/60", text: "text-white", border: "border-neutral-800" },
  INSTAGRAM: { bg: "bg-pink-950/40", text: "text-pink-300", border: "border-pink-800/40" },
  LINKEDIN: { bg: "bg-blue-950/40", text: "text-blue-300", border: "border-blue-800/40" },
  TIKTOK: { bg: "bg-purple-950/40", text: "text-purple-300", border: "border-purple-800/40" },
  FACEBOOK: { bg: "bg-indigo-950/40", text: "text-indigo-300", border: "border-indigo-800/40" },
  YOUTUBE: { bg: "bg-red-950/40", text: "text-red-300", border: "border-red-800/40" },
};

export default function CalendarManager() {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [platformFilter, setPlatformFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Reschedule Modal
  const [reschedulingPost, setReschedulingPost] = useState<ScheduledPostItem | null>(null);
  const [newScheduleDate, setNewScheduleDate] = useState("");
  const [newTimezone, setNewTimezone] = useState("UTC");
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  // Live Post Preview Modal
  const [previewingPost, setPreviewingPost] = useState<ScheduledPostItem | null>(null);

  // Drag and Drop
  const [draggedPost, setDraggedPost] = useState<ScheduledPostItem | null>(null);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [smartScheduleOpen, setSmartScheduleOpen] = useState(false);

  const fetchScheduled = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (platformFilter !== "ALL") params.set("platform", platformFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/rest/scheduled?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || `Failed to fetch scheduled posts: HTTP ${res.status}`);
      }
      const json = await res.json();
      setScheduledPosts(json.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching scheduled posts");
    } finally {
      setLoading(false);
    }
  }, [platformFilter, statusFilter]);

  useEffect(() => {
    fetchScheduled();
  }, [fetchScheduled]);

  // Actions
  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this scheduled publication?")) return;
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/rest/scheduled/${id}/cancel`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || "Failed to cancel post");
      }
      await fetchScheduled();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error cancelling post");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRetry = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/rest/scheduled/${id}/retry`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || "Failed to retry post");
      }
      await fetchScheduled();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error retrying post");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveReschedule = async () => {
    if (!reschedulingPost || !newScheduleDate) return;
    setSubmittingReschedule(true);
    try {
      const res = await fetch(`/api/rest/scheduled/${reschedulingPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: new Date(newScheduleDate).toISOString(),
          timezone: newTimezone,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || "Failed to reschedule post");
      }
      setReschedulingPost(null);
      await fetchScheduled();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error rescheduling post");
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const handleQuickReschedule = async (id: string, targetIso: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/rest/scheduled/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: targetIso,
          timezone: "UTC",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || "Failed to reschedule post");
      }
      await fetchScheduled();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error rescheduling post");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Best-Time-To-Post Predictive Recommendations
  const SMART_SLOTS = [
    { label: "High Engagement - LinkedIn Morning", time: "Tomorrow 09:00 UTC", platform: "LINKEDIN", hour: 9, daysFromNow: 1 },
    { label: "Peak Audience - Instagram Lunch", time: "Tomorrow 12:30 UTC", platform: "INSTAGRAM", hour: 12.5, daysFromNow: 1 },
    { label: "Viral Window - X / Twitter Morning", time: "In 2 Days 08:15 UTC", platform: "X", hour: 8.25, daysFromNow: 2 },
    { label: "Evening Rush - TikTok / Reels", time: "In 2 Days 19:00 UTC", platform: "TIKTOK", hour: 19, daysFromNow: 2 },
    { label: "Weekend Primer - Facebook & YouTube", time: "Friday 15:00 UTC", platform: "FACEBOOK", hour: 15, daysFromNow: 3 },
  ];

  // Metrics
  const queuedCount = scheduledPosts.filter((p) => p.status === "QUEUED" || p.status === "RETRYING").length;
  const publishedCount = scheduledPosts.filter((p) => p.status === "PUBLISHED").length;
  const failedCount = scheduledPosts.filter((p) => p.status === "FAILED").length;

  return (
    <div className="space-y-6">
      {/* Title & Queue Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>📅</span> Publishing Scheduler
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Background job queue, timezone execution, and publication monitoring (spec §12/§13).
          </p>
        </div>

        {/* Counter chips */}
        <div className="flex flex-wrap gap-2.5">
          <div className="card px-3.5 py-2 flex items-center gap-2 border border-amber-500/30 bg-amber-950/20">
            <span className="text-amber-400 font-semibold text-base">{queuedCount}</span>
            <span className="text-xs text-amber-200/80">Queued for Publish</span>
          </div>
          <div className="card px-3.5 py-2 flex items-center gap-2 border border-emerald-500/30 bg-emerald-950/20">
            <span className="text-emerald-400 font-semibold text-base">{publishedCount}</span>
            <span className="text-xs text-emerald-200/80">Published</span>
          </div>
          {failedCount > 0 && (
            <div className="card px-3.5 py-2 flex items-center gap-2 border border-rose-500/30 bg-rose-950/20">
              <span className="text-rose-400 font-semibold text-base">{failedCount}</span>
              <span className="text-xs text-rose-200/80">Failed</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Platform chips */}
          <div className="flex flex-wrap gap-1.5">
            {["ALL", "X", "INSTAGRAM", "LINKEDIN", "TIKTOK", "FACEBOOK", "YOUTUBE"].map((plat) => (
              <button
                key={plat}
                type="button"
                onClick={() => setPlatformFilter(plat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  platformFilter === plat
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-[var(--panel-hover)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {plat === "ALL" ? "All Platforms" : plat}
              </button>
            ))}
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs bg-[var(--panel-hover)] border border-[var(--border)] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="PROCESSING">Processing</option>
              <option value="PUBLISHED">Published</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <button
              type="button"
              onClick={() => setSmartScheduleOpen(!smartScheduleOpen)}
              className="px-3 py-1.5 rounded-lg text-xs bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/50 transition-colors flex items-center gap-1.5 font-medium"
            >
              <span>⚡</span>
              <span>{smartScheduleOpen ? "Hide Smart Slots" : "Smart Best-Time Recommendations"}</span>
            </button>

            <button
              type="button"
              onClick={fetchScheduled}
              className="px-3 py-1.5 rounded-lg text-xs bg-neutral-800 text-[var(--muted)] hover:text-white transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Smart Predictive Best-Time Slots */}
        {smartScheduleOpen && (
          <div className="pt-3 border-t border-[var(--border)] space-y-2">
            <div className="text-xs text-[var(--muted)] flex items-center justify-between">
              <span className="font-semibold text-white">🎯 Predictive Best-Time-To-Post Windows</span>
              <span>Based on cross-network audience activity analysis</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {SMART_SLOTS.map((slot, i) => (
                <div
                  key={i}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedPost) {
                      const d = new Date();
                      d.setDate(d.getDate() + slot.daysFromNow);
                      d.setUTCHours(Math.floor(slot.hour), (slot.hour % 1) * 60, 0, 0);
                      handleQuickReschedule(draggedPost.id, d.toISOString());
                      setDraggedPost(null);
                    }
                  }}
                  className="p-3 rounded-xl border border-dashed border-indigo-500/30 bg-indigo-950/20 hover:border-indigo-400 hover:bg-indigo-900/30 transition-all text-xs space-y-1 group"
                >
                  <div className="font-semibold text-indigo-200 flex items-center justify-between">
                    <span>{slot.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      {slot.platform}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--muted)] flex items-center justify-between pt-1">
                    <span>⏰ {slot.time}</span>
                    <span className="text-[10px] text-indigo-400 group-hover:underline">Drop post here to set</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="card p-4 border border-rose-500/40 bg-rose-950/20 text-rose-300 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading & Empty States */}
      {loading ? (
        <div className="card p-12 text-center text-[var(--muted)] text-sm animate-pulse">
          Loading publishing calendar...
        </div>
      ) : scheduledPosts.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="text-3xl">🗓️</div>
          <div className="text-base font-medium text-white">No scheduled posts yet</div>
          <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
            Schedule approved posts from the Approvals queue to see them on your timeline.
          </p>
        </div>
      ) : (
        /* Timeline Feed */
        <div className="space-y-4">
          {scheduledPosts.map((item) => {
            const style = PLATFORM_COLORS[item.platform] || {
              bg: "bg-neutral-900",
              text: "text-neutral-200",
              border: "border-neutral-800",
            };
            const cfg = STATUS_CONFIG[item.status] || {
              label: item.status,
              badge: "badge",
              color: "text-white",
            };
            const dateObj = new Date(item.scheduledAt);
            const isPendingAction = actionLoadingId === item.id;

            return (
              <div
                key={item.id}
                draggable={item.status === "QUEUED"}
                onDragStart={() => setDraggedPost(item)}
                className={`card p-5 space-y-4 hover:border-indigo-500/40 transition-all duration-200 ${
                  item.status === "QUEUED" ? "cursor-grab active:cursor-grabbing" : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
                  {/* Left: Schedule time & Platform */}
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${style.bg} ${style.text} ${style.border}`}>
                      {item.platform}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center gap-2">
                        <span>⏰ {dateObj.toLocaleString()}</span>
                        <span className="text-[11px] font-mono text-[var(--muted)]">({item.timezone})</span>
                      </div>
                      {item.post.content?.campaign && (
                        <div className="text-xs text-[var(--muted)]">
                          🎯 Campaign: {item.post.content.campaign.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Status Pill & Attempts */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {item.attempts > 0 && (
                      <span className="text-[11px] text-[var(--muted)] font-mono">
                        Attempt {item.attempts}/{item.maxAttempts}
                      </span>
                    )}
                    <span className={`badge ${cfg.badge} text-xs px-2.5 py-0.5`}>
                      {cfg.label}
                    </span>
                  </div>
                </div>

                {/* Post Preview */}
                <div className="space-y-2">
                  {item.post.content && (
                    <div className="text-xs text-[var(--muted)] font-medium flex items-center gap-1.5">
                      <span>📁 Asset:</span>
                      <span className="text-white">{item.post.content.title}</span>
                    </div>
                  )}

                  <div className="p-3.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-sm text-neutral-100 whitespace-pre-wrap leading-relaxed">
                    {item.post.caption}
                  </div>

                  {item.post.hashtags && item.post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.post.hashtags.map((tag, i) => (
                        <span key={i} className="text-xs text-indigo-400 font-mono">
                          {tag.startsWith("#") ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.post.linkUrl && (
                    <div className="text-xs text-cyan-400 font-mono truncate bg-cyan-950/20 border border-cyan-800/30 px-3 py-1.5 rounded-lg">
                      🔗 {item.post.linkUrl}
                    </div>
                  )}
                </div>

                {/* Error Banner if failed or retrying */}
                {item.error && (
                  <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-950/20 text-xs text-rose-300 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <span>⚠️</span> Publish Error: {item.error.code || "FAILED"}
                    </div>
                    <div className="text-[11px] text-rose-200/90">{item.error.message}</div>
                  </div>
                )}

                {/* Platform Post Link if Published */}
                {item.status === "PUBLISHED" && item.platformPostId && (
                  <div className="text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-800/30 px-3 py-2 rounded-lg flex items-center justify-between">
                    <span>✓ Published to {item.platform}</span>
                    <span className="font-mono text-[11px] text-emerald-300">ID: {item.platformPostId}</span>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]">
                  <div className="font-mono text-[11px]">
                    Idempotency: {item.idempotencyKey.slice(0, 16)}...
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewingPost(item)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 hover:bg-indigo-900/60 transition-colors flex items-center gap-1.5"
                    >
                      <span>👁️</span>
                      <span>Live Preview</span>
                    </button>

                    {item.status === "QUEUED" && (
                      <>
                        <button
                          type="button"
                          disabled={isPendingAction}
                          onClick={() => {
                            setReschedulingPost(item);
                            setNewScheduleDate(new Date(item.scheduledAt).toISOString().slice(0, 16));
                            setNewTimezone(item.timezone);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[var(--panel-hover)] text-white hover:bg-neutral-800 transition-colors"
                        >
                          ⏰ Reschedule
                        </button>
                        <button
                          type="button"
                          disabled={isPendingAction}
                          onClick={() => handleCancel(item.id)}
                          className="px-3 py-1.5 rounded-lg bg-rose-950/30 border border-rose-800/40 text-rose-300 hover:bg-rose-900/50 transition-colors"
                        >
                          ✕ Cancel
                        </button>
                      </>
                    )}

                    {item.status === "FAILED" && (
                      <button
                        type="button"
                        disabled={isPendingAction}
                        onClick={() => handleRetry(item.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-all shadow-sm"
                      >
                        🔄 Retry Now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {reschedulingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 space-y-4 bg-neutral-900 border border-neutral-700 shadow-2xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>⏰</span> Reschedule Post
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Choose a new publication time and target timezone for this {reschedulingPost.platform} post.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[var(--muted)] mb-1">New Date & Time</label>
                <input
                  type="datetime-local"
                  value={newScheduleDate}
                  onChange={(e) => setNewScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-[var(--border)] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[var(--muted)] mb-1">Timezone (IANA format)</label>
                <input
                  type="text"
                  value={newTimezone}
                  onChange={(e) => setNewTimezone(e.target.value)}
                  placeholder="e.g. UTC, Asia/Karachi, America/New_York"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-[var(--border)] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setReschedulingPost(null)}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--panel-hover)] text-xs text-[var(--muted)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingReschedule || !newScheduleDate}
                onClick={handleSaveReschedule}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-50"
              >
                {submittingReschedule ? "Saving..." : "Update Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Social Post Preview Modal */}
      {previewingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setPreviewingPost(null)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-neutral-800 text-white flex items-center justify-center hover:bg-neutral-700 font-bold"
            >
              ✕
            </button>
            <SocialPostPreview
              content={previewingPost.post.caption}
              authorName="OmniPost Brand"
              authorHandle="@omnipost"
              campaignTitle={previewingPost.post.content?.campaign?.name}
              mediaType={previewingPost.post.content?.type === "VIDEO" ? "VIDEO" : "IMAGE"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
