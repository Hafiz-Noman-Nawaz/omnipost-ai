"use client";

import { useState, useEffect } from "react";

interface CommentItem {
  id: string;
  postId: string;
  platform: string;
  platformCommentId: string;
  parentPlatformCommentId?: string | null;
  authorName?: string | null;
  text: string;
  intent?: string | null;
  intentConfidence?: number | null;
  sentiment?: string | null;
  safetyFlags?: string[] | null;
  hidden: boolean;
  hiddenBy?: string | null;
  status: string;
  postedAt?: string | null;
  createdAt: string;
  post: {
    id: string;
    caption: string;
    platform: string;
    status: string;
    content?: {
      id: string;
      title: string;
      type: string;
    } | null;
  };
  thread?: {
    id: string;
    requiresHuman: boolean;
    status: string;
  } | null;
}

interface SummaryData {
  total: number;
  statusCounts: Record<string, number>;
  intentCounts: Record<string, number>;
  requiresHuman: number;
}

interface Suggestion {
  text: string;
  tone: string;
  confidence: number;
}

interface Template {
  id: string;
  name: string;
  intent: string;
  body: string;
}

export default function CommentsInbox() {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Action states
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [suggestionsComment, setSuggestionsComment] = useState<CommentItem | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Reply drawer / modal state
  const [replyingComment, setReplyingComment] = useState<CommentItem | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // Manual simulate comment modal
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simText, setSimText] = useState("");
  const [simAuthor, setSimAuthor] = useState("");
  const [simPlatform, setSimPlatform] = useState("INSTAGRAM");
  const [simulating, setSimulating] = useState(false);

  const fetchComments = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedPlatform !== "ALL") params.set("platform", selectedPlatform);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      if (activeTab === "ATTENTION") {
        params.set("requiresHuman", "true");
      } else if (activeTab === "QUESTIONS") {
        params.set("intent", "QUESTION");
      } else if (activeTab === "PRICING") {
        params.set("intent", "PRICING");
      } else if (activeTab === "SPAM") {
        params.set("status", "ESCALATED");
      } else if (activeTab === "HANDLED") {
        params.set("status", "HANDLED");
      }

      const res = await fetch(`/api/rest/comments?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load comments");
      const json = await res.json();
      setComments(json.data.comments || []);
      setSummary(json.data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading comments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [activeTab, selectedPlatform]);

  const handleSyncComments = async () => {
    try {
      setSyncing(true);
      setError(null);
      const res = await fetch("/api/rest/comments/sync", { method: "POST" });
      if (!res.ok) throw new Error("Failed to sync comments");
      const json = await res.json();
      setSuccessMsg(`Synced ${json.data.syncedCount} comment(s), classified ${json.data.classifiedCount} with AI.`);
      await fetchComments();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync error");
    } finally {
      setSyncing(false);
    }
  };

  const handleClassify = async (commentId: string) => {
    try {
      setClassifyingId(commentId);
      const res = await fetch(`/api/rest/comments/${commentId}/classify`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Classification failed");
      await fetchComments();
      setSuccessMsg("AI intent classification updated.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to classify comment");
    } finally {
      setClassifyingId(null);
    }
  };

  const handleOpenSuggestions = async (comment: CommentItem) => {
    setSuggestionsComment(comment);
    setSuggestions([]);
    setTemplates([]);
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`/api/rest/comments/${comment.id}/suggestions`);
      if (!res.ok) throw new Error("Failed to load suggestions");
      const json = await res.json();
      setSuggestions(json.data.suggestions || []);
      setTemplates(json.data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleEscalate = async (commentId: string) => {
    try {
      const res = await fetch(`/api/rest/comments/${commentId}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Operator flagged for human review" }),
      });
      if (!res.ok) throw new Error("Failed to escalate comment");
      await fetchComments();
      setSuccessMsg("Comment escalated to Human Attention.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to escalate");
    }
  };

  const handleHide = async (commentId: string) => {
    try {
      const res = await fetch(`/api/rest/comments/${commentId}/hide`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to hide comment");
      await fetchComments();
      setSuccessMsg("Comment marked hidden.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to hide");
    }
  };

  const handleSendReply = async () => {
    if (!replyingComment || !replyText.trim()) return;
    try {
      setSendingReply(true);
      const res = await fetch(`/api/rest/comments/${replyingComment.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyText: replyText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to send reply");
      setSuccessMsg("Reply published successfully!");
      setReplyingComment(null);
      setReplyText("");
      await fetchComments();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  const handleSimulateInbound = async () => {
    if (!simText.trim()) return;
    try {
      setSimulating(true);
      const firstPost = comments[0]?.post?.id || "mock_post";
      const res = await fetch("/api/rest/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: firstPost,
          platform: simPlatform,
          authorName: simAuthor || "CommunityMember",
          text: simText.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to simulate comment");
      const json = await res.json();
      // Auto classify it
      await fetch(`/api/rest/comments/${json.data.id}/classify`, { method: "POST" });
      setSimModalOpen(false);
      setSimText("");
      setSimAuthor("");
      setSuccessMsg("Simulated inbound comment ingested and classified.");
      await fetchComments();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation error");
    } finally {
      setSimulating(false);
    }
  };

  const getIntentBadgeColor = (intent?: string | null) => {
    switch (intent) {
      case "PURCHASE_INTENT":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "PRICING":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      case "QUESTION":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "POSITIVE":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "NEGATIVE":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "COMPLAINT":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "SPAM":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "ABUSE":
        return "bg-rose-600/25 text-rose-300 border-rose-500/40";
      case "PARTNERSHIP":
        return "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Metrics Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>💬</span> Comments & Community Moderation
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Inbound comment ingestion, zero-injection AI classification, response suggestions, and human escalation workflows.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSimModalOpen(true)}
            className="btn btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
          >
            <span>➕</span> Simulate Inbound
          </button>
          <button
            onClick={handleSyncComments}
            disabled={syncing}
            className="btn btn-primary text-xs px-3.5 py-2 flex items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            <span className={syncing ? "animate-spin" : ""}>🔄</span>
            {syncing ? "Syncing APIs..." : "Sync Live Comments"}
          </button>
        </div>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs opacity-75 hover:opacity-100">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-xs opacity-75 hover:opacity-100">✕</button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--border)] backdrop-blur-md">
          <div className="text-xs text-[var(--muted)] font-medium">Total Ingested</div>
          <div className="text-2xl font-bold text-white mt-1">{summary?.total ?? comments.length}</div>
          <div className="text-[11px] text-[var(--muted-dark)] mt-1">Multi-platform synced</div>
        </div>

        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 backdrop-blur-md">
          <div className="text-xs text-amber-300 font-medium flex items-center justify-between">
            <span>Requires Attention</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-amber-200 mt-1">{summary?.requiresHuman ?? 0}</div>
          <div className="text-[11px] text-amber-400/70 mt-1">Escalated / complaints</div>
        </div>

        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 backdrop-blur-md">
          <div className="text-xs text-blue-300 font-medium">Questions & Buying</div>
          <div className="text-2xl font-bold text-blue-200 mt-1">
            {(summary?.intentCounts?.QUESTION ?? 0) + (summary?.intentCounts?.PURCHASE_INTENT ?? 0) + (summary?.intentCounts?.PRICING ?? 0)}
          </div>
          <div className="text-[11px] text-blue-400/70 mt-1">High conversion opportunities</div>
        </div>

        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 backdrop-blur-md">
          <div className="text-xs text-emerald-300 font-medium">Handled / Resolved</div>
          <div className="text-2xl font-bold text-emerald-200 mt-1">{summary?.statusCounts?.HANDLED ?? 0}</div>
          <div className="text-[11px] text-emerald-400/70 mt-1">Replied or closed</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 rounded-xl bg-[var(--panel)] border border-[var(--border)] backdrop-blur-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: "ALL", label: "All" },
            { id: "ATTENTION", label: "🚨 Needs Attention" },
            { id: "QUESTIONS", label: "Questions" },
            { id: "PRICING", label: "Pricing / Purchase" },
            { id: "SPAM", label: "Spam / Flagged" },
            { id: "HANDLED", label: "Handled" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-white hover:bg-[var(--panel-hover)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Platform & Search Controls */}
        <div className="flex items-center gap-2">
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="input text-xs py-1.5 px-2.5 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white"
          >
            <option value="ALL">All Platforms</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="LINKEDIN">LinkedIn</option>
            <option value="TIKTOK">TikTok</option>
            <option value="X">X (Twitter)</option>
            <option value="YOUTUBE">YouTube</option>
          </select>

          <div className="relative">
            <input
              type="text"
              placeholder="Search text or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchComments()}
              className="input text-xs py-1.5 pl-7 pr-3 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white w-44 sm:w-56"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--muted)]">🔍</span>
          </div>
        </div>
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="card p-12 text-center text-sm text-[var(--muted)]">
          <div className="inline-block animate-spin text-2xl mb-2">⚡</div>
          <div>Loading comments and classification intelligence...</div>
        </div>
      ) : comments.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">💬</div>
          <div className="text-base font-semibold text-white">No comments found</div>
          <p className="text-xs text-[var(--muted)] mt-1 max-w-sm mx-auto">
            {activeTab !== "ALL"
              ? "No comments match this filter tab. Switch tabs or click below to ingest new ones."
              : "No inbound comments have been synced yet. Connect social accounts or simulate test comments."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button onClick={() => setSimModalOpen(true)} className="btn btn-secondary text-xs px-3.5 py-1.5">
              Simulate Test Comment
            </button>
            <button onClick={handleSyncComments} className="btn btn-primary text-xs px-3.5 py-1.5">
              Sync Live APIs
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`p-4 rounded-xl bg-[var(--panel)] border transition-all ${
                comment.thread?.requiresHuman
                  ? "border-amber-500/40 bg-amber-950/10 shadow-lg shadow-amber-950/20"
                  : comment.hidden
                    ? "border-red-500/20 opacity-60"
                    : "border-[var(--border)] hover:border-indigo-500/30"
              }`}
            >
              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                    {(comment.authorName || "U")[0]?.toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-white">
                      {comment.authorName || "Anonymous User"}
                    </span>
                    <span className="text-[11px] text-[var(--muted)] ml-2">
                      via <span className="font-medium text-white">{comment.platform}</span>
                    </span>
                  </div>
                  <span className="badge badge-accent text-[9px] px-1.5 py-0">
                    {new Date(comment.postedAt || comment.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                {/* Intent & status tags */}
                <div className="flex items-center gap-1.5">
                  {comment.intent ? (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getIntentBadgeColor(
                        comment.intent
                      )}`}
                    >
                      {comment.intent}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[var(--muted)] px-2 py-0.5 rounded-full border border-white/5 bg-black/20">
                      UNCLASSIFIED
                    </span>
                  )}

                  {comment.sentiment && (
                    <span className="text-[10px] text-[var(--muted)] px-1.5 py-0.5 rounded bg-black/20 border border-white/5">
                      {comment.sentiment}
                    </span>
                  )}

                  {comment.intentConfidence && (
                    <span className="text-[10px] text-[var(--muted)]" title="AI confidence score">
                      {Math.round(comment.intentConfidence * 100)}%
                    </span>
                  )}

                  {comment.thread?.requiresHuman && (
                    <span className="badge badge-warn text-[10px] px-1.5 py-0">⚠️ Needs Human</span>
                  )}

                  {comment.status === "HANDLED" && (
                    <span className="badge badge-ok text-[10px] px-1.5 py-0">✓ Handled</span>
                  )}

                  {comment.hidden && (
                    <span className="badge text-[10px] bg-red-950/60 text-red-300 border border-red-500/30 px-1.5 py-0">
                      Hidden
                    </span>
                  )}
                </div>
              </div>

              {/* Safety warning callout if flagged */}
              {comment.safetyFlags && comment.safetyFlags.length > 0 && (
                <div className="mb-2.5 p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                  <span>🛡️</span>
                  <span>Safety Flagged: {comment.safetyFlags.join(", ")}</span>
                </div>
              )}

              {/* Untrusted Comment Content (Spec §42: raw content strictly styled as isolated data) */}
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-sm text-gray-200 leading-relaxed font-sans mb-3 select-text">
                &ldquo;{comment.text}&rdquo;
              </div>

              {/* Post context snippet */}
              <div className="text-[11px] text-[var(--muted)] flex items-center gap-1.5 mb-3">
                <span>📌</span>
                <span className="truncate max-w-lg">
                  Context: <span className="text-gray-300 italic">&ldquo;{comment.post.caption.slice(0, 90)}...&rdquo;</span>
                </span>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="pt-2 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleClassify(comment.id)}
                    disabled={classifyingId === comment.id}
                    className="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1"
                    title="Run or re-run LLM intent classification"
                  >
                    <span className={classifyingId === comment.id ? "animate-spin" : ""}>🤖</span>
                    {classifyingId === comment.id ? "Classifying..." : "Classify"}
                  </button>

                  <button
                    onClick={() => handleOpenSuggestions(comment)}
                    className="btn btn-secondary text-xs px-2.5 py-1 flex items-center gap-1 text-indigo-300 hover:text-white"
                    title="Generate contextual smart replies"
                  >
                    <span>💡</span> Suggestions
                  </button>

                  <button
                    onClick={() => {
                      setReplyingComment(comment);
                      setReplyText("");
                    }}
                    className="btn btn-primary text-xs px-3 py-1 flex items-center gap-1"
                  >
                    <span>💬</span> Reply
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {!comment.thread?.requiresHuman && (
                    <button
                      onClick={() => handleEscalate(comment.id)}
                      className="text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded hover:bg-amber-950/30 transition-colors"
                      title="Mark as requiring human operator attention"
                    >
                      🚨 Escalate
                    </button>
                  )}

                  {!comment.hidden && (
                    <button
                      onClick={() => handleHide(comment.id)}
                      className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 rounded hover:bg-red-950/20 transition-colors"
                      title="Hide comment on social platform"
                    >
                      👁️ Hide
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Suggestions Modal */}
      {suggestionsComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-[var(--panel-solid)] border border-[var(--border)] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <h3 className="font-semibold text-white">AI Reply Suggestions</h3>
              </div>
              <button
                onClick={() => setSuggestionsComment(null)}
                className="text-sm text-[var(--muted)] hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Inbound context */}
            <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-gray-300">
              <span className="text-[var(--muted)] font-medium">Inbound comment from {suggestionsComment.authorName}:</span>
              <p className="mt-1 italic">&ldquo;{suggestionsComment.text}&rdquo;</p>
            </div>

            {loadingSuggestions ? (
              <div className="p-8 text-center text-sm text-[var(--muted)]">
                <div className="inline-block animate-spin text-xl mb-2">⚡</div>
                <div>Generating brand-aligned reply suggestions...</div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[var(--muted)]">Recommended Replies:</div>
                {suggestions.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[var(--panel)] border border-[var(--border)] hover:border-indigo-500/40 transition-all flex flex-col justify-between gap-2"
                  >
                    <div className="text-sm text-gray-200">{s.text}</div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="badge badge-accent text-[9px] px-1.5 py-0">{s.tone}</span>
                        <span className="text-[10px] text-[var(--muted)]">{Math.round(s.confidence * 100)}% match</span>
                      </div>
                      <button
                        onClick={() => {
                          setReplyingComment(suggestionsComment);
                          setReplyText(s.text);
                          setSuggestionsComment(null);
                        }}
                        className="btn btn-secondary text-xs px-2.5 py-1 text-indigo-300 hover:text-white"
                      >
                        Use This Reply →
                      </button>
                    </div>
                  </div>
                ))}

                {templates.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-semibold text-[var(--muted)]">Saved Response Templates:</div>
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="p-2.5 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-medium text-white">{tpl.name}</div>
                          <div className="text-[var(--muted)] text-[11px] truncate max-w-sm">{tpl.body}</div>
                        </div>
                        <button
                          onClick={() => {
                            setReplyingComment(suggestionsComment);
                            setReplyText(tpl.body);
                            setSuggestionsComment(null);
                          }}
                          className="btn btn-secondary text-xs px-2 py-0.5"
                        >
                          Use
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reply Composer Modal */}
      {replyingComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--panel-solid)] border border-[var(--border)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="text-xl">💬</span>
                <h3 className="font-semibold text-white">Reply to {replyingComment.authorName || "User"}</h3>
              </div>
              <button
                onClick={() => setReplyingComment(null)}
                className="text-sm text-[var(--muted)] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-gray-300">
              <span className="text-[var(--muted)] font-medium">In reply to ({replyingComment.platform}):</span>
              <p className="mt-1 italic">&ldquo;{replyingComment.text}&rdquo;</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300">Reply Message:</label>
              <textarea
                rows={4}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your authentic response..."
                className="input text-xs w-full p-3 bg-[var(--panel-2)] border-[var(--border)] rounded-xl text-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReplyingComment(null)}
                className="btn btn-secondary text-xs px-3 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReply}
                disabled={sendingReply || !replyText.trim()}
                className="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <span>🚀</span>
                {sendingReply ? "Publishing Reply..." : "Send Reply"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulate Inbound Comment Modal */}
      {simModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[var(--panel-solid)] border border-[var(--border)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="text-xl">➕</span>
                <h3 className="font-semibold text-white">Simulate Inbound Comment</h3>
              </div>
              <button onClick={() => setSimModalOpen(false)} className="text-sm text-[var(--muted)] hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-300">Platform</label>
                <select
                  value={simPlatform}
                  onChange={(e) => setSimPlatform(e.target.value)}
                  className="input text-xs w-full mt-1 p-2 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white"
                >
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="FACEBOOK">Facebook</option>
                  <option value="LINKEDIN">LinkedIn</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="X">X (Twitter)</option>
                  <option value="YOUTUBE">YouTube</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300">Author Username</label>
                <input
                  type="text"
                  placeholder="e.g. dev_sarah"
                  value={simAuthor}
                  onChange={(e) => setSimAuthor(e.target.value)}
                  className="input text-xs w-full mt-1 p-2 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300">Comment Text</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Does this support multi-brand scheduling? How much is it?"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  className="input text-xs w-full mt-1 p-2.5 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setSimModalOpen(false)} className="btn btn-secondary text-xs px-3 py-2">
                Cancel
              </button>
              <button
                onClick={handleSimulateInbound}
                disabled={simulating || !simText.trim()}
                className="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <span>⚡</span>
                {simulating ? "Ingesting..." : "Ingest & Classify"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
