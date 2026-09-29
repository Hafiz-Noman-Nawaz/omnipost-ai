import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession, type SessionContext } from "@omnipost/auth";
import { roleAtLeast, type RoleName } from "@omnipost/shared";

export const SESSION_COOKIE = "omnipost_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

type ResolvedSession = NonNullable<Awaited<ReturnType<typeof resolveSession>>>;

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

/** Read the session without redirecting (for API routes). */
export async function getSession(): Promise<ResolvedSession | null> {
  const token = await getSessionToken();
  return resolveSession(token);
}

/** Read the session in pages; redirect to /login when absent. */
export async function requireSession(): Promise<ResolvedSession> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Enforce RBAC server-side (docs/03 §1). Redirects when role is too low. */
export async function requireRole(min: RoleName): Promise<SessionContext> {
  const { context } = await requireSession();
  if (!roleAtLeast(context.user.role, min)) redirect("/dashboard?forbidden=1");
  return context;
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}
