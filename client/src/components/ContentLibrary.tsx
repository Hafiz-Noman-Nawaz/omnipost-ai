"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ContentItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  text: string | null;
  linkUrl: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  tags: string[];
  status: string;
  campaignId: string | null;
  createdAt: string;
  fileUrl: string | null;
}

const TYPE_ICON: Record<string, string> = {
  IMAGE: "🖼️",
  VIDEO: "🎬",
  DOCUMENT: "📄",
  TEXT: "📝",
  LINK: "🔗",
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "badge",
  PROCESSING: "badge badge-warn",
  READY: "badge badge-ok",
  SCHEDULED: "badge",
  PUBLISHED: "badge badge-ok",
  FAILED: "badge badge-danger",
  ARCHIVED: "badge",
};

function fmtSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

interface CampaignOption {
  id: string;
  name: string;
  status: string;
}

interface VariantRow {
  id: string;
  platform: string;
  caption: string;
  hashtags: string[];
  hook: string | null;
  cta: string | null;
  model: string | null;
  promptVersion: string | null;
  safetyFlags: { ok: boolean; flags: Array<{ code: string; message: string }> } | null;
  approved: boolean | null;
}

const PLATFORMS = [
  { key: "X", label: "X (Twitter)", icon: "🐦", maxChars: 280, color: "text-sky-400" },
  { key: "INSTAGRAM", label: "Instagram", icon: "📸", maxChars: 2200, color: "text-pink-400" },
  { key: "LINKEDIN", label: "LinkedIn", icon: "💼", maxChars: 3000, color: "text-blue-400" },
  { key: "TIKTOK", label: "TikTok", icon: "🎵", maxChars: 2200, color: "text-cyan-400" },
  { key: "FACEBOOK", label: "Facebook", icon: "👥", maxChars: 5000, color: "text-indigo-400" },
  { key: "YOUTUBE", label: "YouTube", icon: "🎥", maxChars: 5000, color: "text-red-400" },
] as const;

export default function ContentLibrary() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [meta, setMeta] = useState<{ page: number; pageSize: number; total: number } | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [textCampaignId, setTextCampaignId] = useState("");

  // AI Generation State
  const [genFor, setGenFor] = useState<string | null>(null); // content id
  const [genPlatforms, setGenPlatforms] = useState<string[]>(["X", "LINKEDIN"]);
  const [genBusy, setGenBusy] = useState(false);
  const [genResult, setGenResult] = useState<string | null>(null);
  const [variantsFor, setVariantsFor] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  // Variant editing state
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editHook, setEditHook] = useState("");
  const [editCta, setEditCta] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // General state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showTextForm, setShowTextForm] = useState(false);
  const [textType, setTextType] = useState("TEXT");
  const [textTitle, setTextTitle] = useState("");
  const [textBody, setTextBody] = useState("");
  const [textUrl, setTextUrl] = useState("");
  const [textBusy, setTextBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      if (tag) params.set("tag", tag);
      if (campaignId) params.set("campaignId", campaignId);
      const res = await fetch(`/api/rest/content?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load content");
      setItems(json.data);
      setMeta(json.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [q, type, status, tag, campaignId]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rest/campaigns?pageSize=100");
        if (!res.ok) return;
        const json = await res.json();
        setCampaigns(json.data ?? []);
      } catch {
        // Non-fatal
      }
    })();
  }, []);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!files || (files as ArrayLike<File>).length === 0) return;
      setUploading(true);
      setUploadResult(null);
      setError(null);
      try {
        const form = new FormData();
        for (const f of Array.from(files)) form.append("files", f);
        const res = await fetch("/api/rest/content/upload", { method: "POST", body: form });
        const json = await res.json();
        if (!res.ok && !json?.data) {
          throw new Error(json?.error?.message ?? "Upload failed");
        }
        const d = json.data as {
          created: unknown[];
          duplicates: Array<{ filename: string }>;
          failed: Array<{ filename: string; error: string }>;
        };
        const parts: string[] = [];
        if (d.created.length) parts.push(`${d.created.length} uploaded successfully`);
        if (d.duplicates.length) parts.push(`${d.duplicates.length} duplicate(s) skipped`);
        if (d.failed.length) parts.push(`${d.failed.length} failed`);
        setUploadResult(parts.join(" · ") || "Upload complete");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [load],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer?.files?.length) void uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles],
  );

  const archiveItem = async (id: string) => {
    const res = await fetch(`/api/rest/content/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Failed to archive");
      return;
    }
    await load();
  };

  const openVariants = async (contentId: string) => {
    if (variantsFor === contentId) {
      setVariantsFor(null);
      return;
    }
    setVariantsFor(contentId);
    setVariantsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rest/content/${contentId}/variants`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to load variants");
      setVariants(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load variants");
      setVariantsFor(null);
    } finally {
      setVariantsLoading(false);
    }
  };

  const generate = async (contentId: string, specificPlatform?: string) => {
    const targets = specificPlatform ? [specificPlatform] : genPlatforms;
    if (targets.length === 0) {
      setError("Select at least one platform.");
      return;
    }
    setGenBusy(true);
    setError(null);
    setGenResult(null);
    try {
      const res = await fetch(`/api/rest/content/${contentId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: targets }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Generation failed");
      const d = json.data as {
        provider: string;
        model: string;
        isMock: boolean;
        results: Array<{ platform: string; status: string; flags: Array<{ message: string }>; error?: string }>;
      };
      const okCount = d.results.filter((r) => r.status !== "failed").length;
      const flagged = d.results.flatMap((r) => r.flags);
      const failed = d.results.filter((r) => r.status === "failed");
      const parts = [
        `${okCount}/${d.results.length} platform variant(s) generated`,
        d.isMock ? "(Engine: Mock AI · set ANTHROPIC_API_KEY for live Claude)" : `Model: ${d.model}`,
      ];
      if (flagged.length) parts.push(`⚠ ${flagged.length} safety alert(s) detected`);
      if (failed.length) parts.push(`Failed: ${failed.map((f) => `${f.platform}: ${f.error}`).join("; ")}`);
      setGenResult(parts.join(" · "));
      await openVariants(contentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenBusy(false);
    }
  };

  const setApproval = async (variantId: string, contentId: string, approved: boolean) => {
    setError(null);
    const res = await fetch(`/api/rest/variants/${variantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Could not update variant approval");
      return;
    }
    await openVariants(contentId);
  };

  const startEdit = (v: VariantRow) => {
    setEditingVariantId(v.id);
    setEditCaption(v.caption);
    setEditHook(v.hook ?? "");
    setEditCta(v.cta ?? "");
    setEditHashtags(v.hashtags.join(" "));
  };

  const saveEdit = async (variantId: string, contentId: string) => {
    setSaveBusy(true);
    setError(null);
    try {
      const parsedTags = editHashtags
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean);

      const res = await fetch(`/api/rest/variants/${variantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: editCaption,
          hook: editHook || null,
          cta: editCta || null,
          hashtags: parsedTags,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to save edits");
      setEditingVariantId(null);
      await openVariants(contentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaveBusy(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`card text-center transition-all duration-200 border-2 border-dashed ${
          dragOver
            ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
            : "border-white/10 hover:border-white/20 bg-[var(--panel)]"
        }`}
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept="image/*,video/mp4,video/quicktime,video/webm,video/x-matroska,.pdf,.txt,.md,.json,.csv"
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="py-4 sm:py-6 flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
            {uploading ? "⏳" : "📤"}
          </div>
          <div>
            <p className="text-base font-semibold text-white">
              {uploading ? "Processing and storing assets…" : "Drop images, videos, or documents here"}
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              or{" "}
              <button
                type="button"
                className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                browse local files
              </button>{" "}
              · Up to 50 files · 500 MB max per item
            </p>
          </div>
          {uploadResult && (
            <div className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              ✓ {uploadResult}
            </div>
          )}
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="card space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <input
              className="flex-1 min-w-[200px]"
              placeholder="Search content by title, filename, tags…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="flex gap-2">
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-auto">
                <option value="">All Types</option>
                <option value="IMAGE">Images 🖼️</option>
                <option value="VIDEO">Videos 🎬</option>
                <option value="TEXT">Text 📝</option>
                <option value="LINK">Links 🔗</option>
                <option value="DOCUMENT">Docs 📄</option>
              </select>

              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="READY">Ready</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {campaigns.length > 0 && (
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="w-auto">
                <option value="">All Campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    🎯 {c.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              className="btn btn-primary text-xs"
              onClick={() => setShowTextForm(!showTextForm)}
            >
              {showTextForm ? "Close Form" : "+ Create Text/Link"}
            </button>
          </div>
        </div>

        {tag && (
          <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)] text-xs">
            <span className="text-[var(--muted)]">Active tag filter:</span>
            <span className="badge badge-accent">#{tag}</span>
            <button
              type="button"
              className="text-[var(--muted)] hover:text-white underline"
              onClick={() => setTag("")}
            >
              Clear tag
            </button>
          </div>
        )}
      </div>

      {/* Quick Text / Link Creator Form */}
      {showTextForm && (
        <form
          className="card space-y-4 border border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 to-[var(--panel)]"
          onSubmit={async (e) => {
            e.preventDefault();
            setTextBusy(true);
            setError(null);
            try {
              const res = await fetch("/api/rest/content", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: textType,
                  title: textTitle,
                  ...(textType === "TEXT" ? { text: textBody } : { linkUrl: textUrl }),
                  ...(textCampaignId ? { campaignId: textCampaignId } : {}),
                }),
              });
              const json = await res.json().catch(() => null);
              if (!res.ok) throw new Error(json?.error?.message ?? "Could not save content");
              setTextTitle("");
              setTextBody("");
              setTextUrl("");
              setShowTextForm(false);
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to create content");
            } finally {
              setTextBusy(false);
            }
          }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <span className="font-semibold text-white text-sm">Add Text Snippet or Article Link</span>
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn btn-sm ${textType === "TEXT" ? "btn-primary" : ""}`}
                onClick={() => setTextType("TEXT")}
              >
                Text / Blog
              </button>
              <button
                type="button"
                className={`btn btn-sm ${textType === "LINK" ? "btn-primary" : ""}`}
                onClick={() => setTextType("LINK")}
              >
                External URL
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-medium text-[var(--muted)]">
              Title *
              <input
                required
                className="mt-1"
                placeholder="Product launch announcement / Blog highlight"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-[var(--muted)]">
              Assign to Campaign (optional)
              <select
                className="mt-1"
                value={textCampaignId}
                onChange={(e) => setTextCampaignId(e.target.value)}
              >
                <option value="">— No campaign —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {textType === "TEXT" ? (
            <label className="block text-xs font-medium text-[var(--muted)]">
              Content Body
              <textarea
                required
                rows={4}
                className="mt-1"
                placeholder="Paste blog content, product specs, or talking points for the AI generator…"
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
              />
            </label>
          ) : (
            <label className="block text-xs font-medium text-[var(--muted)]">
              Destination URL *
              <input
                required
                type="url"
                className="mt-1"
                placeholder="https://yourbrand.com/products/item"
                value={textUrl}
                onChange={(e) => setTextUrl(e.target.value)}
              />
            </label>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowTextForm(false)}
            >
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" disabled={textBusy} type="submit">
              {textBusy ? "Saving…" : "Save to Vault"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Content Vault Grid */}
      {loading ? (
        <div className="py-16 text-center text-sm text-[var(--muted)] card">
          <div className="animate-spin text-2xl mb-2">⏳</div>
          Loading vault assets…
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-sm text-[var(--muted)] card">
          <div className="text-3xl mb-2">📁</div>
          <div className="font-semibold text-white">No content assets found</div>
          <p className="text-xs text-[var(--muted)] mt-1">
            Drag and drop images, videos, or create text posts above to begin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <div
              key={item.id}
              className="card card-interactive flex flex-col justify-between overflow-hidden"
            >
              <div>
                {/* Media Preview */}
                {item.type === "IMAGE" && item.fileUrl ? (
                  <div className="relative w-full h-40 bg-black/40 rounded-lg overflow-hidden mb-3 border border-white/5">
                    <img
                      src={item.fileUrl}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                ) : item.type === "VIDEO" && item.fileUrl ? (
                  <div className="relative w-full h-40 bg-black/40 rounded-lg overflow-hidden mb-3 border border-white/5">
                    <video
                      src={item.fileUrl}
                      controls
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-20 rounded-lg bg-[var(--panel-2)] border border-white/5 flex items-center justify-center text-3xl mb-3">
                    {TYPE_ICON[item.type] ?? "📄"}
                  </div>
                )}

                {/* Header badges */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="badge text-[11px] font-semibold">
                    {TYPE_ICON[item.type]} {item.type}
                  </span>
                  <span className={STATUS_BADGE[item.status] ?? "badge"}>{item.status}</span>
                </div>

                <h3 className="font-semibold text-white text-sm truncate" title={item.title}>
                  {item.title}
                </h3>

                <div className="text-xs text-[var(--muted)] mt-1 truncate">
                  {item.originalFilename ?? item.linkUrl ?? item.text?.slice(0, 50) ?? "—"}
                </div>

                <div className="text-[11px] text-[var(--muted-dark)] mt-1">
                  {fmtSize(item.sizeBytes)} · {new Date(item.createdAt).toLocaleDateString()}
                </div>

                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {item.tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="badge text-[10px] hover:text-white"
                        onClick={() => setTag(t)}
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-[var(--border)] space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm flex-1"
                    onClick={() => {
                      setGenFor(genFor === item.id ? null : item.id);
                      setGenResult(null);
                    }}
                  >
                    ✨ AI Studio
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => openVariants(item.id)}
                  >
                    {variantsFor === item.id ? "Hide Drafts" : "View Drafts"}
                  </button>

                  {item.fileUrl && (
                    <a
                      href={item.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm"
                      title="Open full asset"
                    >
                      ↗
                    </a>
                  )}

                  {item.status !== "ARCHIVED" && (
                    <button
                      type="button"
                      className="btn btn-sm text-red-400 hover:text-red-300"
                      onClick={() => archiveItem(item.id)}
                      title="Archive asset"
                    >
                      Archive
                    </button>
                  )}
                </div>

                {/* Expandable Phase 4 AI Generator Panel */}
                {genFor === item.id && (
                  <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-3 mt-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span>Select Target Platforms:</span>
                      <button
                        type="button"
                        className="text-[11px] text-indigo-400 hover:text-indigo-300"
                        onClick={() =>
                          setGenPlatforms(
                            genPlatforms.length === PLATFORMS.length
                              ? []
                              : PLATFORMS.map((p) => p.key),
                          )
                        }
                      >
                        {genPlatforms.length === PLATFORMS.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {PLATFORMS.map((p) => {
                        const active = genPlatforms.includes(p.key);
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() =>
                              setGenPlatforms((prev) =>
                                active ? prev.filter((x) => x !== p.key) : [...prev, p.key],
                              )
                            }
                            className={`flex items-center gap-1.5 p-1.5 rounded-lg text-xs font-medium border text-left transition-all ${
                              active
                                ? "bg-indigo-600/25 border-indigo-400/50 text-white shadow-sm"
                                : "bg-black/20 border-white/5 text-[var(--muted)] hover:text-white"
                            }`}
                          >
                            <span>{p.icon}</span>
                            <span className="truncate">{p.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary w-full text-xs py-2 shadow-md shadow-indigo-600/30"
                      disabled={genBusy || genPlatforms.length === 0}
                      onClick={() => generate(item.id)}
                    >
                      {genBusy ? "⚡ Synthesizing AI Captions…" : `Generate ${genPlatforms.length} Platform Variants`}
                    </button>

                    {genResult && (
                      <div className="text-[11px] p-2 rounded bg-indigo-900/30 border border-indigo-500/20 text-indigo-200">
                        {genResult}
                      </div>
                    )}
                  </div>
                )}

                {/* Generated Variants Preview / Editing */}
                {variantsFor === item.id && (
                  <div className="space-y-3 pt-2">
                    <div className="text-xs font-semibold text-white flex items-center justify-between">
                      <span>Platform Variations ({variants.length})</span>
                      <button
                        type="button"
                        className="text-[11px] text-indigo-400 hover:text-indigo-300"
                        onClick={() => openVariants(item.id)}
                      >
                        Refresh
                      </button>
                    </div>

                    {variantsLoading ? (
                      <div className="text-xs text-[var(--muted)] py-3 text-center">Loading variants…</div>
                    ) : variants.length === 0 ? (
                      <div className="text-xs text-[var(--muted)] p-3 rounded-lg bg-black/20 border border-white/5 text-center">
                        No AI variants generated yet. Click "✨ AI Studio" to produce tailored captions.
                      </div>
                    ) : (
                      variants.map((v) => {
                        const platformMeta = PLATFORMS.find((p) => p.key === v.platform);
                        const isEditing = editingVariantId === v.id;
                        const charCount = v.caption.length;
                        const isOverLimit = platformMeta && charCount > platformMeta.maxChars;

                        return (
                          <div
                            key={v.id}
                            className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5 text-xs"
                          >
                            {/* Platform Header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 font-semibold text-white">
                                <span>{platformMeta?.icon ?? "📱"}</span>
                                <span>{platformMeta?.label ?? v.platform}</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {v.approved === true ? (
                                  <span className="badge badge-ok text-[10px]">Approved</span>
                                ) : v.approved === false ? (
                                  <span className="badge badge-danger text-[10px]">Rejected</span>
                                ) : (
                                  <span className="badge badge-warn text-[10px]">Pending Approval</span>
                                )}
                                <span className="text-[10px] text-[var(--muted-dark)]" title={`Prompt: ${v.promptVersion}`}>
                                  {v.model ?? "AI"}
                                </span>
                              </div>
                            </div>

                            {/* Safety Flags Warning Box */}
                            {v.safetyFlags && !v.safetyFlags.ok && (
                              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] space-y-1">
                                <div className="font-semibold flex items-center gap-1">
                                  <span>⚠</span> Guardrail Alert:
                                </div>
                                {v.safetyFlags.flags.map((f, i) => (
                                  <div key={i} className="pl-3 text-[10px]">
                                    • {f.message}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* View / Edit Mode */}
                            {isEditing ? (
                              <div className="space-y-2 pt-1">
                                <div>
                                  <label className="text-[10px] uppercase font-bold text-[var(--muted)]">Hook</label>
                                  <input
                                    className="text-xs mt-0.5"
                                    value={editHook}
                                    onChange={(e) => setEditHook(e.target.value)}
                                    placeholder="Opening hook line"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-[var(--muted)]">
                                    <span>Caption Body</span>
                                    {platformMeta && (
                                      <span className={editCaption.length > platformMeta.maxChars ? "text-red-400" : "text-emerald-400"}>
                                        {editCaption.length}/{platformMeta.maxChars} chars
                                      </span>
                                    )}
                                  </div>
                                  <textarea
                                    rows={4}
                                    className="text-xs mt-0.5 font-mono"
                                    value={editCaption}
                                    onChange={(e) => setEditCaption(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] uppercase font-bold text-[var(--muted)]">Hashtags</label>
                                  <input
                                    className="text-xs mt-0.5"
                                    value={editHashtags}
                                    onChange={(e) => setEditHashtags(e.target.value)}
                                    placeholder="growth ai automation (space separated)"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] uppercase font-bold text-[var(--muted)]">Call To Action (CTA)</label>
                                  <input
                                    className="text-xs mt-0.5"
                                    value={editCta}
                                    onChange={(e) => setEditCta(e.target.value)}
                                    placeholder="Link in bio"
                                  />
                                </div>

                                <div className="flex justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    className="btn btn-sm text-[11px]"
                                    onClick={() => setEditingVariantId(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm text-[11px]"
                                    disabled={saveBusy}
                                    onClick={() => saveEdit(v.id, item.id)}
                                  >
                                    {saveBusy ? "Saving…" : "Save Changes"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {v.hook && (
                                  <div className="font-semibold text-white text-xs pl-2 border-l-2 border-indigo-400">
                                    "{v.hook}"
                                  </div>
                                )}
                                <div className="text-xs text-[var(--text)] whitespace-pre-wrap leading-relaxed bg-black/20 p-2 rounded-lg border border-white/5">
                                  {v.caption}
                                </div>
                                {v.hashtags.length > 0 && (
                                  <div className="text-[11px] text-indigo-300 font-medium">
                                    {v.hashtags.map((t) => `#${t}`).join(" ")}
                                  </div>
                                )}
                                {v.cta && (
                                  <div className="text-[11px] text-cyan-300">
                                    🔗 {v.cta}
                                  </div>
                                )}

                                {/* Character count indicator */}
                                {platformMeta && (
                                  <div className="flex justify-between items-center text-[10px] text-[var(--muted)] pt-1">
                                    <span className={isOverLimit ? "text-red-400 font-bold" : ""}>
                                      Length: {charCount} / {platformMeta.maxChars} chars
                                    </span>
                                    {isOverLimit && <span className="text-red-400">⚠ Exceeds platform limit</span>}
                                  </div>
                                )}

                                {/* Controls: Edit, Copy, Regenerate, Approve/Reject */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/5">
                                  <button
                                    type="button"
                                    className="btn btn-sm text-[10px]"
                                    onClick={() => startEdit(v)}
                                  >
                                    ✏️ Edit
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-sm text-[10px]"
                                    onClick={() =>
                                      copyToClipboard(
                                        `${v.caption}\n\n${v.hashtags.map((t) => `#${t}`).join(" ")}`,
                                        v.id,
                                      )
                                    }
                                  >
                                    {copiedId === v.id ? "✓ Copied!" : "📋 Copy"}
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-sm text-[10px]"
                                    disabled={genBusy}
                                    onClick={() => generate(item.id, v.platform)}
                                  >
                                    🔄 Retry
                                  </button>

                                  <div className="ml-auto flex gap-1">
                                    {v.approved !== true && (
                                      <button
                                        type="button"
                                        className="btn btn-sm text-[10px] bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
                                        onClick={() => setApproval(v.id, item.id, true)}
                                      >
                                        ✓ Approve
                                      </button>
                                    )}
                                    {v.approved !== false && (
                                      <button
                                        type="button"
                                        className="btn btn-sm text-[10px] text-red-400 hover:bg-red-500/20"
                                        onClick={() => setApproval(v.id, item.id, false)}
                                      >
                                        ✕ Reject
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
