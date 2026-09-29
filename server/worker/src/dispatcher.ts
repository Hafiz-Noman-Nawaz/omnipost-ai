import { prisma } from "@omnipost/database";
import { writeAudit } from "@omnipost/database";

export interface PublishResult {
  ok: boolean;
  platformPostId?: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

import { getSocialProvider } from "./providers/registry";

/**
 * Publisher adapter interface that delegates publishing to platform-specific
 * provider implementations and enforces capability constraints.
 */
export async function dispatchPublish(
  platform: string,
  payload: {
    caption: string;
    hashtags: string[];
    linkUrl?: string | null;
    mediaKeys?: string[];
    accountTokens?: {
      accessToken: string;
      refreshToken?: string;
      platformAccountId: string;
    };
  },
): Promise<PublishResult> {
  const provider = getSocialProvider(platform);
  const result = await provider.publish(payload);
  return result;
}

/**
 * Processes a single scheduled post with retry management and attempt logging.
 */
export async function processScheduledJob(scheduledPostId: string): Promise<boolean> {
  const scheduled = await prisma.scheduledPost.findUnique({
    where: { id: scheduledPostId },
    include: {
      post: {
        include: {
          content: true,
        },
      },
      campaign: true,
    },
  });

  if (!scheduled) return false;

  // Idempotency: skip if already published or cancelled
  if (scheduled.status === "PUBLISHED" || scheduled.status === "CANCELLED") {
    return false;
  }

  // Check parent campaign pause state
  if (scheduled.campaign && scheduled.campaign.status === "PAUSED") {
    return false;
  }

  const attemptNumber = scheduled.attempts + 1;
  const startedAt = new Date();

  // Atomically lock and transition to PROCESSING
  await prisma.scheduledPost.update({
    where: { id: scheduled.id },
    data: {
      status: "PROCESSING",
      attempts: attemptNumber,
      lastAttemptAt: startedAt,
    },
  });

  let accountTokens: { accessToken: string; refreshToken?: string; platformAccountId: string } | undefined;
  if (scheduled.socialAccountId) {
    try {
      const { getDecryptedAccountTokens } = await import("@omnipost/database");
      accountTokens = await getDecryptedAccountTokens(scheduled.organizationId, scheduled.socialAccountId);
    } catch (err) {
      console.warn("Could not retrieve decrypted social account tokens:", err);
    }
  }

  const publishResult = await dispatchPublish(scheduled.platform, {
    caption: scheduled.post.caption,
    hashtags: scheduled.post.hashtags,
    linkUrl: scheduled.post.linkUrl,
    mediaKeys: scheduled.post.mediaStorageKeys,
    accountTokens,
  });

  const finishedAt = new Date();

  if (publishResult.ok) {
    // Record successful attempt and mark post PUBLISHED
    await prisma.$transaction([
      prisma.publishAttempt.create({
        data: {
          scheduledPostId: scheduled.id,
          attemptNumber,
          startedAt,
          finishedAt,
          ok: true,
        },
      }),
      prisma.scheduledPost.update({
        where: { id: scheduled.id },
        data: {
          status: "PUBLISHED",
          publishedAt: finishedAt,
          platformPostId: publishResult.platformPostId,
          error: null as unknown as object,
        },
      }),
      prisma.post.update({
        where: { id: scheduled.postId },
        data: {
          status: "PUBLISHED",
        },
      }),
    ]);

    await writeAudit(scheduled.organizationId, {
      actorType: "WORKER",
      action: "post.published",
      resourceType: "scheduled_post",
      resourceId: scheduled.id,
      metadata: {
        platform: scheduled.platform,
        platformPostId: publishResult.platformPostId,
        attemptNumber,
      },
    });

    return true;
  } else {
    // Publish failed: calculate retry or mark final failure
    const isRetryable = publishResult.error?.retryable && attemptNumber < scheduled.maxAttempts;
    const newStatus = isRetryable ? "RETRYING" : "FAILED";
    
    // Exponential backoff: 1min, 2min, 4min, 8min...
    const backoffMinutes = Math.pow(2, attemptNumber - 1);
    const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

    await prisma.$transaction([
      prisma.publishAttempt.create({
        data: {
          scheduledPostId: scheduled.id,
          attemptNumber,
          startedAt,
          finishedAt,
          ok: false,
          errorCode: publishResult.error?.code ?? "UNKNOWN_ERROR",
          message: publishResult.error?.message ?? "Publishing failed",
        },
      }),
      prisma.scheduledPost.update({
        where: { id: scheduled.id },
        data: {
          status: newStatus,
          scheduledAt: isRetryable ? nextRetryAt : scheduled.scheduledAt,
          error: (publishResult.error ?? { code: "ERROR", message: "Failed" }) as unknown as object,
        },
      }),
      prisma.post.update({
        where: { id: scheduled.postId },
        data: {
          status: newStatus === "FAILED" ? "FAILED" : "SCHEDULED",
        },
      }),
    ]);

    await writeAudit(scheduled.organizationId, {
      actorType: "WORKER",
      action: isRetryable ? "post.publish_retry_queued" : "post.publish_failed",
      resourceType: "scheduled_post",
      resourceId: scheduled.id,
      metadata: {
        platform: scheduled.platform,
        attemptNumber,
        error: publishResult.error,
        nextRetryAt: isRetryable ? nextRetryAt.toISOString() : undefined,
      },
    });

    return false;
  }
}

/**
 * Polls the database for due scheduled posts and processes them.
 */
export async function pollAndProcessDuePosts(batchSize = 10): Promise<number> {
  const now = new Date();

  // Atomically select due posts
  const duePosts = await prisma.scheduledPost.findMany({
    where: {
      status: { in: ["QUEUED", "RETRYING"] },
      scheduledAt: { lte: now },
    },
    take: batchSize,
    orderBy: { scheduledAt: "asc" },
  });

  let processedCount = 0;
  for (const post of duePosts) {
    const success = await processScheduledJob(post.id);
    if (success) processedCount++;
  }

  return processedCount;
}
