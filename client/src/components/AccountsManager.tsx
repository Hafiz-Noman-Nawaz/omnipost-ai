"use client";

import { useState, useEffect } from "react";
import { type PlatformKey, PLATFORM_KEYS, PLATFORM_LABELS, type CapabilityMatrix } from "@omnipost/shared";

interface SocialAccount {
  id: string;
  organizationId: string;
  platform: PlatformKey;
  platformAccountId: string;
  accountName: string;
  accountType: string | null;
  status: "CONNECTED" | "EXPIRED" | "REVOKED" | "ERROR";
  scopes: string[];
  tokenExpiresAt: string | null;
  connectedAt: string;
  lastActionAt: string | null;
  lastActionOk: boolean | null;
}

interface AccountsData {
  accounts: SocialAccount[];
  capabilities: Record<PlatformKey, CapabilityMatrix>;
}

export default function AccountsManager() {
  const [data, setData] = useState<AccountsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [connectingPlatform, setConnectingPlatform] = useState<PlatformKey | null>(null);
  const [customHandle, setCustomHandle] = useState("");
  const [simulatedConnecting, setSimulatedConnecting] = useState(false);
  const [selectedCapabilityPlatform, setSelectedCapabilityPlatform] = useState<PlatformKey | null>(null);
  const [disconnectingAccount, setDisconnectingAccount] = useState<SocialAccount | null>(null);
  const [testingHealthId, setTestingHealthId] = useState<string | null>(null);
  const [healthStatusResult, setHealthStatusResult] = useState<{ id: string; ok: boolean; message: string } | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/rest/accounts");
      if (!res.ok) throw new Error("Failed to load connected social accounts");
      const json = await res.json();
      setData(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleOAuthConnect = async (platform: PlatformKey) => {
    try {
      const res = await fetch("/api/rest/accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start connect flow");

      if (json.data?.authorizationUrl) {
        // Redirect to OAuth provider
        window.location.href = json.data.authorizationUrl;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connect error");
    }
  };

  const handleSimulatedConnect = async (platform: PlatformKey) => {
    try {
      setSimulatedConnecting(true);
      setError(null);
      const handle = customHandle.trim() || `@omnipost_${platform.toLowerCase()}`;
      const res = await fetch("/api/rest/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          platformAccountId: `${platform.toLowerCase()}_${Date.now()}`,
          accountName: handle.startsWith("@") ? handle : `@${handle}`,
          accountType: platform === "FACEBOOK" ? "page" : "business",
          accessToken: `${platform.toLowerCase()}_access_${Date.now()}_simulated_secret`,
          refreshToken: `${platform.toLowerCase()}_refresh_${Date.now()}`,
          tokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to connect account");

      setSuccessMsg(`Successfully connected ${PLATFORM_LABELS[platform]} account ${handle}`);
      setConnectingPlatform(null);
      setCustomHandle("");
      await fetchAccounts();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection error");
    } finally {
      setSimulatedConnecting(false);
    }
  };

  const handleTestHealth = async (id: string) => {
    try {
      setTestingHealthId(id);
      const res = await fetch(`/api/rest/accounts/${id}/health`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Health check failed");

      setHealthStatusResult({
        id,
        ok: json.data.ok,
        message: json.data.message,
      });

      await fetchAccounts();
      setTimeout(() => setHealthStatusResult(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Health test failed");
    } finally {
      setTestingHealthId(null);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectingAccount) return;
    try {
      const res = await fetch(`/api/rest/accounts/${disconnectingAccount.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect account");

      setSuccessMsg(`Disconnected ${disconnectingAccount.accountName}`);
      setDisconnectingAccount(null);
      await fetchAccounts();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Disconnect error");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--muted)]">Loading connected social platforms & capabilities...</p>
      </div>
    );
  }

  const accounts = data?.accounts || [];
  const capabilities = data?.capabilities;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>🔗</span> Connected Accounts
            </h1>
            <span className="badge badge-accent text-xs">Phase 7</span>
            <span className="badge badge-ok text-xs">AES-256-GCM Encrypted</span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
            Connect and manage multi-platform publishing credentials. Access tokens are encrypted at rest with AES-256-GCM and never exposed to client browsers or AI context.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAccounts()}
            className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--muted)] hover:text-white hover:bg-[var(--panel-hover)] transition-colors flex items-center gap-1.5"
          >
            <span>🔄</span> Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Security Architecture Callout */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/40 border border-indigo-500/20 text-xs space-y-1.5">
        <div className="flex items-center gap-2 font-semibold text-indigo-300">
          <span>🛡️</span> Zero-Trust Credential Security Model (Spec §28)
        </div>
        <p className="text-[var(--muted)] leading-relaxed">
          OAuth credentials and refresh tokens are sealed using <strong>AES-256-GCM authenticated ciphertext</strong> in byte-level database storage. Decryption keys are derived exclusively in isolated backend dispatchers at publishing time. Plaintext tokens are permanently stripped from all API outputs.
        </p>
      </div>

      {/* Grid of Platforms */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {PLATFORM_KEYS.map((key) => {
          const cap = capabilities?.[key];
          const connected = accounts.filter((a) => a.platform === key && a.status === "CONNECTED");
          const hasConnection = connected.length > 0;
          const isInstagram = key === "INSTAGRAM";

          return (
            <div
              key={key}
              className={`flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 ${
                hasConnection
                  ? "bg-slate-900/60 border-indigo-500/30 shadow-lg shadow-indigo-950/20"
                  : "bg-[var(--panel)] border-[var(--border)] hover:border-slate-700"
              }`}
            >
              <div>
                {/* Header with icon, name, status badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl p-2 rounded-xl bg-white/5 border border-white/10">
                      {cap?.icon || "🌐"}
                    </span>
                    <div>
                      <div className="font-semibold text-white text-base flex items-center gap-1.5">
                        {PLATFORM_LABELS[key]}
                        {isInstagram && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--muted)]">
                        {cap?.authType} · {cap?.media.maxCaptionLength.toLocaleString()} max chars
                      </div>
                    </div>
                  </div>

                  {hasConnection ? (
                    <span className="badge badge-ok text-[11px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Connected ({connected.length})
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--muted)] border border-white/5 bg-black/20 rounded px-2 py-0.5">
                      Not Linked
                    </span>
                  )}
                </div>

                {/* Platform Notes / Rate limits notice */}
                <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 text-[11px] text-[var(--muted)] mb-4 space-y-1">
                  <div className="line-clamp-2 text-slate-300">
                    {cap?.notes}
                  </div>
                  <div className="text-[10px] text-amber-400/90 font-medium">
                    ⚡ {cap?.rateLimitNote}
                  </div>
                </div>

                {/* Connected Account list under this platform */}
                {hasConnection && (
                  <div className="space-y-2 mb-4">
                    {connected.map((acc) => (
                      <div
                        key={acc.id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-xs text-white truncate flex items-center gap-1.5">
                            <span>👤</span> {acc.accountName}
                          </div>
                          <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 px-1.5 py-0.5 rounded bg-white/5">
                            {acc.accountType || "business"}
                          </span>
                        </div>

                        {/* Health status message toast if available */}
                        {healthStatusResult?.id === acc.id && (
                          <div
                            className={`p-2 rounded text-[11px] ${
                              healthStatusResult.ok
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            }`}
                          >
                            {healthStatusResult.message}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-[var(--muted)] pt-1 border-t border-white/5">
                          <span>Linked {new Date(acc.connectedAt).toLocaleDateString()}</span>
                          <div className="flex items-center gap-2">
                            <button
                              disabled={testingHealthId === acc.id}
                              onClick={() => handleTestHealth(acc.id)}
                              className="text-indigo-400 hover:text-indigo-300 transition-colors"
                              title="Verify encrypted credentials & token status"
                            >
                              {testingHealthId === acc.id ? "Checking..." : "Verify Health"}
                            </button>
                            <span>·</span>
                            <button
                              onClick={() => setDisconnectingAccount(acc)}
                              className="text-rose-400 hover:text-rose-300 transition-colors"
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  onClick={() => setConnectingPlatform(key)}
                  className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>+</span> Connect {PLATFORM_LABELS[key]}
                </button>
                <button
                  onClick={() => setSelectedCapabilityPlatform(key)}
                  className="p-2 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-white hover:bg-[var(--panel-hover)] text-xs"
                  title="View platform capabilities & publishing specs"
                >
                  ℹ️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect Account Modal */}
      {connectingPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--panel-solid)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{capabilities?.[connectingPlatform]?.icon}</span>
                <h3 className="font-bold text-white text-base">
                  Connect {PLATFORM_LABELS[connectingPlatform]}
                </h3>
              </div>
              <button
                onClick={() => setConnectingPlatform(null)}
                className="text-[var(--muted)] hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--muted)]">
              Choose your connection flow. For live production publishing, use standard OAuth. In local development or staging, test connection simulation is available immediately without developer portal credentials.
            </p>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-300">
                Account Handle or Page Name:
              </label>
              <input
                type="text"
                placeholder={`@your_${connectingPlatform.toLowerCase()}_handle`}
                value={customHandle}
                onChange={(e) => setCustomHandle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-[var(--border)] text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 text-[11px] text-[var(--muted)] space-y-1">
              <div className="font-semibold text-slate-200">Requested Permissions:</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {capabilities?.[connectingPlatform]?.defaultScopes.map((scope) => (
                  <span key={scope} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-indigo-300 font-mono">
                    {scope}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                disabled={simulatedConnecting}
                onClick={() => handleSimulatedConnect(connectingPlatform)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
              >
                {simulatedConnecting ? "Encrypting & Storing..." : "Connect Account (Instant Verified Token)"}
              </button>

              <button
                type="button"
                onClick={() => handleOAuthConnect(connectingPlatform)}
                className="w-full py-2.5 rounded-xl border border-indigo-500/40 hover:bg-indigo-500/10 text-indigo-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <span>🌐</span> Launch Platform OAuth 2.0 Web Flow
              </button>

              <button
                onClick={() => setConnectingPlatform(null)}
                className="w-full py-2 text-xs text-[var(--muted)] hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Capability Inspector Modal */}
      {selectedCapabilityPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--panel-solid)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{capabilities?.[selectedCapabilityPlatform]?.icon}</span>
                <h3 className="font-bold text-white text-base">
                  {PLATFORM_LABELS[selectedCapabilityPlatform]} Capability Matrix
                </h3>
              </div>
              <button
                onClick={() => setSelectedCapabilityPlatform(null)}
                className="text-[var(--muted)] hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {capabilities?.[selectedCapabilityPlatform] && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-[var(--muted)]">Publishing:</span>{" "}
                    <span className="text-emerald-400 font-semibold">Supported</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-[var(--muted)]">Comments:</span>{" "}
                    <span className={capabilities[selectedCapabilityPlatform].supportsComments ? "text-emerald-400 font-semibold" : "text-slate-500 font-semibold"}>
                      {capabilities[selectedCapabilityPlatform].supportsComments ? "Supported" : "Restricted"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-[var(--muted)]">Max Caption:</span>{" "}
                    <span className="text-white font-semibold">
                      {capabilities[selectedCapabilityPlatform].media.maxCaptionLength.toLocaleString()} chars
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-[var(--muted)]">Max Hashtags:</span>{" "}
                    <span className="text-white font-semibold">
                      {capabilities[selectedCapabilityPlatform].media.maxHashtags} tags
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1">
                  <div className="font-semibold text-slate-300">Media Formats Supported:</div>
                  <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
                    <span>Images: {capabilities[selectedCapabilityPlatform].media.images ? "✅" : "❌"}</span>
                    <span>Video: {capabilities[selectedCapabilityPlatform].media.video ? "✅" : "❌"}</span>
                    <span>Carousel: {capabilities[selectedCapabilityPlatform].media.carousel ? "✅" : "❌"}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Ratios: {capabilities[selectedCapabilityPlatform].media.aspectRatios.join(", ")}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] space-y-1">
                  <div className="font-semibold">Platform Constraints & Realities (Sept 2026):</div>
                  <p>{capabilities[selectedCapabilityPlatform].notes}</p>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedCapabilityPlatform(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {disconnectingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--panel-solid)] border border-rose-500/30 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base">Disconnect Account?</h3>
            <p className="text-xs text-[var(--muted)]">
              Are you sure you want to disconnect <strong>{disconnectingAccount.accountName}</strong> ({PLATFORM_LABELS[disconnectingAccount.platform]})? Scheduled posts assigned to this account will be paused until reconnected.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleDisconnect}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Disconnect
              </button>
              <button
                onClick={() => setDisconnectingAccount(null)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--muted)] hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
