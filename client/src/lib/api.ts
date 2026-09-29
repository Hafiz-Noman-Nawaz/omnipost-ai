import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError, validationError, type RoleName } from "@omnipost/shared";
import { roleAtLeast } from "@omnipost/shared";
import { getSession, setSessionCookie, clearSessionCookie, SESSION_COOKIE } from "./session";

/**
 * API helpers (docs/03 §1): uniform envelopes, Zod body validation,
 * RBAC per endpoint. Cookies are read/written via the same helpers as pages
 * so REST and server components stay consistent.
 */

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status });
}

export function fail(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(err.toBody(), { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unexpected error.";
  const body = new AppError("INTERNAL", message, { cause: err });
  return NextResponse.json(body.toBody(), { status: 500 });
}

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw validationError("Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".") || "_";
      if (!fieldErrors[k]) fieldErrors[k] = issue.message;
    }
    throw validationError("Validation failed.", { fieldErrors });
  }
  return parsed.data;
}

/** Resolve session context for API routes or throw 401. */
export async function requireApiSession() {
  const s = await getSession();
  if (!s) throw new AppError("UNAUTHENTICATED", "You must be signed in to do that.");
  return s.context;
}

export async function requireApiRole(min: RoleName) {
  const ctx = await requireApiSession();
  if (!roleAtLeast(ctx.user.role, min)) {
    throw new AppError("FORBIDDEN", `This action requires the ${min} role.`);
  }
  return ctx;
}

// Re-exports for route modules that set/clear the cookie after login/logout.
export { setSessionCookie, clearSessionCookie, SESSION_COOKIE };
