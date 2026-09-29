import { prisma } from "../client";
import { AppError } from "@omnipost/shared";
import { writeAudit } from "./audit";
import type { SessionContext } from "./session-context";
import {
  CommentIntent,
  CommentStatus,
  HideAction,
  NotificationKind,
} from "../generated/prisma/enums";

export interface ListCommentsFilter {
  status?: CommentStatus | string;
  intent?: CommentIntent | string;
  postId?: string;
  platform?: string;
  requiresHuman?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UpsertCommentInput {
  postId: string;
  platform: string;
  platformCommentId: string;
  parentPlatformCommentId?: string | null;
  authorName?: string | null;
  authorId?: string | null;
  text: string;
  postedAt?: Date | null;
}

export interface UpdateClassificationInput {
  intent: CommentIntent;
  intentConfidence: number;
  sentiment: string;
  safetyFlags?: string[];
}

function getOrgId(ctx: SessionContext): string {
  return (
    ctx.organizationId ??
    (ctx as unknown as { organization?: { id: string } }).organization?.id
  );
}

/**
 * List comments with filtering, pagination, post info, and conversation thread details.
 */
export async function listComments(
  ctx: SessionContext,
  filter: ListCommentsFilter = {}
) {
  const orgId = getOrgId(ctx);
  const {
    status,
    intent,
    postId,
    platform,
    requiresHuman,
    search,
    limit = 50,
    offset = 0,
  } = filter;

  const where: Record<string, unknown> = {
    organizationId: orgId,
  };

  if (status) {
    where.status = status as CommentStatus;
  }
  if (intent) {
    where.intent = intent as CommentIntent;
  }
  if (postId) {
    where.postId = postId;
  }
  if (platform) {
    where.platform = platform;
  }
  if (requiresHuman !== undefined) {
    where.thread = { requiresHuman };
  }
  if (search && search.trim()) {
    where.text = { contains: search.trim(), mode: "insensitive" };
  }

  const [items, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
      skip: offset,
      include: {
        post: {
          select: {
            id: true,
            caption: true,
            platform: true,
            status: true,
            content: {
              select: {
                id: true,
                title: true,
                type: true,
              },
            },
          },
        },
        thread: {
          select: {
            id: true,
            requiresHuman: true,
            status: true,
            rootCommentId: true,
          },
        },
      },
    }),
    prisma.comment.count({ where }),
  ]);

  return { items, total, limit, offset };
}

/**
 * Get single comment by ID.
 */
export async function getCommentById(ctx: SessionContext, id: string) {
  const orgId = getOrgId(ctx);
  const comment = await prisma.comment.findFirst({
    where: { id, organizationId: orgId },
    include: {
      post: {
        select: {
          id: true,
          caption: true,
          platform: true,
          status: true,
          content: {
            select: {
              id: true,
              title: true,
              type: true,
            },
          },
        },
      },
      thread: {
        select: {
          id: true,
          requiresHuman: true,
          status: true,
          rootCommentId: true,
          comments: {
            orderBy: { createdAt: "asc" },
            take: 20,
          },
        },
      },
    },
  });

  if (!comment) {
    throw new AppError("NOT_FOUND", `Comment not found: ${id}`);
  }
  return comment;
}

/**
 * Ingest or update an incoming comment from webhook or manual sync.
 * Creates thread if root comment or links to parent comment's thread.
 */
export async function upsertComment(
  ctx: SessionContext,
  input: UpsertCommentInput
) {
  const orgId = getOrgId(ctx);

  // Verify post belongs to this org
  const post = await prisma.post.findFirst({
    where: { id: input.postId, organizationId: orgId },
  });
  if (!post) {
    throw new AppError(
      "NOT_FOUND",
      `Post ${input.postId} not found in this organization`
    );
  }

  // Check if comment already exists (idempotency)
  const existing = await prisma.comment.findUnique({
    where: {
      postId_platformCommentId: {
        postId: input.postId,
        platformCommentId: input.platformCommentId,
      },
    },
  });

  if (existing) {
    return prisma.comment.update({
      where: { id: existing.id },
      data: {
        text: input.text,
        authorName: input.authorName ?? existing.authorName,
        fetchedAt: new Date(),
      },
    });
  }

  // Handle Thread association
  let threadId: string | null = null;
  if (input.parentPlatformCommentId) {
    const parent = await prisma.comment.findUnique({
      where: {
        postId_platformCommentId: {
          postId: input.postId,
          platformCommentId: input.parentPlatformCommentId,
        },
      },
    });
    if (parent?.threadId) {
      threadId = parent.threadId;
    }
  }

  if (!threadId) {
    const newThread = await prisma.commentThread.create({
      data: {
        organizationId: orgId,
        postId: input.postId,
        rootCommentId: input.platformCommentId,
        requiresHuman: false,
        status: "open",
      },
    });
    threadId = newThread.id;
  }

  const comment = await prisma.comment.create({
    data: {
      organizationId: orgId,
      postId: input.postId,
      platform: input.platform,
      platformCommentId: input.platformCommentId,
      parentPlatformCommentId: input.parentPlatformCommentId,
      authorName: input.authorName,
      authorId: input.authorId,
      text: input.text,
      status: CommentStatus.NEW,
      postedAt: input.postedAt ?? new Date(),
      fetchedAt: new Date(),
      threadId,
    },
  });

  return comment;
}

/**
 * Record AI classification output on comment and auto-escalate if flagged.
 */
export async function updateCommentClassification(
  ctx: SessionContext,
  id: string,
  classification: UpdateClassificationInput
) {
  const orgId = getOrgId(ctx);
  const comment = await prisma.comment.findFirst({
    where: { id, organizationId: orgId },
    include: { thread: true },
  });
  if (!comment) {
    throw new AppError("NOT_FOUND", `Comment not found: ${id}`);
  }

  // Auto-escalate if SPAM, ABUSE, COMPLAINT, or safetyFlags present
  const isSensitive =
    classification.intent === CommentIntent.ABUSE ||
    classification.intent === CommentIntent.COMPLAINT ||
    classification.intent === CommentIntent.SPAM ||
    (classification.safetyFlags && classification.safetyFlags.length > 0);

  const newStatus = isSensitive
    ? CommentStatus.ESCALATED
    : CommentStatus.CLASSIFIED;

  const updated = await prisma.$transaction(async (tx) => {
    if (isSensitive && comment.threadId) {
      await tx.commentThread.update({
        where: { id: comment.threadId },
        data: { requiresHuman: true },
      });

      // Also create a notification for human attention
      await tx.notification.create({
        data: {
          organizationId: orgId,
          kind: NotificationKind.HUMAN_ATTENTION_REQUIRED,
          title: `Comment Attention: ${classification.intent}`,
          body: `Comment from ${comment.authorName || "User"} flagged as ${classification.intent}. Requires review.`,
          resourceId: comment.id,
        },
      });
    }

    return tx.comment.update({
      where: { id: comment.id },
      data: {
        intent: classification.intent,
        intentConfidence: classification.intentConfidence,
        sentiment: classification.sentiment,
        safetyFlags: classification.safetyFlags ?? [],
        status: newStatus,
        escalatedAt: isSensitive ? new Date() : comment.escalatedAt,
      },
    });
  });

  return updated;
}

/**
 * Mark comment and thread as escalated to human.
 */
export async function escalateComment(
  ctx: SessionContext,
  id: string,
  reason = "Manual escalation by operator"
) {
  const orgId = getOrgId(ctx);
  const comment = await prisma.comment.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!comment) {
    throw new AppError("NOT_FOUND", `Comment not found: ${id}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (comment.threadId) {
      await tx.commentThread.update({
        where: { id: comment.threadId },
        data: { requiresHuman: true },
      });
    }

    await tx.notification.create({
      data: {
        organizationId: orgId,
        kind: NotificationKind.HUMAN_ATTENTION_REQUIRED,
        title: "Comment Escalated",
        body: `Comment from ${comment.authorName || "User"} escalated: ${reason}`,
        resourceId: comment.id,
      },
    });

    return tx.comment.update({
      where: { id: comment.id },
      data: {
        status: CommentStatus.ESCALATED,
        escalatedAt: new Date(),
      },
    });
  });

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "COMMENT_ESCALATE",
    resourceType: "COMMENT",
    resourceId: comment.id,
    metadata: { reason },
  });

  return updated;
}

/**
 * Hide a comment (on platform and locally).
 */
export async function hideComment(
  ctx: SessionContext,
  id: string,
  hiddenBy: "MANUAL" | "AUTOMATION" = "MANUAL"
) {
  const orgId = getOrgId(ctx);
  const comment = await prisma.comment.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!comment) {
    throw new AppError("NOT_FOUND", `Comment not found: ${id}`);
  }

  const updated = await prisma.comment.update({
    where: { id: comment.id },
    data: {
      hidden: true,
      hiddenBy:
        hiddenBy === "AUTOMATION" ? HideAction.AUTOMATION : HideAction.MANUAL,
    },
  });

  await writeAudit(orgId, {
    actorType: hiddenBy === "AUTOMATION" ? "SYSTEM" : "USER",
    actorId: ctx.user.id,
    action: "COMMENT_HIDE",
    resourceType: "COMMENT",
    resourceId: comment.id,
    metadata: { hiddenBy },
  });

  return updated;
}

/**
 * Record successful reply to a comment.
 */
export async function recordCommentReply(
  ctx: SessionContext,
  id: string,
  input: { templateId?: string; replyText?: string } = {}
) {
  const orgId = getOrgId(ctx);
  const comment = await prisma.comment.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!comment) {
    throw new AppError("NOT_FOUND", `Comment not found: ${id}`);
  }

  const updated = await prisma.comment.update({
    where: { id: comment.id },
    data: {
      status: CommentStatus.HANDLED,
      repliedAt: new Date(),
      repliedWithTemplateId: input.templateId ?? null,
    },
  });

  if (comment.threadId) {
    await prisma.commentThread.update({
      where: { id: comment.threadId },
      data: { requiresHuman: false, status: "resolved" },
    });
  }

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "COMMENT_REPLY",
    resourceType: "COMMENT",
    resourceId: comment.id,
    metadata: {
      templateId: input.templateId,
      replySnippet: input.replyText?.slice(0, 100),
    },
  });

  return updated;
}

/**
 * Aggregated summary counts for the comments dashboard / header.
 */
export async function getCommentsSummary(ctx: SessionContext) {
  const orgId = getOrgId(ctx);

  const [total, byStatus, requiresHuman, byIntent] = await Promise.all([
    prisma.comment.count({ where: { organizationId: orgId } }),
    prisma.comment.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: true,
    }),
    prisma.commentThread.count({
      where: { organizationId: orgId, requiresHuman: true },
    }),
    prisma.comment.groupBy({
      by: ["intent"],
      where: { organizationId: orgId, intent: { not: null } },
      _count: true,
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const s of byStatus) {
    statusCounts[s.status] = s._count;
  }

  const intentCounts: Record<string, number> = {};
  for (const i of byIntent) {
    if (i.intent) {
      intentCounts[i.intent] = i._count;
    }
  }

  return {
    total,
    statusCounts,
    intentCounts,
    requiresHuman,
  };
}
