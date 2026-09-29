import { prisma } from "../client";
import { AppError } from "@omnipost/shared";
import { writeAudit } from "./audit";
import type { SessionContext } from "./session-context";
import { CAPTION_LIMITS, screenCaption } from "@omnipost/ai";
import { selectLLMProvider } from "@omnipost/ai";
import { CAPTION_PROMPT, CAPTION_OUTPUT_SCHEMA } from "@omnipost/ai";
import type { PostStatus, ContentType } from "../generated/prisma/enums";

export interface CreatePostInput {
  contentId: string;
  campaignId?: string | null;
  platform: string;
  caption: string;
  hashtags?: string[];
  linkUrl?: string | null;
  mediaStorageKeys?: string[];
  status?: PostStatus;
}

export interface UpdatePostInput {
  caption?: string;
  hashtags?: string[];
  linkUrl?: string | null;
  mediaStorageKeys?: string[];
}

export interface ListApprovalQueueFilter {
  platform?: string;
  campaignId?: string;
  status?: string;
  search?: string;
}

function getOrgId(ctx: SessionContext): string {
  return ctx.organizationId ?? (ctx as unknown as { organization?: { id: string } }).organization?.id;
}

async function recordAudit(
  ctx: SessionContext,
  entry: { action: string; resourceType: string; resourceId: string; metadata?: Record<string, unknown> },
) {
  const orgId = getOrgId(ctx);
  return writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user?.id,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    metadata: entry.metadata,
  });
}

/**
 * Ensures user belongs to the organization owning the post.
 */
async function getPostOrThrow(organizationId: string, id: string) {
  const post = await prisma.post.findFirst({
    where: { id, organizationId },
    include: {
      content: true,
    },
  });

  if (!post) {
    throw new AppError("NOT_FOUND", `Post ${id} not found.`);
  }

  return post;
}

/**
 * Creates a post directly in draft or awaiting approval status.
 */
export async function createPost(ctx: SessionContext, input: CreatePostInput) {
  const orgId = getOrgId(ctx);
  const content = await prisma.content.findFirst({
    where: { id: input.contentId, organizationId: orgId },
  });

  if (!content) {
    throw new AppError("NOT_FOUND", `Content item ${input.contentId} not found.`);
  }

  const post = await prisma.post.create({
    data: {
      organizationId: orgId,
      contentId: input.contentId,
      campaignId: input.campaignId ?? content.campaignId,
      platform: input.platform,
      caption: input.caption,
      hashtags: input.hashtags ?? [],
      linkUrl: input.linkUrl,
      mediaStorageKeys: input.mediaStorageKeys ?? (content.storageKey ? [content.storageKey] : []),
      status: input.status ?? "AWAITING_APPROVAL",
    },
    include: {
      content: true,
    },
  });

  await recordAudit(ctx, {
    action: "post.created",
    resourceType: "post",
    resourceId: post.id,
    metadata: { platform: post.platform, status: post.status },
  });

  return post;
}

/**
 * Promotes or synchronizes a ContentVariant into a Post for the approval queue.
 */
export async function createPostFromVariant(ctx: SessionContext, variantId: string) {
  const orgId = getOrgId(ctx);
  const variant = await prisma.contentVariant.findFirst({
    where: { id: variantId, organizationId: orgId },
    include: {
      content: {
        include: {
          campaign: true,
        },
      },
    },
  });

  if (!variant) {
    throw new AppError("NOT_FOUND", `Variant ${variantId} not found.`);
  }

  // Check if a post already exists for this variant
  const existing = await prisma.post.findFirst({
    where: {
      organizationId: orgId,
      contentId: variant.contentId,
      platform: variant.platform,
      variantId: variant.id,
    },
    include: {
      content: true,
    },
  });

  const linkUrl = variant.content.campaign?.landingUrl ?? null;
  const mediaKeys = variant.content.storageKey ? [variant.content.storageKey] : [];

  if (existing) {
    const updated = await prisma.post.update({
      where: { id: existing.id },
      data: {
        caption: variant.caption,
        hashtags: variant.hashtags,
        safetyFlags: variant.safetyFlags ?? undefined,
        linkUrl: existing.linkUrl ?? linkUrl,
        mediaStorageKeys: mediaKeys,
        status: existing.status === "APPROVED" ? "APPROVED" : "AWAITING_APPROVAL",
      },
      include: { content: true },
    });
    return updated;
  }

  const post = await prisma.post.create({
    data: {
      organizationId: orgId,
      contentId: variant.contentId,
      campaignId: variant.content.campaignId,
      platform: variant.platform,
      caption: variant.caption,
      hashtags: variant.hashtags,
      linkUrl,
      variantId: variant.id,
      mediaStorageKeys: mediaKeys,
      safetyFlags: variant.safetyFlags ?? undefined,
      status: "AWAITING_APPROVAL",
    },
    include: {
      content: true,
    },
  });

  await recordAudit(ctx, {
    action: "post.created_from_variant",
    resourceType: "post",
    resourceId: post.id,
    metadata: { variantId: variant.id, platform: post.platform },
  });

  return post;
}

/**
 * Retrieves the full approval queue with summary statistics.
 */
export async function listApprovalQueue(ctx: SessionContext, filter: ListApprovalQueueFilter = {}) {
  const orgId = getOrgId(ctx);
  const where: Record<string, unknown> = {
    organizationId: orgId,
  };

  if (filter.platform) {
    where.platform = filter.platform;
  }

  if (filter.campaignId) {
    where.campaignId = filter.campaignId;
  }

  if (filter.status) {
    where.status = filter.status;
  } else {
    // Default to posts in awaiting approval, AI generated, or rejected/approved if requested
    where.status = {
      in: ["AWAITING_APPROVAL", "AI_GENERATED", "APPROVED", "REJECTED"],
    };
  }

  if (filter.search) {
    where.caption = { contains: filter.search, mode: "insensitive" };
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      content: {
        include: {
          campaign: true,
        },
      },
    },
  });

  // Also calculate queue counts across the organization
  const counts = await prisma.post.groupBy({
    by: ["status"],
    where: { organizationId: orgId },
    _count: { _all: true },
  });

  const summary = {
    awaitingApproval: 0,
    approved: 0,
    rejected: 0,
    draft: 0,
    scheduled: 0,
  };

  for (const c of counts) {
    if (c.status === "AWAITING_APPROVAL" || c.status === "AI_GENERATED") {
      summary.awaitingApproval += c._count._all;
    } else if (c.status === "APPROVED") {
      summary.approved += c._count._all;
    } else if (c.status === "REJECTED") {
      summary.rejected += c._count._all;
    } else if (c.status === "DRAFT") {
      summary.draft += c._count._all;
    } else if (c.status === "SCHEDULED") {
      summary.scheduled += c._count._all;
    }
  }

  return { posts, summary };
}

/**
 * Gets a single post by id.
 */
export async function getPost(ctx: SessionContext, id: string) {
  return getPostOrThrow(getOrgId(ctx), id);
}

/**
 * Updates post details prior to publishing.
 */
export async function updatePost(ctx: SessionContext, id: string, data: UpdatePostInput) {
  const post = await getPostOrThrow(getOrgId(ctx), id);

  if (post.status === "PUBLISHED") {
    throw new AppError("VALIDATION_ERROR", "Cannot edit an already published post.");
  }

  const updated = await prisma.post.update({
    where: { id },
    data: {
      caption: data.caption ?? post.caption,
      hashtags: data.hashtags ?? post.hashtags,
      linkUrl: data.linkUrl !== undefined ? data.linkUrl : post.linkUrl,
      mediaStorageKeys: data.mediaStorageKeys ?? post.mediaStorageKeys,
    },
    include: { content: true },
  });

  await recordAudit(ctx, {
    action: "post.updated",
    resourceType: "post",
    resourceId: id,
    metadata: { changed: Object.keys(data) },
  });

  return updated;
}

/**
 * Approves a post in the approval queue.
 */
export async function approvePost(
  ctx: SessionContext,
  id: string,
  opts: { scheduledAt?: string | null; bypassSafetyWarnings?: boolean } = {},
) {
  const post = await getPostOrThrow(getOrgId(ctx), id);

  const safety = post.safetyFlags as { ok?: boolean; flags?: Array<{ code: string; message: string }> } | null;
  if (safety && safety.ok === false && !opts.bypassSafetyWarnings) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Post has safety warnings (${safety.flags?.map((f) => f.code).join(", ")}). Resolve warnings or explicitly confirm approval.`,
      { details: safety.flags },
    );
  }

  const newStatus: PostStatus = opts.scheduledAt ? "SCHEDULED" : "APPROVED";

  const updated = await prisma.post.update({
    where: { id },
    data: {
      status: newStatus,
      approvedById: ctx.user.id,
      approvedAt: new Date(),
      rejectedReason: null,
    },
    include: { content: true },
  });

  // If a ContentVariant was linked, mark it approved as well
  if (post.variantId) {
    await prisma.contentVariant
      .update({
        where: { id: post.variantId },
        data: { approved: true },
      })
      .catch(() => null);
  }

  await recordAudit(ctx, {
    action: "post.approved",
    resourceType: "post",
    resourceId: id,
    metadata: { platform: post.platform, scheduledAt: opts.scheduledAt },
  });

  return updated;
}

/**
 * Rejects a post with a mandatory or optional reason.
 */
export async function rejectPost(ctx: SessionContext, id: string, reason?: string | null) {
  const post = await getPostOrThrow(getOrgId(ctx), id);

  const updated = await prisma.post.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectedReason: reason ?? "Rejected during review",
    },
    include: { content: true },
  });

  if (post.variantId) {
    await prisma.contentVariant
      .update({
        where: { id: post.variantId },
        data: { approved: false },
      })
      .catch(() => null);
  }

  await recordAudit(ctx, {
    action: "post.rejected",
    resourceType: "post",
    resourceId: id,
    metadata: { platform: post.platform, reason },
  });

  return updated;
}

/**
 * Duplicates a post as a new draft copy.
 */
export async function duplicatePost(ctx: SessionContext, id: string) {
  const orgId = getOrgId(ctx);
  const post = await getPostOrThrow(orgId, id);

  const duplicated = await prisma.post.create({
    data: {
      organizationId: orgId,
      contentId: post.contentId,
      campaignId: post.campaignId,
      platform: post.platform,
      caption: post.caption,
      hashtags: post.hashtags,
      linkUrl: post.linkUrl,
      mediaStorageKeys: post.mediaStorageKeys,
      status: "DRAFT",
    },
    include: { content: true },
  });

  await recordAudit(ctx, {
    action: "post.duplicated",
    resourceType: "post",
    resourceId: duplicated.id,
    metadata: { originalPostId: id },
  });

  return duplicated;
}

/**
 * Regenerates the caption and hashtags for a post using AI.
 */
export async function regeneratePost(ctx: SessionContext, id: string, notes?: string) {
  const orgId = getOrgId(ctx);
  const post = await prisma.post.findFirst({
    where: { id, organizationId: orgId },
    include: {
      content: {
        include: {
          campaign: {
            include: { brand: true },
          },
        },
      },
    },
  });

  if (!post) {
    throw new AppError("NOT_FOUND", `Post ${id} not found.`);
  }

  const { provider } = selectLLMProvider();
  const campaign = post.content.campaign;
  const brand = campaign?.brand;

  const promptInput = {
    platform: post.platform,
    title: post.content.title,
    description: post.content.description,
    text: notes ? `${post.content.text ?? ""}\nNote: ${notes}` : post.content.text,
    contentType: post.content.type,
    campaign: campaign
      ? {
          name: campaign.name,
          objective: campaign.objective,
          targetAudience: campaign.targetAudience,
          tone: campaign.tone,
          brandVoice: campaign.brandVoice,
          cta: campaign.cta,
          landingUrl: campaign.landingUrl,
        }
      : null,
    brand: brand
      ? {
          name: brand.name,
          voice: brand.voice,
          avoid: brand.avoid,
          audience: brand.audience,
        }
      : null,
    disclosureText: campaign?.disclosureText ?? null,
  };

  const response = await provider.complete({
    system: CAPTION_PROMPT.system,
    user: CAPTION_PROMPT.buildUser(promptInput),
    outputSchema: CAPTION_OUTPUT_SCHEMA,
  });

  const parsed = response.output as {
    caption: string;
    hook?: string;
    hashtags: string[];
    cta?: string;
  };

  const safety = screenCaption(post.platform, parsed, {
    avoidTerms: brand?.avoid ? brand.avoid.split(",").map((s: string) => s.trim()) : [],
    disclosureText: campaign?.disclosureText,
  });

  const updated = await prisma.post.update({
    where: { id },
    data: {
      caption: parsed.caption,
      hashtags: parsed.hashtags,
      safetyFlags: safety as unknown as object,
      status: "AWAITING_APPROVAL",
    },
    include: { content: true },
  });

  await recordAudit(ctx, {
    action: "post.regenerated",
    resourceType: "post",
    resourceId: id,
    metadata: { platform: post.platform, model: response.model },
  });

  return updated;
}

/**
 * Bulk approves multiple posts in batch.
 */
export async function bulkApprovePosts(ctx: SessionContext, postIds: string[]) {
  if (!postIds.length) {
    return { approvedCount: 0, skipped: [] };
  }

  const orgId = getOrgId(ctx);
  const posts = await prisma.post.findMany({
    where: {
      id: { in: postIds },
      organizationId: orgId,
    },
  });

  const approvedIds: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const p of posts) {
    const safety = p.safetyFlags as { ok?: boolean } | null;
    if (safety && safety.ok === false) {
      skipped.push({ id: p.id, reason: "Has safety warnings requiring manual review." });
      continue;
    }

    approvedIds.push(p.id);
  }

  if (approvedIds.length > 0) {
    await prisma.post.updateMany({
      where: { id: { in: approvedIds } },
      data: {
        status: "APPROVED",
        approvedById: ctx.user.id,
        approvedAt: new Date(),
        rejectedReason: null,
      },
    });

    await recordAudit(ctx, {
      action: "posts.bulk_approved",
      resourceType: "post",
      resourceId: approvedIds.join(","),
      metadata: { count: approvedIds.length },
    });
  }

  return { approvedCount: approvedIds.length, skipped };
}

/**
 * Bulk rejects multiple posts in batch.
 */
export async function bulkRejectPosts(ctx: SessionContext, postIds: string[], reason?: string) {
  if (!postIds.length) {
    return { rejectedCount: 0 };
  }

  const orgId = getOrgId(ctx);
  const res = await prisma.post.updateMany({
    where: {
      id: { in: postIds },
      organizationId: orgId,
    },
    data: {
      status: "REJECTED",
      rejectedReason: reason ?? "Bulk rejected by reviewer",
    },
  });

  await recordAudit(ctx, {
    action: "posts.bulk_rejected",
    resourceType: "post",
    resourceId: postIds.join(","),
    metadata: { count: res.count, reason },
  });

  return { rejectedCount: res.count };
}
