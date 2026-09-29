"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="card w-full max-w-md space-y-6 p-6 sm:p-8 border border-white/10 shadow-2xl shadow-indigo-950/40 relative backdrop-blur-2xl">
      {/* Decorative ambient glow */}
      <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="text-center relative">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--accent-gradient)] text-white text-xl font-bold shadow-lg shadow-indigo-500/30 mb-3 animate-float">
          ⚡
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Welcome to OmniPost</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Autonomous Social Media Management Platform</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
              setError(json?.error?.message ?? "Sign-in failed.");
              return;
            }
            const next = params.get("next") ?? "/dashboard";
            router.push(next);
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
            Work Email
          </label>
          <input
            type="email"
            required
            placeholder="founder@omnipost.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
            Password
          </label>
          <input
            type="password"
            required
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <button className="btn btn-primary w-full py-2.5 text-sm" disabled={busy} type="submit">
          {busy ? "Authenticating…" : "Sign In to Dashboard →"}
        </button>
      </form>

      <div className="pt-2 border-t border-[var(--border)] text-center">
        <p className="text-xs text-[var(--muted)]">
          Need an organization account?{" "}
          <Link className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 ml-1" href="/register">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--bg)] relative overflow-hidden">
      <div className="absolute inset-0 bg-radial from-indigo-900/15 via-transparent to-transparent pointer-events-none" />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
