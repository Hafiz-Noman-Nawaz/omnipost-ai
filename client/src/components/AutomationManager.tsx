"use client";

import { useState, useEffect } from "react";

interface AutomationRule {
  id: string;
  name: string;
  priority: number;
  matchIntent?: string | null;
  matchSentiment?: string | null;
  action: "AUTO_REPLY" | "SUGGEST_REPLY" | "ESCALATE" | "HIDE";
  templateId?: string | null;
  requireApproval: boolean;
  enabled: boolean;
  createdAt: string;
  template?: {
    id: string;
    name: string;
    body: string;
    intent: string;
  } | null;
  campaign?: {
    id: string;
    name: string;
  } | null;
}

interface TemplateOption {
  id: string;
  name: string;
  intent: string;
  body: string;
}

export default function AutomationManager() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [killSwitchActive, setKillSwitchActive] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [togglingSwitch, setTogglingSwitch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formIntent, setFormIntent] = useState<string>("");
  const [formSentiment, setFormSentiment] = useState<string>("");
  const [formAction, setFormAction] = useState<"AUTO_REPLY" | "SUGGEST_REPLY" | "ESCALATE" | "HIDE">("AUTO_REPLY");
  const [formTemplateId, setFormTemplateId] = useState<string>("");
  const [formRequireApproval, setFormRequireApproval] = useState(false);
  const [formEnabled, setFormEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [rulesRes, settingsRes, templatesRes] = await Promise.all([
        fetch("/api/rest/rules"),
        fetch("/api/rest/automation/settings"),
        fetch("/api/rest/responses"),
      ]);

      if (!rulesRes.ok || !settingsRes.ok) {
        throw new Error("Failed to load automation configuration");
      }

      const rulesJson = await rulesRes.json();
      const settingsJson = await settingsRes.json();
      const templatesJson = templatesRes.ok ? await templatesRes.json() : { data: [] };

      setRules(rulesJson.data || []);
      setKillSwitchActive(Boolean(settingsJson.data?.autoReplyMaster));
      setTemplates(templatesJson.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading automation rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleKillSwitch = async () => {
    const nextState = !killSwitchActive;
    if (nextState) {
      if (!confirm("⚠️ CAUTION: Enabling the Master Auto-Reply Switch permits automated direct publishing to live social accounts based on your rules. Proceed?")) {
        return;
      }
    }
    try {
      setTogglingSwitch(true);
      setError(null);
      const res = await fetch("/api/rest/automation/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoReplyMaster: nextState }),
      });
      if (!res.ok) throw new Error("Failed to update master switch");
      setKillSwitchActive(nextState);
      setSuccessMsg(
        nextState
          ? "Master auto-reply switch ENABLED (automated publishing active)"
          : "Master auto-reply switch DISABLED (safe mode: replies queued as suggestions)"
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Switch update failed");
    } finally {
      setTogglingSwitch(false);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormName("");
    setFormIntent("");
    setFormSentiment("");
    setFormAction("AUTO_REPLY");
    setFormTemplateId(templates[0]?.id || "");
    setFormRequireApproval(false);
    setFormEnabled(true);
    setModalOpen(true);
  };

  const openEditModal = (rule: AutomationRule) => {
    setEditingId(rule.id);
    setFormName(rule.name);
    setFormIntent(rule.matchIntent || "");
    setFormSentiment(rule.matchSentiment || "");
    setFormAction(rule.action);
    setFormTemplateId(rule.templateId || "");
    setFormRequireApproval(rule.requireApproval);
    setFormEnabled(rule.enabled);
    setModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!formName.trim()) {
      setError("Rule name is required");
      return;
    }
    if (formAction === "AUTO_REPLY" && !formTemplateId) {
      setError("Template is required when action is AUTO_REPLY");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        name: formName.trim(),
        matchIntent: formIntent ? formIntent : null,
        matchSentiment: formSentiment ? formSentiment : null,
        action: formAction,
        templateId: formAction === "AUTO_REPLY" || formAction === "SUGGEST_REPLY" ? formTemplateId || null : null,
        requireApproval: formRequireApproval,
        enabled: formEnabled,
      };

      const url = editingId ? `/api/rest/rules/${editingId}` : "/api/rest/rules";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to save rule");
      }

      setModalOpen(false);
      setSuccessMsg(editingId ? "Rule updated!" : "Rule created successfully!");
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: string, name: string) => {
    if (!confirm(`Delete automation rule "${name}"?`)) return;
    try {
      const res = await fetch(`/api/rest/rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete rule");
      setSuccessMsg("Rule deleted.");
      await fetchData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleToggleRuleEnabled = async (rule: AutomationRule) => {
    try {
      const res = await fetch(`/api/rest/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle rule");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  const handleMove = async (index: number, direction: "UP" | "DOWN") => {
    const targetIndex = direction === "UP" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rules.length) return;

    const newRules = [...rules];
    const temp = newRules[index]!;
    newRules[index] = newRules[targetIndex]!;
    newRules[targetIndex] = temp;

    setRules(newRules); // Optimistic UI update

    try {
      const ruleIds = newRules.map((r) => r.id);
      const res = await fetch("/api/rest/rules/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleIds }),
      });
      if (!res.ok) throw new Error("Failed to persist order");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reorder error");
      await fetchData();
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "AUTO_REPLY":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "SUGGEST_REPLY":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "ESCALATE":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "HIDE":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>⚡</span> Automation Rules & Safe Auto-Replies
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Prioritized rule engine for community interactions with built-in safety gates, human approvals, and an instant kill-switch.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn btn-primary text-xs px-4 py-2 flex items-center gap-2 shadow-lg shadow-indigo-500/20"
        >
          <span>➕</span> New Automation Rule
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

      {/* Master Auto-Reply Kill-Switch Card (Spec §18/§19) */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          killSwitchActive
            ? "bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-teal-950/40 border-emerald-500/40 shadow-lg shadow-emerald-950/30"
            : "bg-gradient-to-r from-amber-950/40 via-slate-900/80 to-orange-950/40 border-amber-500/30 shadow-lg shadow-amber-950/20"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">{killSwitchActive ? "🟢" : "🔒"}</span>
              <h2 className="text-base font-bold text-white tracking-tight">
                Master Auto-Reply Switch: {killSwitchActive ? "ACTIVE (LIVE PUBLISHING)" : "OFF (SAFE MODE)"}
              </h2>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  killSwitchActive
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                }`}
              >
                {killSwitchActive ? "LIVE PUBLISHING" : "SAFE MODE"}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] max-w-2xl leading-relaxed">
              {killSwitchActive
                ? "Automatic replies configured in your rules will be published directly to social platforms. Toxic/abuse comments remain strictly protected from automated replies."
                : "Safe Mode active. All AUTO_REPLY actions are safely downgraded to suggestions and queued for operator approval. No comment replies will be sent automatically."}
            </p>
          </div>

          <button
            onClick={handleToggleKillSwitch}
            disabled={togglingSwitch}
            className={`btn text-xs px-4 py-2 font-semibold transition-all shrink-0 ${
              killSwitchActive
                ? "bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40"
                : "bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40"
            }`}
          >
            {togglingSwitch
              ? "Updating..."
              : killSwitchActive
                ? "🛑 Emergency Kill-Switch (Stop Auto-Replies)"
                : "⚡ Enable Master Auto-Replies"}
          </button>
        </div>
      </div>

      {/* Rules Matrix List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Execution Priority Order (Top to Bottom)
          </div>
          <div className="text-[11px] text-[var(--muted-dark)]">
            {rules.length} rule(s) configured
          </div>
        </div>

        {loading ? (
          <div className="card p-12 text-center text-sm text-[var(--muted)]">
            <div className="inline-block animate-spin text-2xl mb-2">⚡</div>
            <div>Loading automation rules...</div>
          </div>
        ) : rules.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">⚡</div>
            <div className="text-base font-semibold text-white">No automation rules configured</div>
            <p className="text-xs text-[var(--muted)] mt-1 max-w-sm mx-auto">
              Create rules to automatically escalate complaints, hide abusive comments, or auto-reply to common pricing questions.
            </p>
            <button onClick={openCreateModal} className="btn btn-primary text-xs px-4 py-2 mt-4">
              Create First Rule
            </button>
          </div>
        ) : (
          rules.map((rule, index) => (
            <div
              key={rule.id}
              className={`p-4 rounded-xl bg-[var(--panel)] border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                rule.enabled ? "border-[var(--border)] hover:border-indigo-500/30" : "border-white/5 opacity-50"
              }`}
            >
              {/* Left Details */}
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[var(--muted)] bg-black/40 border border-white/5 rounded px-1.5 py-0.5">
                    #{index + 1}
                  </span>
                  <span className="font-semibold text-sm text-white">{rule.name}</span>

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getActionBadge(rule.action)}`}>
                    {rule.action}
                  </span>

                  {rule.requireApproval && (
                    <span className="badge badge-warn text-[9px] px-1.5 py-0">Requires Approval</span>
                  )}

                  {!rule.enabled && (
                    <span className="badge text-[9px] bg-gray-800 text-gray-400 border border-white/5 px-1.5 py-0">
                      DISABLED
                    </span>
                  )}
                </div>

                {/* Match Criteria */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                  <span>Matches:</span>
                  {rule.matchIntent ? (
                    <span className="px-2 py-0.5 rounded bg-black/30 border border-white/5 text-gray-200">
                      Intent = <strong className="text-white">{rule.matchIntent}</strong>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-black/30 border border-white/5 text-gray-400">
                      Any Intent
                    </span>
                  )}

                  {rule.matchSentiment ? (
                    <span className="px-2 py-0.5 rounded bg-black/30 border border-white/5 text-gray-200">
                      Sentiment = <strong className="text-white">{rule.matchSentiment}</strong>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-black/30 border border-white/5 text-gray-400">
                      Any Sentiment
                    </span>
                  )}

                  {rule.template && (
                    <span className="px-2 py-0.5 rounded bg-indigo-950/30 border border-indigo-500/20 text-indigo-300 truncate max-w-xs" title={rule.template.body}>
                      Template: {rule.template.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-white/5 shrink-0">
                {/* Priority Arrows */}
                <div className="flex items-center gap-0.5">
                  <button
                    disabled={index === 0}
                    onClick={() => handleMove(index, "UP")}
                    className="p-1.5 rounded-lg bg-black/30 hover:bg-black/60 text-xs text-[var(--muted)] disabled:opacity-30 disabled:cursor-not-allowed hover:text-white"
                    title="Move higher priority"
                  >
                    ▲
                  </button>
                  <button
                    disabled={index === rules.length - 1}
                    onClick={() => handleMove(index, "DOWN")}
                    className="p-1.5 rounded-lg bg-black/30 hover:bg-black/60 text-xs text-[var(--muted)] disabled:opacity-30 disabled:cursor-not-allowed hover:text-white"
                    title="Move lower priority"
                  >
                    ▼
                  </button>
                </div>

                <button
                  onClick={() => handleToggleRuleEnabled(rule)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    rule.enabled
                      ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/30"
                      : "bg-gray-850 text-gray-400 border-white/10"
                  }`}
                >
                  {rule.enabled ? "Enabled" : "Disabled"}
                </button>

                <button
                  onClick={() => openEditModal(rule)}
                  className="btn btn-secondary text-xs px-2.5 py-1 text-gray-300 hover:text-white"
                >
                  Edit
                </button>

                <button
                  onClick={() => handleDeleteRule(rule.id, rule.name)}
                  className="text-xs text-gray-500 hover:text-red-400 p-1.5 transition-colors"
                  title="Delete rule"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rule Builder Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--panel-solid)] border border-[var(--border)] p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h3 className="font-semibold text-white">
                {editingId ? "Edit Automation Rule" : "New Automation Rule"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-sm text-[var(--muted)] hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-medium text-gray-300">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Instant Auto-Reply for Pricing Questions"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="input text-xs w-full mt-1 p-2 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-300">Match Intent</label>
                  <select
                    value={formIntent}
                    onChange={(e) => setFormIntent(e.target.value)}
                    className="input text-xs w-full mt-1 p-2 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white"
                  >
                    <option value="">Any Intent</option>
                    <option value="QUESTION">QUESTION</option>
                    <option value="PRICING">PRICING</option>
                    <option value="PURCHASE_INTENT">PURCHASE_INTENT</option>
                    <option value="POSITIVE">POSITIVE</option>
                    <option value="NEGATIVE">NEGATIVE</option>
                    <option value="COMPLAINT">COMPLAINT</option>
                    <option value="SPAM">SPAM</option>
                    <option value="ABUSE">ABUSE</option>
                    <option value="PARTNERSHIP">PARTNERSHIP</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-300">Match Sentiment</label>
                  <select
                    value={formSentiment}
                    onChange={(e) => setFormSentiment(e.target.value)}
                    className="input text-xs w-full mt-1 p-2 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white"
                  >
                    <option value="">Any Sentiment</option>
                    <option value="POSITIVE">POSITIVE</option>
                    <option value="NEUTRAL">NEUTRAL</option>
                    <option value="NEGATIVE">NEGATIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300">Trigger Action</label>
                <select
                  value={formAction}
                  onChange={(e) => setFormAction(e.target.value as any)}
                  className="input text-xs w-full mt-1 p-2 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white"
                >
                  <option value="AUTO_REPLY">AUTO_REPLY (Direct publish if kill-switch enabled)</option>
                  <option value="SUGGEST_REPLY">SUGGEST_REPLY (Queue response for operator review)</option>
                  <option value="ESCALATE">ESCALATE (Mark thread requires human operator)</option>
                  <option value="HIDE">HIDE (Hide comment on platform if supported)</option>
                </select>
              </div>

              {(formAction === "AUTO_REPLY" || formAction === "SUGGEST_REPLY") && (
                <div>
                  <label className="text-xs font-medium text-gray-300">Response Template</label>
                  <select
                    value={formTemplateId}
                    onChange={(e) => setFormTemplateId(e.target.value)}
                    className="input text-xs w-full mt-1 p-2 bg-[var(--panel-2)] border-[var(--border)] rounded-lg text-white"
                  >
                    <option value="">Select a template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.intent})
                      </option>
                    ))}
                  </select>
                  {templates.length === 0 && (
                    <p className="text-[11px] text-amber-400 mt-1">
                      No response templates found. Create one in the Response Library first!
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ruleApproval"
                    checked={formRequireApproval}
                    onChange={(e) => setFormRequireApproval(e.target.checked)}
                    className="rounded border-[var(--border)] bg-[var(--panel-2)]"
                  />
                  <label htmlFor="ruleApproval" className="text-xs text-gray-300 cursor-pointer">
                    Require human approval before sending (safety buffer)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ruleEnabled"
                    checked={formEnabled}
                    onChange={(e) => setFormEnabled(e.target.checked)}
                    className="rounded border-[var(--border)] bg-[var(--panel-2)]"
                  />
                  <label htmlFor="ruleEnabled" className="text-xs text-gray-300 cursor-pointer">
                    Rule active and enabled
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button onClick={() => setModalOpen(false)} className="btn btn-secondary text-xs px-3 py-2">
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={saving || !formName.trim()}
                className="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <span>💾</span>
                {saving ? "Saving..." : "Save Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
