"use client";

import { useState, useEffect } from "react";
import { ALLOWED_TEMPLATE_VARIABLES, validateTemplateVariables, interpolateTemplate } from "@omnipost/shared";

interface ResponseTemplate {
  id: string;
  name: string;
  intent: string;
  body: string;
  platforms: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ResponseLibrary() {
  const [templates, setTemplates] = useState<ResponseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter
  const [selectedIntent, setSelectedIntent] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formIntent, setFormIntent] = useState("QUESTION");
  const [formBody, setFormBody] = useState("");
  const [formPlatforms, setFormPlatforms] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedIntent !== "ALL") params.set("intent", selectedIntent);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/rest/responses?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load response templates");
      const json = await res.json();
      setTemplates(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [selectedIntent]);

  const openCreateModal = () => {
    setEditingId(null);
    setFormName("");
    setFormIntent("QUESTION");
    setFormBody("Hi {{author}}! Thanks for reaching out about {{product}}. See full details at {{link}}.");
    setFormPlatforms([]);
    setFormActive(true);
    setModalOpen(true);
  };

  const openEditModal = (tpl: ResponseTemplate) => {
    setEditingId(tpl.id);
    setFormName(tpl.name);
    setFormIntent(tpl.intent);
    setFormBody(tpl.body);
    setFormPlatforms(tpl.platforms || []);
    setFormActive(tpl.active);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formBody.trim()) {
      setError("Name and body are required");
      return;
    }

    const validation = validateTemplateVariables(formBody);
    if (!validation.valid) {
      setError(`Invalid variable(s): ${validation.invalidVariables.join(", ")}. Allowed: ${ALLOWED_TEMPLATE_VARIABLES.map(v => `{{${v}}}`).join(", ")}`);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: formName.trim(),
        intent: formIntent,
        body: formBody.trim(),
        platforms: formPlatforms,
        active: formActive,
      };

      const url = editingId ? `/api/rest/responses/${editingId}` : "/api/rest/responses";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to save template");
      }

      setModalOpen(false);
      setSuccessMsg(editingId ? "Template updated successfully!" : "New template created!");
      await fetchTemplates();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      const res = await fetch(`/api/rest/responses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete template");
      setSuccessMsg("Template deleted.");
      await fetchTemplates();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleToggleActive = async (tpl: ResponseTemplate) => {
    try {
      const res = await fetch(`/api/rest/responses/${tpl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !tpl.active }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const insertVariable = (varName: string) => {
    setFormBody((prev) => `${prev} {{${varName}}}`);
  };

  const validation = validateTemplateVariables(formBody);
  const previewRender = interpolateTemplate(formBody, {
    brand: "OmniPost",
    product: "OmniDesk Smart Organizer",
    price: "$149",
    link: "https://omnipost.local/deals",
    campaign: "Autumn Launch",
    author: "Alex",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>📚</span> Response Template Library
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Standardized, brand-safe response templates with variable syntax (<code>{"{{product}}"}</code>, <code>{"{{price}}"}</code>, <code>{"{{link}}"}</code>) for automation rules and AI suggester.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn btn-primary text-xs px-4 py-2 flex items-center gap-2 shadow-lg shadow-indigo-500/20"
        >
          <span>➕</span> New Template
        </button>
      </div>

      {/* Alerts */}
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

      {/* Filter Toolbar */}
      <div className="p-3 rounded-xl bg-[var(--panel)] border border-[var(--border)] backdrop-blur-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: "ALL", label: "All Intents" },
            { id: "QUESTION", label: "Questions" },
            { id: "PRICING", label: "Pricing" },
            { id: "PURCHASE_INTENT", label: "Purchase Intent" },
            { id: "POSITIVE", label: "Positive" },
            { id: "COMPLAINT", label: "Complaints" },
            { id: "PARTNERSHIP", label: "Partnership" },
            { id: "GENERAL", label: "General" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedIntent(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedIntent === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-[var(--muted)] hover:text-white hover:bg-[var(--panel-hover)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchTemplates()}
            className="input text-xs py-1.5 pl-7 pr-3 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white w-48 sm:w-60"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--muted)]">🔍</span>
        </div>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="card p-12 text-center text-sm text-[var(--muted)]">
          <div className="inline-block animate-spin text-2xl mb-2">⚡</div>
          <div>Loading response templates...</div>
        </div>
      ) : templates.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">📚</div>
          <div className="text-base font-semibold text-white">No templates found</div>
          <p className="text-xs text-[var(--muted)] mt-1 max-w-sm mx-auto">
            Create reusable templates with variables to respond consistently to questions, pricing inquiries, and compliments.
          </p>
          <button onClick={openCreateModal} className="btn btn-primary text-xs px-4 py-2 mt-4">
            Create First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className={`p-4 rounded-xl bg-[var(--panel)] border transition-all flex flex-col justify-between gap-3 ${
                tpl.active ? "border-[var(--border)] hover:border-indigo-500/40" : "border-white/5 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">{tpl.name}</span>
                    <button
                      onClick={() => handleToggleActive(tpl)}
                      className={`text-[9px] px-2 py-0.5 rounded-full font-medium border ${
                        tpl.active
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                      }`}
                    >
                      {tpl.active ? "ACTIVE" : "INACTIVE"}
                    </button>
                  </div>
                  <span className="badge badge-accent text-[9px] px-2 py-0.5">{tpl.intent}</span>
                </div>

                {/* Template body */}
                <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-gray-300 leading-relaxed font-sans select-text">
                  {tpl.body}
                </div>

                {/* Platform constraints */}
                {tpl.platforms && tpl.platforms.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-1 text-[10px] text-[var(--muted)]">
                    <span>Platforms:</span>
                    {tpl.platforms.map((p) => (
                      <span key={p} className="px-1.5 py-0.2 rounded bg-black/30 border border-white/5 text-gray-300">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="pt-2 border-t border-[var(--border)] flex items-center justify-end gap-2 text-xs">
                <button
                  onClick={() => openEditModal(tpl)}
                  className="btn btn-secondary text-xs px-2.5 py-1 text-gray-300 hover:text-white"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(tpl.id, tpl.name)}
                  className="text-xs text-gray-500 hover:text-red-400 px-2 py-1 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-[var(--panel-solid)] border border-[var(--border)] p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h3 className="font-semibold text-white">
                {editingId ? "Edit Response Template" : "New Response Template"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-sm text-[var(--muted)] hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-gray-300">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. Standard Pricing Inquiry Response"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="input text-xs w-full mt-1 p-2 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300">Target Intent</label>
                <select
                  value={formIntent}
                  onChange={(e) => setFormIntent(e.target.value)}
                  className="input text-xs w-full mt-1 p-2 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white"
                >
                  <option value="QUESTION">QUESTION (Feature & information inquiries)</option>
                  <option value="PRICING">PRICING (Costs, plans, discounts)</option>
                  <option value="PURCHASE_INTENT">PURCHASE_INTENT (Order links, buy intent)</option>
                  <option value="POSITIVE">POSITIVE (Praise, appreciation)</option>
                  <option value="COMPLAINT">COMPLAINT (Frustration, issues)</option>
                  <option value="PARTNERSHIP">PARTNERSHIP (Collaborations, sponsors)</option>
                  <option value="GENERAL">GENERAL (Casual remarks)</option>
                </select>
              </div>

              {/* Variable Chips Bar */}
              <div>
                <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                  <span className="font-medium">Insert Allowed Variable:</span>
                  <span className="text-[10px] text-[var(--muted)]">Click chip to append</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALLOWED_TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 transition-colors"
                    >
                      +{`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300">Template Content</label>
                <textarea
                  rows={4}
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  className="input text-xs w-full mt-1 p-3 bg-[var(--panel-2)] border-[var(--border)] rounded-xl text-white font-sans resize-none"
                />
                {!validation.valid && (
                  <p className="text-[11px] text-red-400 mt-1">
                    Disallowed variable(s): {validation.invalidVariables.join(", ")}
                  </p>
                )}
              </div>

              {/* Live Preview Container */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Live Preview (Simulated Substitution):
                </span>
                <p className="text-xs text-gray-200 italic">&ldquo;{previewRender}&rdquo;</p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="tplActive"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded border-[var(--border)] bg-[var(--panel-2)]"
                />
                <label htmlFor="tplActive" className="text-xs text-gray-300 cursor-pointer">
                  Active (available to automation rules and AI suggester)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button onClick={() => setModalOpen(false)} className="btn btn-secondary text-xs px-3 py-2">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !validation.valid || !formName.trim()}
                className="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <span>💾</span>
                {saving ? "Saving..." : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
