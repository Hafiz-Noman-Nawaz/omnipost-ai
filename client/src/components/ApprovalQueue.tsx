"use client";

import { useCallback, useEffect, useState } from "react";

export interface PostItem {
  id: string;
  organizationId: string;
  contentId: string;
  campaignId: string | null;
  platform: string;
  status: "DRAFT" | "AI_GENERATED" | "AWAITING_APPROVAL" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "FAILED" | "REJECTED" | "CANCELLED";
  caption: string;
  hashtags: string[];
  linkUrl: string | null;
  mediaStorageKeys: string[];
  safetyFlags: {
    ok?: boolean;
    flags?: Array<{ code: string; message: string }>;
  } | null;
  approvedById: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  content?: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    fileUrl: string | null;
    campaign?: {
      id: string;
      name: string;
      objective: string | null;
      cta: string | null;
    } | null;
  };
}

export interface QueueSummary {
  awaitingApproval: number;
  approved: number;
  rejected: number;
  draft: number;
  scheduled: number;
}

const PLATFORM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  X: { bg: "bg-black/60", text: "text-white", border: "border-neutral-800" },
  INSTAGRAM: { bg: "bg-pink-950/40", text: "text-pink-300", border: "border-pink-800/40" },
  LINKEDIN: { bg: "bg-blue-950/40", text: "text-blue-300", border: "border-blue-800/40" },
  TIKTOK: { bg: "bg-purple-950/40", text: "text-purple-300", border: "border-purple-800/40" },
  FACEBOOK: { bg: "bg-indigo-950/40", text: "text-indigo-300", border: "border-indigo-800/40" },
  YOUTUBE: { bg: "bg-red-950/40", text: "text-red-300", border: "border-red-800/40" },
};

const PLATFORM_LIMITS: Record<string, number> = {
  X: 280,
  INSTAGRAM: 2200,
  LINKEDIN: 3000,
  TIKTOK: 2200,
  FACEBOOK: 5000,
  YOUTUBE: 5000,
};

export default function ApprovalQueue() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [summary, setSummary] = useState<QueueSummary>({
    awaitingApproval: 0,
    approved: 0,
    rejected: 0,
    draft: 0,
    scheduled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("AWAITING_APPROVAL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Edit Modal
  const [editingPost, setEditingPost] = useState<PostItem | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Reject Modal
  const [rejectingPostId, setRejectingPostId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Action processing indicators
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedPlatform !== "ALL") params.set("platform", selectedPlatform);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/rest/approvals?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || `Failed to fetch queue: HTTP ${res.status}`);
      }
      const json = await res.json();
      setPosts(json.data.posts || []);
      setSummary(json.data.summary || {
        awaitingApproval: 0,
        approved: 0,
        rejected: 0,
        draft: 0,
        scheduled: 0,
      });
      setSelectedIds([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading queue");
    } finally {
      setLoading(false);
    }
  }, [selectedPlatform, statusFilter, searchQuery]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Bulk Selection Helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === posts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(posts.map((p) => p.id));
    }
  };

  // Actions
  const handleApprove = async (id: string, bypassSafety = false) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/rest/posts/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bypassSafetyWarnings: bypassSafety }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error?.details && !bypassSafety) {
          if (confirm(`Safety Warning: ${json.error.message}\n\nDo you want to bypass and approve anyway?`)) {
            return handleApprove(id, true);
          }
          return;
        }
        throw new Error(json.error?.message || "Failed to approve post");
      }
      await fetchQueue();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error approving post");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/rest/posts/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || "Failed to reject post");
      }
      setRejectingPostId(null);
      setRejectReason("");
      await fetchQueue();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error rejecting post");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/rest/posts/${id}/duplicate`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || "Failed to duplicate post");
      }
      await fetchQueue();
      alert("Post duplicated as draft!");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error duplicating post");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRegenerate = async (id: string) => {
    const notes = prompt("Optional notes/instructions for AI regeneration:") || undefined;
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/rest/posts/${id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || "Failed to regenerate post");
      }
      await fetchQueue();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error regenerating post");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    setSavingEdit(true);
    try {
      const tags = editHashtags
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => (t.startsWith("#") ? t : `#${t}`));

      const res = await fetch(`/api/rest/posts/${editingPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: editCaption,
          hashtags: tags,
          linkUrl: editLinkUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || "Failed to save edits");
      }
      setEditingPost(null);
      await fetchQueue();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving edits");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleBulkAction = async (action: "approve" | "reject") => {
    if (!selectedIds.length) return;
    const confirmMsg = action === "approve"
      ? `Approve ${selectedIds.length} selected post(s)?`
      : `Reject ${selectedIds.length} selected post(s)?`;
    if (!confirm(confirmMsg)) return;

    setBulkProcessing(true);
    try {
      const res = await fetch("/api/rest/approvals/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          postIds: selectedIds,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error?.message || `Failed to bulk ${action}`);
      }
      if (action === "approve" && j.data?.skipped?.length > 0) {
        alert(
          `Approved ${j.data.approvedCount} post(s).\n${j.data.skipped.length} post(s) were skipped due to safety warnings requiring manual review.`
        );
      }
      await fetchQueue();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : `Error during bulk ${action}`);
    } finally {
      setBulkProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Queue Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>🛡️</span> Approval Workflow
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Review, edit, regenerate, and approve AI-generated social posts before publishing (spec §11).
          </p>
        </div>

        {/* Stats Strip */}
        <div className="flex flex-wrap gap-2.5">
          <div className="card px-3.5 py-2 flex items-center gap-2 border border-amber-500/30 bg-amber-950/20">
            <span className="text-amber-400 font-semibold text-base">{summary.awaitingApproval}</span>
            <span className="text-xs text-amber-200/80">Awaiting Review</span>
          </div>
          <div className="card px-3.5 py-2 flex items-center gap-2 border border-emerald-500/30 bg-emerald-950/20">
            <span className="text-emerald-400 font-semibold text-base">{summary.approved}</span>
            <span className="text-xs text-emerald-200/80">Approved</span>
          </div>
          <div className="card px-3.5 py-2 flex items-center gap-2 border border-rose-500/30 bg-rose-950/20">
            <span className="text-rose-400 font-semibold text-base">{summary.rejected}</span>
            <span className="text-xs text-rose-200/80">Rejected</span>
          </div>
          <div className="card px-3.5 py-2 flex items-center gap-2 border border-blue-500/30 bg-blue-950/20">
            <span className="text-blue-400 font-semibold text-base">{summary.scheduled}</span>
            <span className="text-xs text-blue-200/80">Scheduled</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Platform Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {["ALL", "X", "INSTAGRAM", "LINKEDIN", "TIKTOK", "FACEBOOK", "YOUTUBE"].map((plat) => (
              <button
                key={plat}
                type="button"
                onClick={() => setSelectedPlatform(plat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedPlatform === plat
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-[var(--panel-hover)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {plat === "ALL" ? "All Platforms" : plat}
              </button>
            ))}
          </div>

          {/* Status Filter & Search */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs bg-[var(--panel-hover)] border border-[var(--border)] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="AWAITING_APPROVAL">Awaiting Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="DRAFT">Drafts</option>
              <option value="ALL">All Statuses</option>
            </select>

            <input
              type="text"
              placeholder="Search captions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs bg-[var(--panel-hover)] border border-[var(--border)] text-white placeholder-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-48"
            />

            <button
              type="button"
              onClick={fetchQueue}
              className="px-3 py-1.5 rounded-lg text-xs bg-neutral-800 text-[var(--muted)] hover:text-white transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Bulk Action Controls */}
        {posts.length > 0 && (
          <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="select-all"
                checked={selectedIds.length === posts.length && posts.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-[var(--border)] bg-neutral-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="select-all" className="cursor-pointer text-[var(--muted)] select-none">
                Select All ({posts.length})
              </label>
              {selectedIds.length > 0 && (
                <span className="badge badge-accent px-2 py-0.5">
                  {selectedIds.length} selected
                </span>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={bulkProcessing}
                  onClick={() => handleBulkAction("approve")}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  ✓ Approve Selected ({selectedIds.length})
                </button>
                <button
                  type="button"
                  disabled={bulkProcessing}
                  onClick={() => handleBulkAction("reject")}
                  className="px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/50 font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  ✕ Reject Selected ({selectedIds.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="card p-4 border border-rose-500/40 bg-rose-950/20 text-rose-300 text-sm flex items-center gap-3">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="card p-12 text-center text-[var(--muted)] text-sm animate-pulse">
          Loading approval queue...
        </div>
      ) : posts.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="text-3xl">🎉</div>
          <div className="text-base font-medium text-white">Queue is clear!</div>
          <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
            No posts matching the selected filters. Generate variants from the Content Vault to populate the queue.
          </p>
        </div>
      ) : (
        /* Posts Queue Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {posts.map((post) => {
            const isSelected = selectedIds.includes(post.id);
            const style = PLATFORM_COLORS[post.platform] || {
              bg: "bg-neutral-900",
              text: "text-neutral-200",
              border: "border-neutral-800",
            };
            const limit = PLATFORM_LIMITS[post.platform] || 3000;
            const charCount = post.caption.length;
            const isOverLimit = charCount > limit;
            const hasSafetyFlag = post.safetyFlags && post.safetyFlags.ok === false;
            const isPendingAction = actionLoadingId === post.id;

            return (
              <div
                key={post.id}
                className={`card p-5 space-y-4 flex flex-col justify-between transition-all duration-200 ${
                  isSelected ? "ring-2 ring-indigo-500 bg-indigo-950/10" : ""
                } ${hasSafetyFlag ? "border-amber-500/40" : ""}`}
              >
                {/* Top bar: Checkbox, Platform Badge, Status */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(post.id)}
                        className="rounded border-[var(--border)] bg-neutral-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${style.bg} ${style.text} ${style.border}`}>
                        {post.platform}
                      </span>
                      {post.content?.campaign && (
                        <span className="text-xs text-[var(--muted)] truncate max-w-[150px]">
                          🎯 {post.content.campaign.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {post.status === "APPROVED" && (
                        <span className="badge badge-ok text-[11px] px-2 py-0.5">Approved</span>
                      )}
                      {post.status === "AWAITING_APPROVAL" && (
                        <span className="badge badge-warn text-[11px] px-2 py-0.5">Awaiting Review</span>
                      )}
                      {post.status === "AI_GENERATED" && (
                        <span className="badge badge-accent text-[11px] px-2 py-0.5">AI Generated</span>
                      )}
                      {post.status === "REJECTED" && (
                        <span className="badge badge-danger text-[11px] px-2 py-0.5">Rejected</span>
                      )}
                      {post.status === "DRAFT" && (
                        <span className="badge text-[11px] px-2 py-0.5">Draft</span>
                      )}
                    </div>
                  </div>

                  {/* Media Snapshot Preview */}
                  {post.content && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--panel-hover)] border border-[var(--border)] text-xs">
                      <span className="text-lg">
                        {post.content.type === "IMAGE"
                          ? "🖼️"
                          : post.content.type === "VIDEO"
                          ? "🎬"
                          : post.content.type === "DOCUMENT"
                          ? "📄"
                          : "📝"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-white truncate">{post.content.title}</div>
                        {post.content.description && (
                          <div className="text-[var(--muted)] text-[11px] truncate">
                            {post.content.description}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Safety Warning Banner if any */}
                  {hasSafetyFlag && (
                    <div className="p-3 rounded-lg border border-amber-500/50 bg-amber-950/30 text-amber-200 text-xs space-y-1.5">
                      <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                        <span>⚠️</span> Content Safety Guardrail Triggered
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200/90 pl-1">
                        {post.safetyFlags?.flags?.map((f, idx) => (
                          <li key={idx}>{f.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Post Caption & Content */}
                  <div className="space-y-2">
                    <div className="p-3.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-sm text-neutral-100 whitespace-pre-wrap leading-relaxed font-sans">
                      {post.caption}
                    </div>

                    {/* Hashtags */}
                    {post.hashtags && post.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {post.hashtags.map((tag, i) => (
                          <span key={i} className="text-xs text-indigo-400 font-mono">
                            {tag.startsWith("#") ? tag : `#${tag}`}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Attached CTA / Link (spec §11) */}
                    {post.linkUrl && (
                      <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-950/20 border border-cyan-800/30 px-3 py-1.5 rounded-lg">
                        <span>🔗</span>
                        <span className="font-mono truncate">{post.linkUrl}</span>
                      </div>
                    )}

                    {/* Rejection reason notice if rejected */}
                    {post.status === "REJECTED" && post.rejectedReason && (
                      <div className="text-xs text-rose-300 bg-rose-950/20 border border-rose-800/30 p-2.5 rounded-lg">
                        <span className="font-semibold">Rejection note:</span> {post.rejectedReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: Character limits & Actions */}
                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span className={isOverLimit ? "text-rose-400 font-semibold" : ""}>
                      {charCount} / {limit} chars
                    </span>
                    <span>Created {new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {/* Secondary Actions: Edit, Duplicate, Regenerate */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isPendingAction}
                        onClick={() => {
                          setEditingPost(post);
                          setEditCaption(post.caption);
                          setEditHashtags(post.hashtags.join(" "));
                          setEditLinkUrl(post.linkUrl || "");
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--panel-hover)] text-xs text-[var(--muted)] hover:text-white transition-colors"
                        title="Edit caption and metadata"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        disabled={isPendingAction}
                        onClick={() => handleRegenerate(post.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--panel-hover)] text-xs text-[var(--muted)] hover:text-white transition-colors"
                        title="Regenerate caption with AI"
                      >
                        🔄 Regen
                      </button>
                      <button
                        type="button"
                        disabled={isPendingAction}
                        onClick={() => handleDuplicate(post.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--panel-hover)] text-xs text-[var(--muted)] hover:text-white transition-colors"
                        title="Duplicate as new draft"
                      >
                        📑 Copy
                      </button>
                    </div>

                    {/* Primary Decision Actions: Reject vs Approve */}
                    <div className="flex items-center gap-2">
                      {post.status !== "REJECTED" && (
                        <button
                          type="button"
                          disabled={isPendingAction}
                          onClick={() => {
                            setRejectingPostId(post.id);
                            setRejectReason("");
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300 hover:bg-rose-900/60 font-medium transition-colors"
                        >
                          ✕ Reject
                        </button>
                      )}

                      {post.status !== "APPROVED" && (
                        <button
                          type="button"
                          disabled={isPendingAction}
                          onClick={() => handleApprove(post.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1"
                        >
                          {isPendingAction ? "Saving..." : "✓ Approve"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="card w-full max-w-xl p-6 space-y-4 bg-neutral-900 border border-neutral-700 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>✏️</span> Edit Post ({editingPost.platform})
              </h2>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="text-[var(--muted)] hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Caption
                </label>
                <textarea
                  rows={6}
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-[var(--border)] text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="text-right text-xs text-[var(--muted)] mt-1">
                  {editCaption.length} / {PLATFORM_LIMITS[editingPost.platform] || 3000} characters
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Hashtags (space or comma separated)
                </label>
                <input
                  type="text"
                  value={editHashtags}
                  onChange={(e) => setEditHashtags(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-[var(--border)] text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="#tech #programming #productivity"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  CTA / Landing URL
                </label>
                <input
                  type="url"
                  value={editLinkUrl}
                  onChange={(e) => setEditLinkUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-[var(--border)] text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="https://yourbrand.com/offer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="px-4 py-2 rounded-lg bg-[var(--panel-hover)] text-xs text-[var(--muted)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit || !editCaption.trim()}
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-50"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 space-y-4 bg-neutral-900 border border-neutral-700 shadow-2xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>✕</span> Reject Post
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Provide an optional reason to explain why this post was rejected (useful for audit tracking and AI feedback):
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Tone too informal; need more focus on product warranty; bad hook."
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-[var(--border)] text-xs text-white placeholder-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-rose-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingPostId(null);
                  setRejectReason("");
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--panel-hover)] text-xs text-[var(--muted)] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReject(rejectingPostId, rejectReason)}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
