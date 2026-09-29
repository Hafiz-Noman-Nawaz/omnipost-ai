"use client";

import { useEffect, useState } from "react";

interface ShortLink {
  id: string;
  code: string;
  originalUrl: string;
  targetUrl: string;
  platform: string | null;
  utmCampaign: string | null;
  utmSource: string | null;
  clicksCount: number;
  createdAt: string;
}

export default function UtmLinkManager() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [originalUrl, setOriginalUrl] = useState("");
  const [platform, setPlatform] = useState("LINKEDIN");
  const [campaign, setCampaign] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/rest/links");
      const json = await res.json();
      if (json.ok) {
        setLinks(json.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalUrl.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/rest/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalUrl,
          platform,
          utmCampaign: campaign.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setOriginalUrl("");
        setCampaign("");
        await fetchLinks();
      } else {
        alert(json.error?.message || "Failed to generate short link");
      }
    } catch {
      alert("Error generating short link");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = (code: string) => {
    const fullUrl = `${window.location.origin}/l/${code}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="card p-5 space-y-4 border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>🔗</span> UTM Link Shortener & Attribution Tracking
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Auto-injects UTM parameters and tracks social click conversions per platform
          </p>
        </div>
        <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
          {links.length} Tracked Links
        </span>
      </div>

      {/* Creation form */}
      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input
          type="url"
          required
          placeholder="https://yourbrand.com/landing-page"
          value={originalUrl}
          onChange={(e) => setOriginalUrl(e.target.value)}
          className="sm:col-span-2 px-3 py-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-xs text-white placeholder-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />

        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="px-3 py-2 rounded-lg bg-neutral-900 border border-[var(--border)] text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="LINKEDIN">LinkedIn</option>
          <option value="X">X (Twitter)</option>
          <option value="INSTAGRAM">Instagram</option>
          <option value="TIKTOK">TikTok</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="YOUTUBE">YouTube</option>
        </select>

        <button
          type="submit"
          disabled={submitting || !originalUrl.trim()}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white disabled:opacity-50 transition-colors shadow-sm"
        >
          {submitting ? "Generating..." : "Generate UTM Link"}
        </button>
      </form>

      {/* Links List */}
      {loading ? (
        <div className="py-4 text-center text-xs text-[var(--muted)]">Loading short links...</div>
      ) : links.length === 0 ? (
        <div className="py-4 text-center text-xs text-[var(--muted)]">
          No UTM tracked links created yet. Create one above to track social clicks!
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {links.map((link) => (
            <div
              key={link.id}
              className="p-3 rounded-lg bg-black/30 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-indigo-400">/l/{link.code}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300">
                    {link.platform || "MULTI"}
                  </span>
                  {link.utmCampaign && (
                    <span className="text-[10px] text-neutral-400">🎯 {link.utmCampaign}</span>
                  )}
                </div>
                <div className="text-[11px] text-[var(--muted)] truncate" title={link.targetUrl}>
                  Target: {link.originalUrl}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-sm font-bold text-emerald-400">{link.clicksCount}</span>
                  <span className="text-[10px] text-[var(--muted)] ml-1">clicks</span>
                </div>

                <button
                  type="button"
                  onClick={() => copyLink(link.code)}
                  className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] transition-colors"
                >
                  {copiedCode === link.code ? "✓ Copied" : "Copy Link"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
