import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../client";

/**
 * DB-backed sessions (docs/05 §1.2): the raw token lives only in the cookie;
 * the database stores SHA-256(token) so a dump cannot mint sessions.
 */

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64");
}

export interface CreateSessionInput {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}

export async function createSession(input: CreateSessionInput) {
  const token = generateSessionToken();
  const session = await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash: hashSessionToken(token),
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return { session, token };
}

export async function findValidSessionByToken(token: string) {
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findFirst({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  return session;
}

export async function revokeSessionByToken(token: string): Promise<boolean> {
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findFirst({ where: { tokenHash } });
  if (!session) return false;
  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
  return true;
}

export async function revokeAllSessionsForUser(userId: string): Promise<number> {
  const res = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count;
}
