import { prisma } from "../client";
import type { Prisma } from "../generated/prisma/client";
import { mustBelongToOrg } from "@omnipost/shared";

export interface AuditEntry {
  actorType: "USER" | "AGENT" | "SYSTEM" | "WORKER";
  actorId?: string | null;
  action: string; // dotted, e.g. "auth.login"
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit trail (docs/02 AuditLog, docs/05 §1.5).
 * Callers pass organizationId explicitly; write is atomic with the caller's
 * transaction when one is supplied (Phase 5+ uses this for approvals).
 */
export async function writeAudit(organizationId: string, entry: AuditEntry, tx?: unknown) {
  const client = (tx as typeof prisma | undefined) ?? prisma;
  await client.auditLog.create({
    data: {
      organizationId,
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export interface AuditQuery {
  actorType?: string;
  action?: string;
  resourceType?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export async function listAuditLogs(organizationId: string, query: AuditQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const where = {
    organizationId,
    ...(query.actorType ? { actorType: query.actorType } : {}),
    ...(query.action ? { action: { contains: query.action } } : {}),
    ...(query.resourceType ? { resourceType: query.resourceType } : {}),
    ...(query.from || query.to
      ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data: logs, meta: { page, pageSize, total } };
}

export { mustBelongToOrg };
