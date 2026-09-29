import {
  prisma,
  recordPostMetric,
  getDecryptedAccountTokens,
  type SessionContext,
} from "@omnipost/database";
import { getSocialProvider } from "./providers/registry";
import { type MetricSnapshot } from "./providers/types";

/**
 * Synchronize real metrics from provider for a single post.
 */
export async function syncPostMetrics(
  ctx: SessionContext,
  postId: string
): Promise<{ postId: string; platform: string; metrics: MetricSnapshot; metricRecordId: string }> {
  const orgId = ctx.organizationId;
  const post = await prisma.post.findFirst({
    where: { id: postId, organizationId: orgId },
    include: {
      scheduled: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }

  const scheduledPost = post.scheduled[0];
  const platformPostId = scheduledPost?.platformPostId || `sim_${post.id}`;
  const provider = getSocialProvider(post.platform as any);

  let tokens: { accessToken: string; platformAccountId: string } | undefined;
  if (scheduledPost?.socialAccountId) {
    try {
      const decrypted = await getDecryptedAccountTokens(orgId, scheduledPost.socialAccountId);
      tokens = {
        accessToken: decrypted.accessToken,
        platformAccountId: decrypted.platformAccountId,
      };
    } catch {
      // Fallback if tokens are not set or decryption in dev
    }
  }

  if (!provider.getAnalytics) {
    throw new Error(`Provider for platform ${post.platform} does not implement getAnalytics`);
  }

  const snapshot = await provider.getAnalytics({
    platformPostId,
    accountTokens: tokens,
  });

  const record = await recordPostMetric(ctx, {
    postId: post.id,
    platform: post.platform,
    likes: snapshot.likes,
    commentsCount: snapshot.commentsCount,
    shares: snapshot.shares,
    views: snapshot.views,
    clicks: snapshot.clicks,
    source: snapshot.source || "API",
    capturedAt: new Date(),
  });

  return {
    postId: post.id,
    platform: post.platform,
    metrics: snapshot,
    metricRecordId: record.id,
  };
}

/**
 * Synchronize metrics for all published posts in the organization.
 */
export async function syncOrgMetrics(
  ctx: SessionContext
): Promise<{ totalPosts: number; syncedCount: number; errors: Array<{ postId: string; error: string }> }> {
  const orgId = ctx.organizationId;

  const posts = await prisma.post.findMany({
    where: {
      organizationId: orgId,
      status: "PUBLISHED",
    },
    select: { id: true },
  });

  let syncedCount = 0;
  const errors: Array<{ postId: string; error: string }> = [];

  for (const post of posts) {
    try {
      await syncPostMetrics(ctx, post.id);
      syncedCount++;
    } catch (err: any) {
      errors.push({ postId: post.id, error: err?.message || String(err) });
    }
  }

  return {
    totalPosts: posts.length,
    syncedCount,
    errors,
  };
}
