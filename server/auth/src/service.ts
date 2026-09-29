import {
  bootstrapOrganizationWithOwner,
  createSession,
  findValidSessionByToken,
  getUserByEmail,
  getUserById,
  listMembershipsForUser,
  registerUserWithOrganization,
  revokeSessionByToken,
  type SessionUser,
} from "@omnipost/database";
import { AppError, conflict, unauthenticated } from "@omnipost/shared";
import { hashPassword, verifyPassword } from "./password";

export type { SessionContext, SessionUser } from "@omnipost/database";

/**
 * Auth service (docs/03 §2 Auth, docs/05 §1.2).
 * Register → user + default org (Owner) + brand + settings, atomically.
 * Login → DB session row; cookie carries only the opaque token.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return base || "org";
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string | null;
  organizationName?: string;
}

export async function registerUser(input: RegisterInput): Promise<{ userId: string }> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new AppError("VALIDATION_ERROR", "Enter a valid email address.");
  }
  if (input.password.length < 10) {
    throw new AppError("VALIDATION_ERROR", "Password must be at least 10 characters.");
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    throw conflict("An account with this email already exists.");
  }

  const passwordHash = await hashPassword(input.password);
  const orgName = input.organizationName?.trim() || "My Organization";
  const slug = `${slugify(orgName)}-${Date.now().toString(36)}`;

  const { user } = await registerUserWithOrganization({
    email,
    name: input.name ?? null,
    passwordHash,
    organizationName: orgName,
    organizationSlug: slug,
  });

  return { userId: user.id };
}

export interface LoginInput {
  email: string;
  password: string;
  userAgent?: string | null;
  ip?: string | null;
}

export interface LoginResult {
  token: string;
  expiresAt: Date;
  user: SessionUser;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const user = await getUserByEmail(email);
  if (!user || !user.passwordHash) {
    // Uniform failure — do not reveal which part was wrong.
    throw unauthenticated("Invalid email or password.");
  }
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) {
    throw unauthenticated("Invalid email or password.");
  }

  const { session, token } = await createSession({
    userId: user.id,
    userAgent: input.userAgent ?? null,
    ip: input.ip ?? null,
  });

  const memberships = await listMembershipsForUser(user.id);
  const first = memberships[0];
  if (!first) {
    throw new AppError("INTERNAL", "User has no organization membership; registration failed atomically.");
  }

  return {
    token,
    expiresAt: session.expiresAt,
    user: { id: user.id, email: user.email, name: user.name, role: first.role },
  };
}

export async function resolveSession(token: string | undefined | null) {
  if (!token) return null;
  const session = await findValidSessionByToken(token);
  if (!session) return null;

  const memberships = await listMembershipsForUser(session.user.id);
  const first = memberships[0];
  if (!first) return null;

  return {
    context: {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: first.role,
      } satisfies SessionUser,
      organizationId: first.organizationId,
    },
    session: { id: session.id, expiresAt: session.expiresAt },
  };
}

export async function logout(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  return revokeSessionByToken(token);
}

export async function getUserPublic(userId: string) {
  const user = await getUserById(userId);
  if (!user) return null;
  const memberships = await listMembershipsForUser(user.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: memberships[0]?.role ?? null,
  };
}
