"use client";

import { useCallback, useEffect, useState } from "react";
import { PLATFORM_KEYS, PLATFORM_LABELS } from "@omnipost/shared";

export interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  targetAudience: string | null;
  tone: string | null;
  brandVoice: string | null;
  cta: string | null;
  landingUrl: string | null;
  platforms: string[];
  timezone: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  approvalRequired: boolean;
  postingFrequency: { perDay?: number; windows?: string[] } | null;
  affiliateNetwork: string | null;
  affiliateUrl: string | null;
  disclosureText: string | null;
  pausedAt: string | null;
  brandId: string | null;
  brand?: { id: string; name: string; isDefault: boolean } | null;
  _count?: { content: number };
}

export interface BrandRow {
  id: string;
  name: string;
  voice: string | null;
  avoid: string | null;
  audience: string | null;
  isDefault: boolean;
  _count?: { campaigns: number };
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "badge",
  ACTIVE: "badge badge-ok",
  PAUSED: "badge badge-warn",
  COMPLETED: "badge badge-ok",
  ARCHIVED: "badge",
};

const COMMON_TIMEZONES = [
  "UTC",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Istanbul",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Tokyo",
];

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function toIsoOrNull(value: string): string | null {
  return value ? new Date(`${value}T00:00:00Z`).toISOString() : null;
}

interface FormState {
  name: string;
  description: string;
  objective: string;
  targetAudience: string;
  tone: string;
  brandVoice: string;
  cta: string;
  landingUrl: string;
  platforms: string[];
  timezone: string;
  startDate: string;
  endDate: string;
  brandId: string;
  approvalRequired: boolean;
  perDay: string;
  windows: string;
  affiliateNetwork: string;
  affiliateUrl: string;
  disclosureText: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  objective: "",
  targetAudience: "",
  tone: "",
  brandVoice: "",
  cta: "",
  landingUrl: "",
  platforms: [],
  timezone: "UTC",
  startDate: "",
  endDate: "",
  brandId: "",
  approvalRequired: true,
  perDay: "",
  windows: "",
  affiliateNetwork: "",
  affiliateUrl: "",
  disclosureText: "",
};

function formFromCampaign(c: CampaignRow): FormState {
  return {
    name: c.name,
    description: c.description ?? "",
    objective: c.objective ?? "",
    targetAudience: c.targetAudience ?? "",
    tone: c.tone ?? "",
    brandVoice: c.brandVoice ?? "",
    cta: c.cta ?? "",
    landingUrl: c.landingUrl ?? "",
    platforms: [...c.platforms],
    timezone: c.timezone,
    startDate: c.startDate ? c.startDate.slice(0, 10) : "",
    endDate: c.endDate ? c.endDate.slice(0, 10) : "",
    brandId: c.brandId ?? "",
    approvalRequired: c.approvalRequired,
    perDay: c.postingFrequency?.perDay != null ? String(c.postingFrequency.perDay) : "",
    windows: (c.postingFrequency?.windows ?? []).join(", "),
    affiliateNetwork: c.affiliateNetwork ?? "",
    affiliateUrl: c.affiliateUrl ?? "",
    disclosureText: c.disclosureText ?? "",
  };
}

function payloadFromForm(f: FormState) {
  const windows = f.windows
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
  const perDay = f.perDay.trim() ? Number(f.perDay) : undefined;
  const postingFrequency =
    perDay !== undefined || windows.length
      ? { ...(perDay !== undefined ? { perDay } : {}), ...(windows.length ? { windows } : {}) }
      : null;
  return {
    name: f.name,
    description: f.description || null,
    objective: f.objective || null,
    targetAudience: f.targetAudience || null,
    tone: f.tone || null,
    brandVoice: f.brandVoice || null,
    cta: f.cta || null,
    landingUrl: f.landingUrl || null,
    platforms: f.platforms,
    timezone: f.timezone,
    startDate: toIsoOrNull(f.startDate),
    endDate: toIsoOrNull(f.endDate),
    brandId: f.brandId || null,
    approvalRequired: f.approvalRequired,
    postingFrequency,
    affiliateNetwork: f.affiliateNetwork || null,
    affiliateUrl: f.affiliateUrl || null,
    disclosureText: f.disclosureText || null,
  };
}

export default function CampaignManager({ role }: { role: string }) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null); // null = closed, "new" = create
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const [showBrands, setShowBrands] = useState(false);
  const [brandDraft, setBrandDraft] = useState<Record<string, { name: string; voice: string; avoid: string; audience: string }>>({});
  const [newBrand, setNewBrand] = useState({ name: "", voice: "", avoid: "", audience: "", isDefault: false });
  const [brandBusy, setBrandBusy] = useState(false);

  const canAdmin = role === "ADMIN" || role === "OWNER";
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const [cRes, bRes] = await Promise.all([
        fetch(`/api/rest/campaigns?${params.toString()}`),
        fetch("/api/rest/brands"),
      ]);
      const cJson = await cRes.json();
      const bJson = await bRes.json();
      if (!cRes.ok) throw new Error(cJson?.error?.message ?? "Failed to load campaigns");
      if (!bRes.ok) throw new Error(bJson?.error?.message ?? "Failed to load brands");
      setCampaigns(cJson.data);
      setBrands(bJson.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId("new");
    setForm(EMPTY_FORM);
    setError(null);
  };

  const openEdit = (c: CampaignRow) => {
    setEditingId(c.id);
    setForm(formFromCampaign(c));
    setError(null);
  };

  const submitCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = payloadFromForm(form);
      const res = await fetch(
        editingId === "new" ? "/api/rest/campaigns" : `/api/rest/campaigns/${editingId}`,
        {
          method: editingId === "new" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const fieldErrors = json?.error?.details?.fieldErrors as Record<string, string> | undefined;
        throw new Error(
          fieldErrors
            ? `${json.error.message} ${Object.entries(fieldErrors).map(([k, v]) => `${k}: ${v}`).join(" · ")}`
            : json?.error?.message ?? "Could not save campaign",
        );
      }
      setEditingId(null);
      setNotice(editingId === "new" ? "Campaign created." : "Campaign updated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save campaign");
    } finally {
      setBusy(false);
    }
  };

  const doAction = async (id: string, action: "pause" | "resume") => {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/rest/campaigns/${id}/${action}`, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? `Could not ${action} campaign`);
      return;
    }
    setNotice(action === "pause" ? "Campaign paused — scheduling will skip it." : "Campaign resumed.");
    await load();
  };

  const setStatus = async (id: string, status: "ACTIVE" | "COMPLETED") => {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/rest/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Could not update campaign status");
      return;
    }
    setNotice(status === "ACTIVE" ? "Campaign activated." : "Campaign completed.");
    await load();
  };

  const archive = async (c: CampaignRow) => {
    if (!window.confirm(`Delete or archive "${c.name}"? Campaigns with content are archived, others removed.`)) return;
    setError(null);
    const res = await fetch(`/api/rest/campaigns/${c.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Could not delete campaign");
      return;
    }
    setNotice(json?.data?.result === "archived" ? "Campaign archived (it still has content)." : "Campaign deleted.");
    await load();
  };

  const saveBrand = async (id: string) => {
    const d = brandDraft[id];
    if (!d?.name?.trim()) {
      setError("Brand name is required.");
      return;
    }
    setBrandBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rest/brands/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name,
          voice: d.voice || null,
          avoid: d.avoid || null,
          audience: d.audience || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Could not save brand");
      setBrandDraft((s) => {
        const { [id]: _drop, ...rest } = s;
        return rest;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save brand");
    } finally {
      setBrandBusy(false);
    }
  };

  const makeDefault = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/rest/brands/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Could not set default brand");
      return;
    }
    await load();
  };

  const createBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrand.name.trim()) {
      setError("Brand name is required.");
      return;
    }
    setBrandBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rest/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBrand.name,
          voice: newBrand.voice || null,
          avoid: newBrand.avoid || null,
          audience: newBrand.audience || null,
          isDefault: newBrand.isDefault,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Could not create brand");
      setNewBrand({ name: "", voice: "", avoid: "", audience: "", isDefault: false });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create brand");
    } finally {
      setBrandBusy(false);
    }
  };

  const deleteBrand = async (b: BrandRow) => {
    if (!window.confirm(`Delete brand "${b.name}"?`)) return;
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/rest/brands/${b.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? "Could not delete brand");
      return;
    }
    setNotice("Brand deleted.");
    await load();
  };

  const draftFor = (b: BrandRow) =>
    brandDraft[b.id] ?? { name: b.name, voice: b.voice ?? "", avoid: b.avoid ?? "", audience: b.audience ?? "" };

  return (
    <div className="space-y-6">
      <div className="card flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-auto text-xs"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowBrands((v) => !v)}
          >
            🏷️ {showBrands ? "Hide Brands" : `Brand Profiles (${brands.length})`}
          </button>
        </div>

        <button type="button" className="btn btn-primary text-xs shrink-0" onClick={openCreate}>
          + New Campaign
        </button>
      </div>

      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      {notice && <p className="text-sm" style={{ color: "var(--ok)" }}>{notice}</p>}

      {editingId !== null && (
        <form className="card space-y-3" onSubmit={submitCampaign}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              {editingId === "new" ? "New campaign" : "Edit campaign"}
            </h2>
            <button type="button" className="btn" style={{ padding: "0.25rem 0.7rem", fontSize: "0.8rem" }} onClick={() => setEditingId(null)}>
              Cancel
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm">
              Name *
              <input value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} />
            </label>
            <label className="text-sm">
              Brand profile
              <select value={form.brandId} onChange={(e) => set("brandId", e.target.value)}>
                <option value="">— none —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-sm block">
            Description
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={2000} />
          </label>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm">
              Objective
              <input placeholder="e.g. affiliate traffic, awareness, launches" value={form.objective} onChange={(e) => set("objective", e.target.value)} maxLength={500} />
            </label>
            <label className="text-sm">
              CTA
              <input placeholder="e.g. See the setup" value={form.cta} onChange={(e) => set("cta", e.target.value)} maxLength={200} />
            </label>
            <label className="text-sm">
              Landing URL
              <input type="url" placeholder="https://…" value={form.landingUrl} onChange={(e) => set("landingUrl", e.target.value)} maxLength={2000} />
            </label>
            <label className="text-sm">
              Tone
              <input placeholder="e.g. confident, no hype" value={form.tone} onChange={(e) => set("tone", e.target.value)} maxLength={500} />
            </label>
          </div>

          <label className="text-sm block">
            Target audience
            <textarea value={form.targetAudience} onChange={(e) => set("targetAudience", e.target.value)} rows={2} maxLength={2000} placeholder="Who is this for?" />
          </label>

          <label className="text-sm block">
            Brand voice override <span className="muted">(optional — overrides the brand profile voice for this campaign)</span>
            <textarea value={form.brandVoice} onChange={(e) => set("brandVoice", e.target.value)} rows={2} maxLength={2000} />
          </label>

          <div className="text-sm">
            Platforms *
            <div className="flex flex-wrap gap-2 mt-1">
              {PLATFORM_KEYS.map((p) => {
                const on = form.platforms.includes(p);
                return (
                  <button
                    type="button"
                    key={p}
                    className={on ? "badge badge-ok" : "badge"}
                    style={{ cursor: "pointer", padding: "0.3rem 0.8rem" }}
                    onClick={() =>
                      set("platforms", on ? form.platforms.filter((x) => x !== p) : [...form.platforms, p])
                    }
                  >
                    {on ? "✓ " : ""}{PLATFORM_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <label className="text-sm">
              Timezone
              <select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                {[...new Set([form.timezone, ...COMMON_TIMEZONES])].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Start date
              <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </label>
            <label className="text-sm">
              End date
              <input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </label>
            <label className="text-sm">
              Posts per day
              <input type="number" min={1} max={50} placeholder="e.g. 2" value={form.perDay} onChange={(e) => set("perDay", e.target.value)} />
            </label>
          </div>

          <label className="text-sm block">
            Posting windows <span className="muted">(comma-separated HH:MM, e.g. 09:00, 18:00)</span>
            <input value={form.windows} onChange={(e) => set("windows", e.target.value)} placeholder="09:00, 18:00" />
          </label>

          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-sm">
              Affiliate network
              <input value={form.affiliateNetwork} onChange={(e) => set("affiliateNetwork", e.target.value)} maxLength={120} />
            </label>
            <label className="text-sm">
              Affiliate URL
              <input type="url" placeholder="https://…?ref=…" value={form.affiliateUrl} onChange={(e) => set("affiliateUrl", e.target.value)} maxLength={2000} />
            </label>
            <label className="text-sm">
              Disclosure text
              <input placeholder="e.g. Ad — partner link." value={form.disclosureText} onChange={(e) => set("disclosureText", e.target.value)} maxLength={300} />
            </label>
          </div>

          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={form.approvalRequired}
              onChange={(e) => set("approvalRequired", e.target.checked)}
            />
            Require approval before publishing
          </label>

          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? "Saving…" : editingId === "new" ? "Create campaign" : "Save changes"}
          </button>
        </form>
      )}

      {showBrands && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Brand profiles</h2>
          <p className="muted text-xs">
            Voice, tone guardrails and audience memory feed AI generation (Phase 4). Campaigns inherit
            the selected brand unless they override the voice.
          </p>
          {brands.map((b) => {
            const d = draftFor(b);
            const dirty = brandDraft[b.id] !== undefined;
            return (
              <div key={b.id} className="card" style={{ padding: "0.9rem" }}>
                <div className="flex items-center gap-2 mb-2">
                  <strong className="text-sm">{b.name}</strong>
                  {b.isDefault && <span className="badge badge-ok">default</span>}
                  <span className="muted text-xs">{b._count?.campaigns ?? 0} campaign(s)</span>
                  <div className="ml-auto flex gap-2">
                    {!b.isDefault && (
                      <button className="btn" style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }} onClick={() => makeDefault(b.id)}>
                        Make default
                      </button>
                    )}
                    {(b._count?.campaigns ?? 0) === 0 && (
                      <button className="btn" style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }} onClick={() => deleteBrand(b)}>
                        Delete
                      </button>
                    )}
                    {dirty && (
                      <button className="btn btn-primary" style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }} disabled={brandBusy} onClick={() => saveBrand(b.id)}>
                        Save
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  <label className="text-xs">
                    Name
                    <input
                      value={d.name}
                      onChange={(e) => setBrandDraft((s) => ({ ...s, [b.id]: { ...d, name: e.target.value } }))}
                    />
                  </label>
                  <label className="text-xs">
                    Audience
                    <input
                      value={d.audience}
                      onChange={(e) => setBrandDraft((s) => ({ ...s, [b.id]: { ...d, audience: e.target.value } }))}
                    />
                  </label>
                  <label className="text-xs">
                    Voice
                    <input
                      placeholder="e.g. technical, friendly, human"
                      value={d.voice}
                      onChange={(e) => setBrandDraft((s) => ({ ...s, [b.id]: { ...d, voice: e.target.value } }))}
                    />
                  </label>
                  <label className="text-xs">
                    Avoid
                    <input
                      placeholder="e.g. corporate language, fake urgency"
                      value={d.avoid}
                      onChange={(e) => setBrandDraft((s) => ({ ...s, [b.id]: { ...d, avoid: e.target.value } }))}
                    />
                  </label>
                </div>
              </div>
            );
          })}

          <form className="space-y-2 border-t pt-3" onSubmit={createBrand} style={{ borderColor: "var(--border)" }}>
            <span className="text-sm font-medium">New brand profile</span>
            <div className="grid md:grid-cols-2 gap-2">
              <input placeholder="Name *" value={newBrand.name} onChange={(e) => setNewBrand((b) => ({ ...b, name: e.target.value }))} required />
              <input placeholder="Audience" value={newBrand.audience} onChange={(e) => setNewBrand((b) => ({ ...b, audience: e.target.value }))} />
              <input placeholder="Voice" value={newBrand.voice} onChange={(e) => setNewBrand((b) => ({ ...b, voice: e.target.value }))} />
              <input placeholder="Avoid" value={newBrand.avoid} onChange={(e) => setNewBrand((b) => ({ ...b, avoid: e.target.value }))} />
            </div>
            <label className="text-xs flex items-center gap-2">
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={newBrand.isDefault}
                onChange={(e) => setNewBrand((b) => ({ ...b, isDefault: e.target.checked }))}
              />
              Make default (demotes the current default)
            </label>
            <button className="btn" disabled={brandBusy} type="submit">
              {brandBusy ? "Saving…" : "Add brand"}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p className="muted text-sm">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="card text-center muted text-sm">
          {statusFilter ? "No campaigns with this status." : "No campaigns yet — create your first one."}
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <div key={c.id} className="card card-interactive p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-white">{c.name}</h3>
                  <span className={STATUS_BADGE[c.status] ?? "badge"}>{c.status}</span>
                  {c.approvalRequired && <span className="badge badge-accent text-[10px]">approval required</span>}
                  {c.brand && <span className="badge" title="Brand profile">🏷️ {c.brand.name}</span>}
                </div>

                <div className="text-xs text-[var(--muted)] flex items-center gap-2">
                  <span>{c._count?.content ?? 0} asset{(c._count?.content ?? 0) === 1 ? "" : "s"}</span>
                  <span>·</span>
                  <span>{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</span>
                  <span>·</span>
                  <span className="font-mono text-[11px]">{c.timezone}</span>
                </div>
              </div>

              {(c.objective || c.cta || c.landingUrl) && (
                <div className="text-xs space-y-1 bg-black/20 p-2.5 rounded-lg border border-white/5">
                  {c.objective && (
                    <div>
                      <span className="text-[var(--muted)] font-medium">Objective: </span>
                      <span className="text-white">{c.objective}</span>
                    </div>
                  )}
                  {c.cta && (
                    <div>
                      <span className="text-[var(--muted)] font-medium">CTA: </span>
                      <span className="text-cyan-300 font-medium">{c.cta}</span>
                      {c.landingUrl && (
                        <a
                          href={c.landingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 underline ml-1.5"
                        >
                          {c.landingUrl.length > 50 ? `${c.landingUrl.slice(0, 50)}…` : c.landingUrl} ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {c.platforms.length === 0 ? (
                    <span className="text-xs text-[var(--muted)]">No platforms selected</span>
                  ) : (
                    c.platforms.map((p) => (
                      <span key={p} className="badge badge-accent text-[11px]">
                        {PLATFORM_LABELS[p as keyof typeof PLATFORM_LABELS] ?? p}
                      </span>
                    ))
                  )}
                </div>

                {c.postingFrequency && (c.postingFrequency.perDay || c.postingFrequency.windows?.length) ? (
                  <div className="text-xs text-[var(--muted)]">
                    Schedule:{" "}
                    {c.postingFrequency.perDay ? `${c.postingFrequency.perDay} post(s)/day` : ""}
                    {c.postingFrequency.windows?.length ? ` (${c.postingFrequency.windows.join(", ")})` : ""}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => openEdit(c)}
                >
                  ✏️ Edit
                </button>
                {canAdmin && c.status === "DRAFT" && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setStatus(c.id, "ACTIVE")}
                  >
                    ▶ Activate
                  </button>
                )}
                {canAdmin && c.status === "ACTIVE" && (
                  <button
                    type="button"
                    className="btn btn-sm text-amber-400 hover:text-amber-300"
                    onClick={() => doAction(c.id, "pause")}
                  >
                    ⏸ Pause
                  </button>
                )}
                {canAdmin && c.status === "PAUSED" && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => doAction(c.id, "resume")}
                  >
                    ▶ Resume
                  </button>
                )}
                {canAdmin && (c.status === "ACTIVE" || c.status === "PAUSED") && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setStatus(c.id, "COMPLETED")}
                  >
                    ✓ Complete
                  </button>
                )}
                {canAdmin && c.status !== "ARCHIVED" && (
                  <button
                    type="button"
                    className="btn btn-sm text-red-400 hover:text-red-300 ml-auto"
                    onClick={() => archive(c)}
                  >
                    Delete / Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
