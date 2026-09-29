import { prisma } from "../client";
import { AppError } from "@omnipost/shared";
import { writeAudit } from "./audit";
import type { SessionContext } from "./session-context";
import type { ScheduledPostStatus } from "../generated/prisma/enums";

export interface SchedulePostInput {
  postId: string;
  scheduledAt: string | Date;
  timezone?: string;
  socialAccountId?: string | null;
}

export interface ListScheduledPostsFilter {
  platform?: string;
  campaignId?: string;
  status?: string;
  from?: string | Date;
  to?: string | Date;
}

function getOrgId(ctx: SessionContext): string {
  return ctx.organizationId ?? (ctx as unknown as { organization?: { id: string } }).organization?.id;
}

/**
 * Validates timezone string or falls back to UTC.
 */
function normalizeTimezone(tz?: string): string {
  if (!tz) return "UTC";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/**
 * Schedules an approved or review-ready post for future publication.
 */
export async function schedulePost(ctx: SessionContext, input: SchedulePostInput) {
  const orgId = getOrgId(ctx);

  const post = await prisma.post.findFirst({
    where: { id: input.postId, organizationId: orgId },
    include: {
      content: {
        include: {
          campaign: true,
        },
      },
    },
  });

  if (!post) {
    throw new AppError("NOT_FOUND", `Post ${input.postId} not found.`);
  }

  // Safety check: Cannot schedule rejected or unapproved posts
  if (post.status === "REJECTED") {
    throw new AppError("VALIDATION_ERROR", "Cannot schedule a rejected post. Approve or edit the post first.");
  }

  if (post.status === "AWAITING_APPROVAL") {
    throw new AppError("VALIDATION_ERROR", "Cannot schedule post with status AWAITING_APPROVAL. Post must be approved first.");
  }

  // Check if safety flags exist and are unresolved
  const safety = post.safetyFlags as { ok?: boolean } | null;
  if (safety && safety.ok === false && post.status !== "APPROVED") {
    throw new AppError("VALIDATION_ERROR", "Post has unresolved content safety flags. Approve it before scheduling.");
  }

  // Check parent campaign status
  if (post.content?.campaign && post.content.campaign.status === "PAUSED") {
    throw new AppError("VALIDATION_ERROR", "Parent campaign is paused. Resume campaign before scheduling posts.");
  }

  const scheduledDate = new Date(input.scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Invalid scheduledAt date format.");
  }

  const timezone = normalizeTimezone(input.timezone);
  const idempotencyKey = `sched_${post.id}_${Date.now()}`;

  // Transition Post status to SCHEDULED and create ScheduledPost
  const [, scheduled] = await prisma.$transaction([
    prisma.post.update({
      where: { id: post.id },
      data: {
        status: "SCHEDULED",
        approvedAt: post.approvedAt ?? new Date(),
        approvedById: post.approvedById ?? ctx.user.id,
      },
    }),
    prisma.scheduledPost.create({
      data: {
        organizationId: orgId,
        postId: post.id,
        campaignId: post.campaignId ?? post.content?.campaignId ?? null,
        platform: post.platform,
        socialAccountId: input.socialAccountId ?? null,
        scheduledAt: scheduledDate,
        timezone,
        status: "QUEUED",
        idempotencyKey,
      },
      include: {
        post: {
          include: {
            content: true,
          },
        },
      },
    }),
  ]);

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "post.scheduled",
    resourceType: "scheduled_post",
    resourceId: scheduled.id,
    metadata: {
      postId: post.id,
      platform: post.platform,
      scheduledAt: scheduledDate.toISOString(),
      timezone,
    },
  });

  return scheduled;
}

/**
 * Lists scheduled posts with optional filtering by platform, status, and date range.
 */
export async function listScheduledPosts(ctx: SessionContext, filter: ListScheduledPostsFilter = {}) {
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
  }

  if (filter.from || filter.to) {
    where.scheduledAt = {
      ...(filter.from ? { gte: new Date(filter.from) } : {}),
      ...(filter.to ? { lte: new Date(filter.to) } : {}),
    };
  }

  const scheduled = await prisma.scheduledPost.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: {
      post: {
        include: {
          content: {
            include: {
              campaign: true,
            },
          },
        },
      },
      attemptsLog: {
        orderBy: { attemptNumber: "desc" },
        take: 5,
      },
    },
  });

  return scheduled;
}

/**
 * Gets a single scheduled post with attempt logs.
 */
export async function getScheduledPost(ctx: SessionContext, id: string) {
  const orgId = getOrgId(ctx);
  const item = await prisma.scheduledPost.findFirst({
    where: { id, organizationId: orgId },
    include: {
      post: {
        include: {
          content: true,
        },
      },
      campaign: true,
      attemptsLog: {
        orderBy: { attemptNumber: "desc" },
      },
    },
  });

  if (!item) {
    throw new AppError("NOT_FOUND", `Scheduled post ${id} not found.`);
  }

  return item;
}

/**
 * Updates the scheduled time of a queued post.
 */
export async function reschedulePost(
  ctx: SessionContext,
  id: string,
  opts: { scheduledAt: string | Date; timezone?: string },
) {
  const orgId = getOrgId(ctx);
  const scheduled = await prisma.scheduledPost.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!scheduled) {
    throw new AppError("NOT_FOUND", `Scheduled post ${id} not found.`);
  }

  if (scheduled.status !== "QUEUED") {
    throw new AppError(
      "VALIDATION_ERROR",
      `Cannot reschedule a post in ${scheduled.status} status. Only QUEUED posts can be rescheduled.`,
    );
  }

  const newDate = new Date(opts.scheduledAt);
  if (isNaN(newDate.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Invalid scheduledAt date format.");
  }

  const timezone = opts.timezone ? normalizeTimezone(opts.timezone) : scheduled.timezone;

  const updated = await prisma.scheduledPost.update({
    where: { id },
    data: {
      scheduledAt: newDate,
      timezone,
    },
    include: {
      post: true,
    },
  });

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "post.rescheduled",
    resourceType: "scheduled_post",
    resourceId: id,
    metadata: { newScheduledAt: newDate.toISOString(), timezone },
  });

  return updated;
}

/**
 * Cancels a scheduled post.
 */
export async function cancelScheduledPost(ctx: SessionContext, id: string) {
  const orgId = getOrgId(ctx);
  const scheduled = await prisma.scheduledPost.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!scheduled) {
    throw new AppError("NOT_FOUND", `Scheduled post ${id} not found.`);
  }

  if (scheduled.status === "PUBLISHED") {
    throw new AppError("VALIDATION_ERROR", "Cannot cancel an already published post.");
  }

  const [updated] = await prisma.$transaction([
    prisma.scheduledPost.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: { post: true },
    }),
    prisma.post.update({
      where: { id: scheduled.postId },
      data: { status: "APPROVED" },
    }),
  ]);

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "post.schedule_cancelled",
    resourceType: "scheduled_post",
    resourceId: id,
    metadata: { postId: scheduled.postId },
  });

  return updated;
}

/**
 * Manually retries a failed scheduled post.
 */
export async function retryScheduledPost(ctx: SessionContext, id: string) {
  const orgId = getOrgId(ctx);
  const scheduled = await prisma.scheduledPost.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!scheduled) {
    throw new AppError("NOT_FOUND", `Scheduled post ${id} not found.`);
  }

  if (scheduled.status !== "FAILED" && scheduled.status !== "RETRYING") {
    throw new AppError("VALIDATION_ERROR", `Post is in ${scheduled.status} status. Only FAILED or RETRYING posts can be retried.`);
  }

  const updated = await prisma.$transaction([
    prisma.scheduledPost.update({
      where: { id },
      data: {
        status: "QUEUED",
        scheduledAt: new Date(), // run immediately
        error: null as unknown as object,
      },
      include: { post: true },
    }),
    prisma.post.update({
      where: { id: scheduled.postId },
      data: { status: "SCHEDULED" },
    }),
  ]);

  await writeAudit(orgId, {
    actorType: "USER",
    actorId: ctx.user.id,
    action: "post.schedule_retried",
    resourceType: "scheduled_post",
    resourceId: id,
    metadata: { postId: scheduled.postId },
  });

  return updated[0];
}
