"use client";

import { useState, useEffect, useTransition } from "react";

interface ToolCall {
  id: string;
  toolName: string;
  args: any;
  riskClass: "READ" | "WRITE" | "HIGH_RISK";
  allowed: boolean;
  pendingConfirmation?: boolean;
  denialReason?: string | null;
  result?: any;
  resultSummary?: string | null;
}

interface ExecutionMessage {
  id: string;
  trigger: string;
  input: string;
  output?: string | null;
  status: "completed" | "pending_confirmation" | "failed" | "running";
  startedAt: string;
  toolCalls: ToolCall[];
  promptInjectionFlags?: string[];
  pendingConfirmationToken?: string | null;
}

export default function AgentCockpit() {
  const [messages, setMessages] = useState<ExecutionMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadExecutions = async () => {
    try {
      const res = await fetch("/api/rest/agent/executions?limit=15");
      const json = await res.json();
      if (json.ok) {
        setMessages(
          json.data.items.map((item: any) => ({
            id: item.id,
            trigger: item.trigger,
            input: item.input,
            output: item.output,
            status: item.status,
            startedAt: item.startedAt,
            toolCalls: item.toolCalls || [],
            promptInjectionFlags: item.promptInjectionFlags || [],
          }))
        );
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadExecutions();
  }, []);

  const handleSendPrompt = (promptText?: string) => {
    const text = promptText || inputPrompt;
    if (!text.trim() || loading) return;

    setLoading(true);
    setInputPrompt("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/rest/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
        const json = await res.json();

        if (json.ok) {
          const run = json.data;
          setMessages((prev) => [
            {
              id: run.executionId,
              trigger: "CHAT",
              input: text,
              output: run.finalResponse,
              status: run.status,
              startedAt: new Date().toISOString(),
              toolCalls: run.toolCalls,
              promptInjectionFlags: run.promptInjectionFlags,
              pendingConfirmationToken: run.pendingConfirmationToken,
            },
            ...prev,
          ]);

          if (run.status === "pending_confirmation") {
            showToast("Action paused: Administrator confirmation required for HIGH_RISK operation!", "error");
          } else if (run.status === "failed") {
            showToast("Execution aborted: Safety tripwire triggered!", "error");
          } else {
            showToast("Autonomous agent cycle completed successfully!");
          }
        } else {
          showToast(json.error?.message || "Agent execution failed", "error");
        }
      } catch {
        showToast("Error communicating with agent runtime", "error");
      } finally {
        setLoading(false);
      }
    });
  };

  const handleTriggerAutonomousPlanning = (goal?: string) => {
    setLoading(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/rest/agent/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal }),
        });
        const json = await res.json();
        if (json.ok) {
          const run = json.data;
          setMessages((prev) => [
            {
              id: run.executionId,
              trigger: "AUTONOMOUS_PLANNING",
              input: goal ? `Autonomous Planning: ${goal}` : "Autonomous Daily Operational Scan",
              output: run.finalResponse,
              status: run.status,
              startedAt: new Date().toISOString(),
              toolCalls: run.toolCalls,
              promptInjectionFlags: run.promptInjectionFlags,
              pendingConfirmationToken: run.pendingConfirmationToken,
            },
            ...prev,
          ]);
          showToast("Autonomous planning scan completed!");
        } else {
          showToast(json.error?.message || "Autonomous plan cycle failed", "error");
        }
      } catch {
        showToast("Error triggering autonomous plan", "error");
      } finally {
        setLoading(false);
      }
    });
  };

  const handleConfirmToolCall = async (toolCallId: string, action: "APPROVE" | "REJECT") => {
    try {
      const res = await fetch("/api/rest/agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolCallId, action }),
      });
      const json = await res.json();
      if (json.ok) {
        showToast(action === "APPROVE" ? "Tool call approved and executed!" : "Tool call rejected.");
        await loadExecutions();
      } else {
        showToast(json.error?.message || "Confirmation failed", "error");
      }
    } catch {
      showToast("Error confirming tool call", "error");
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🤖</span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Autonomous Agent Cockpit</h1>
            <span className="badge badge-accent text-xs">Phase 12</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
              Zero-Trust Guardrails Active
            </span>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Whitelisted tool catalog, backend permission gating, prompt injection tripwires, and human confirmation protocol.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleTriggerAutonomousPlanning()}
            disabled={loading}
            className="btn btn-secondary text-xs py-2 px-3 flex items-center gap-2"
          >
            <span>⚡</span>
            <span>Daily Operational Scan</span>
          </button>
          <button
            onClick={() => handleTriggerAutonomousPlanning("Q4 Developer Growth Campaign")}
            disabled={loading}
            className="btn btn-primary text-xs py-2 px-3 flex items-center gap-2"
          >
            <span>🎯</span>
            <span>Plan Growth Sprint</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Agent Chat & Tool Execution Stream */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Prompts Bar */}
          <div className="card p-3 bg-[var(--panel-solid)] border-[var(--border)] flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-[var(--muted)] shrink-0 font-medium">Quick Missions:</span>
            {[
              "Review our 30-day analytics and recommend focus areas",
              "Check audience comments and identify sensitive feedback",
              "Plan a 3-post multi-angle campaign for tech innovators",
              "Publish pending post to Instagram (Triggers confirmation gate)",
            ].map((p) => (
              <button
                key={p}
                onClick={() => handleSendPrompt(p)}
                disabled={loading}
                className="whitespace-nowrap px-3 py-1 rounded-full bg-[var(--panel-hover)] border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-indigo-500/40 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Interactive Console Stream */}
          <div className="space-y-4 min-h-[480px]">
            {loading && (
              <div className="card p-6 border-indigo-500/30 bg-gradient-to-r from-indigo-950/20 to-[var(--panel)] flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-indigo-300 font-medium">
                  Agent reasoning, validating permissions, and orchestrating tool sequence...
                </span>
              </div>
            )}

            {messages.length === 0 && !loading && (
              <div className="card p-12 text-center text-[var(--muted)] space-y-3">
                <span className="text-4xl">🛸</span>
                <h3 className="text-base font-semibold text-white">Agent Cockpit Ready</h3>
                <p className="text-xs max-w-md mx-auto">
                  Type an instruction below or trigger an autonomous operational scan. The agent will execute tool calls adhering to your organization role and safety policies.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className="card p-5 bg-[var(--panel-solid)] border-[var(--border)] space-y-4">
                {/* Message Header */}
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {msg.trigger === "AUTONOMOUS_PLANNING" ? "🎯 Autonomous Mission" : "💬 Command"}
                    </span>
                    <span className="text-[10px] text-[var(--muted)]">
                      {new Date(msg.startedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      msg.status === "completed"
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30"
                        : msg.status === "pending_confirmation"
                        ? "bg-amber-950/80 text-amber-300 border border-amber-500/30 animate-pulse"
                        : "bg-rose-950/80 text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {msg.status.toUpperCase()}
                  </span>
                </div>

                {/* User Input */}
                <div className="text-xs text-indigo-300 bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-500/20">
                  <span className="font-semibold text-[var(--muted)] block mb-0.5">Prompt:</span>
                  {msg.input}
                </div>

                {/* Prompt Injection Flags (if any) */}
                {msg.promptInjectionFlags && msg.promptInjectionFlags.length > 0 && (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 space-y-1">
                    <span className="font-bold flex items-center gap-1.5 text-rose-300">
                      <span>⚠️</span> Prompt Injection Tripwire Tripped
                    </span>
                    <ul className="list-disc list-inside text-[11px] text-rose-300/80">
                      {msg.promptInjectionFlags.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tool Calls Transparency Waterfall */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Tool Call Transparency ({msg.toolCalls.length} actions)
                    </span>
                    <div className="space-y-2">
                      {msg.toolCalls.map((call, idx) => (
                        <div
                          key={call.id || idx}
                          className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-cyan-300 font-semibold">{call.toolName}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                  call.riskClass === "READ"
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                    : call.riskClass === "WRITE"
                                    ? "bg-indigo-950 text-indigo-300 border border-indigo-500/30"
                                    : "bg-rose-950 text-rose-300 border border-rose-500/30"
                                }`}
                              >
                                {call.riskClass}
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-medium ${
                                call.allowed ? "text-emerald-400" : "text-amber-400"
                              }`}
                            >
                              {call.allowed ? "✓ Allowed" : "✕ Blocked"}
                            </span>
                          </div>

                          {/* Args */}
                          <div className="text-[10px] text-[var(--muted)] font-mono bg-black/60 p-1.5 rounded overflow-x-auto">
                            Args: {JSON.stringify(call.args)}
                          </div>

                          {/* Result or Denial */}
                          {call.resultSummary && (
                            <div className="text-[11px] text-gray-300 bg-white/5 p-2 rounded">
                              <span className="font-semibold text-[var(--muted)] mr-1">Result:</span>
                              {call.resultSummary}
                            </div>
                          )}

                          {call.denialReason && (
                            <div className="text-[11px] text-amber-300/90 bg-amber-950/20 border border-amber-500/20 p-2 rounded">
                              <span className="font-semibold mr-1">Policy:</span>
                              {call.denialReason}
                            </div>
                          )}

                          {/* HIGH_RISK Confirmation Action Card */}
                          {call.pendingConfirmation && (
                            <div className="p-3 rounded-lg bg-gradient-to-r from-amber-950/40 to-rose-950/40 border border-amber-500/40 space-y-2 mt-2">
                              <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                                <span>🛡️</span>
                                <span>Human Administrator Approval Required</span>
                              </div>
                              <p className="text-[11px] text-gray-200">
                                This action mutates external social media presence directly. As an administrator, you must confirm or reject this operation.
                              </p>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => handleConfirmToolCall(call.id, "APPROVE")}
                                  className="btn btn-primary text-xs py-1 px-3 bg-emerald-600 hover:bg-emerald-500 border-none"
                                >
                                  ✓ Approve & Execute
                                </button>
                                <button
                                  onClick={() => handleConfirmToolCall(call.id, "REJECT")}
                                  className="btn btn-secondary text-xs py-1 px-3"
                                >
                                  ✕ Cancel Action
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Final Agent Response */}
                {msg.output && (
                  <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/20 text-xs text-gray-200 leading-relaxed">
                    <span className="font-semibold text-indigo-400 block mb-1">Agent Synthesis:</span>
                    {msg.output}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Interactive Input Bar */}
          <div className="card p-3 bg-[var(--panel-solid)] border-[var(--border)] flex gap-2">
            <input
              type="text"
              placeholder="Command the autonomous agent (e.g. 'Draft a launch campaign', 'Analyze performance', 'Publish post')..."
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendPrompt()}
              className="input text-sm flex-1"
            />
            <button
              onClick={() => handleSendPrompt()}
              disabled={loading || !inputPrompt.trim()}
              className="btn btn-primary text-sm px-4"
            >
              {loading ? "Running..." : "Execute"}
            </button>
          </div>
        </div>

        {/* Right 1 Col: Agent Safety Architecture & Tool Reference */}
        <div className="space-y-4">
          {/* Agent Security Profile Card */}
          <div className="card p-5 bg-[var(--panel-solid)] border-[var(--border)] space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛡️</span>
              <h2 className="text-sm font-bold text-white">Agent Safety Bounds (Doc 4 §6)</h2>
            </div>

            <div className="space-y-2.5 text-xs text-[var(--muted)]">
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span>Model Runtime</span>
                <span className="font-mono text-white">omnipost-agent-v1</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span>Permission Gate</span>
                <span className="text-emerald-400 font-semibold">Strict Backend RBAC</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span>Prompt Injection Defense</span>
                <span className="text-emerald-400 font-semibold">Active Tripwires</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span>HIGH_RISK Protection</span>
                <span className="text-amber-400 font-semibold">Admin Confirmation</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span>Max Tool Calls / Exec</span>
                <span className="font-mono text-white">12 calls</span>
              </div>
            </div>
          </div>

          {/* Tool Catalog Reference */}
          <div className="card p-5 bg-[var(--panel-solid)] border-[var(--border)] space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📋</span> Whitelisted Tool Catalog
            </h2>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                  READ Tools (Safe)
                </span>
                <div className="space-y-1 text-[11px] text-[var(--muted)]">
                  <div>• <span className="font-mono text-white">get_campaign</span> — stats & rollup</div>
                  <div>• <span className="font-mono text-white">get_analytics</span> — honest metrics</div>
                  <div>• <span className="font-mono text-white">get_comments</span> — sentiment inbox</div>
                  <div>• <span className="font-mono text-white">get_scheduled_posts</span> — calendar</div>
                  <div>• <span className="font-mono text-white">get_accounts</span> — connected channels</div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                  WRITE Tools (Pre-Approval Drafts)
                </span>
                <div className="space-y-1 text-[11px] text-[var(--muted)]">
                  <div>• <span className="font-mono text-white">create_campaign</span> — strategic campaign</div>
                  <div>• <span className="font-mono text-white">create_post_draft</span> — DRAFT status</div>
                  <div>• <span className="font-mono text-white">request_human_approval</span> — queue review</div>
                  <div>• <span className="font-mono text-white">pause_campaign</span> — halt posting</div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block mb-1">
                  HIGH_RISK Tools (Confirmation Required)
                </span>
                <div className="space-y-1 text-[11px] text-[var(--muted)]">
                  <div>• <span className="font-mono text-white">publish_post</span> — live dispatch</div>
                  <div>• <span className="font-mono text-white">reply_to_comment</span> — public reply</div>
                  <div>• <span className="font-mono text-white">delete_post</span> — live removal</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
