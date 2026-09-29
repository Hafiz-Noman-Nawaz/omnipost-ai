import { prisma } from "../client";
import { mustBelongToOrg, notFound, validationError } from "@omnipost/shared";
import type { ContentStatus, ContentType } from "../generated/prisma/enums";

/**
 * Content Vault repository (docs/02 Content). Every read/write is
 * organization-scoped; ids from other orgs resolve to NOT_FOUND.
 */

export interface CreateContentInput {
  organizationId: string;
  createdById: string;
  type: ContentType;
  title: string;
  description?: string | null;
  text?: string | null;
  linkUrl?: string | null;
  storageKey?: string | null;
  thumbnailUrl?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  sourceHash?: string | null;
  tags?: string[];
  campaignId?: string | null;
  status?: ContentStatus;
}

export async function createContent(input: CreateContentInput) {
  if (input.campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
    });
    if (!campaign || campaign.organizationId !== input.organizationId) {
      throw notFound("Campaign");
    }
  }
  return prisma.content.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.createdById,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      text: input.text ?? null,
      linkUrl: input.linkUrl ?? null,
      storageKey: input.storageKey ?? null,
      fileUrl: null, // filled by the API layer as a route path
      thumbnailUrl: input.thumbnailUrl ?? null,
      originalFilename: input.originalFilename ?? null,
      mimeType: input.mimeType ?? null,
      sizeBytes: input.sizeBytes ?? null,
      sourceHash: input.sourceHash ?? null,
      tags: input.tags ?? [],
      status: input.status ?? "DRAFT",
      campaignId: input.campaignId ?? null,
    },
  });
}

export interface ContentFilter {
  q?: string;
  type?: ContentType;
  status?: ContentStatus;
  campaignId?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
  sort?: "createdAt" | "title" | "sizeBytes";
  order?: "asc" | "desc";
}

export async function listContent(organizationId: string, filter: ContentFilter = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 24));
  const sort = filter.sort ?? "createdAt";
  const order = filter.order ?? "desc";

  const where = {
    organizationId,
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.campaignId ? { campaignId: filter.campaignId } : {}),
    ...(filter.tag ? { tags: { has: filter.tag } } : {}),
    ...(filter.q
      ? {
          OR: [
            { title: { contains: filter.q, mode: "insensitive" as const } },
            { description: { contains: filter.q, mode: "insensitive" as const } },
            { originalFilename: { contains: filter.q, mode: "insensitive" as const } },
            { text: { contains: filter.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.content.findMany({
      where,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.content.count({ where }),
  ]);

  return { data: items, meta: { page, pageSize, total } };
}

export async function getContentById(organizationId: string, id: string) {
  const item = await prisma.content.findUnique({ where: { id } });
  // Another org's id is indistinguishable from a missing one (no existence leak).
  if (!item || item.organizationId !== organizationId) return null;
  return item;
}

export interface UpdateContentInput {
  title?: string;
  description?: string | null;
  text?: string | null;
  linkUrl?: string | null;
  tags?: string[];
  campaignId?: string | null;
  status?: ContentStatus;
}

/** Allowed transitions guard (docs/02 §1 ContentStatus lifecycle). */
const STATUS_TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  DRAFT: ["PROCESSING", "READY", "ARCHIVED"],
  PROCESSING: ["READY", "FAILED", "ARCHIVED"],
  READY: ["SCHEDULED", "ARCHIVED", "DRAFT"],
  SCHEDULED: ["PUBLISHED", "FAILED", "READY", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  FAILED: ["DRAFT", "READY", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export async function updateContent(
  organizationId: string,
  id: string,
  input: UpdateContentInput,
) {
  const existing = await getContentById(organizationId, id);
  if (!existing) throw notFound("Content");

  if (input.status && input.status !== existing.status) {
    const allowed = STATUS_TRANSITIONS[existing.status as ContentStatus];
    if (!allowed || !allowed.includes(input.status)) {
      throw validationError(
        `Cannot move content from ${existing.status} to ${input.status}. Allowed: ${allowed ? allowed.join(", ") : "none"}.`,
      );
    }
  }

  if (input.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: input.campaignId } });
    if (!campaign || campaign.organizationId !== organizationId) {
      throw notFound("Campaign");
    }
  }

  return prisma.content.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.text !== undefined ? { text: input.text } : {}),
      ...(input.linkUrl !== undefined ? { linkUrl: input.linkUrl } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
}

/** Archive semantics: files with posts must be archived, not destroyed (docs/03). */
export async function deleteContent(organizationId: string, id: string): Promise<"deleted" | "archived"> {
  const existing = await getContentById(organizationId, id);
  if (!existing) throw notFound("Content");

  // Phase 5 will introduce posts referencing content; until then, delete
  // outright for file-less items and archive file-backed items to preserve
  // the original asset (docs/02 §3.3).
  if (existing.storageKey) {
    await prisma.content.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    return "archived";
  }
  await prisma.content.delete({ where: { id } });
  return "deleted";
}

export async function findDuplicateByHash(organizationId: string, hash: string) {
  return prisma.content.findFirst({
    where: { organizationId, sourceHash: hash, status: { not: "ARCHIVED" } },
    select: { id: true, title: true, originalFilename: true },
  });
}
