"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--bg)] relative overflow-hidden">
      <div className="absolute inset-0 bg-radial from-indigo-900/15 via-transparent to-transparent pointer-events-none" />

      <div className="card w-full max-w-md space-y-6 p-6 sm:p-8 border border-white/10 shadow-2xl shadow-indigo-950/40 relative backdrop-blur-2xl">
        <div className="text-center relative">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--accent-gradient)] text-white text-xl font-bold shadow-lg shadow-indigo-500/30 mb-3 animate-float">
            ⚡
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Organization</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Initialize your workspace and founder permissions</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            setFieldErrors({});
            try {
              const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email,
                  password,
                  ...(name ? { name } : {}),
                  ...(organizationName ? { organizationName } : {}),
                }),
              });
              const json = await res.json().catch(() => null);
              if (!res.ok) {
                setError(json?.error?.message ?? "Registration failed.");
                const fe = json?.error?.details?.fieldErrors;
                if (fe) setFieldErrors(fe);
                return;
              }
              router.push("/dashboard");
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
              placeholder="founder@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full"
            />
            {fieldErrors["email"] && (
              <span className="text-xs text-[var(--danger)]">{fieldErrors["email"]}</span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
              Password (min 10 characters)
            </label>
            <input
              type="password"
              required
              minLength={10}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Full Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Alex Morgan"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                Workspace Name
              </label>
              <input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="My Organization"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <button className="btn btn-primary w-full py-2.5 text-sm" disabled={busy} type="submit">
            {busy ? "Setting Up Workspace…" : "Launch Workspace →"}
          </button>
        </form>

        <div className="pt-2 border-t border-[var(--border)] text-center">
          <p className="text-xs text-[var(--muted)]">
            Already have an account?{" "}
            <Link className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 ml-1" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
