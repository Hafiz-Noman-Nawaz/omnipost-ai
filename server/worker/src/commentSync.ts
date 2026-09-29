import {
  prisma,
  upsertComment,
  updateCommentClassification,
  recordCommentReply,
  getCommentById,
  getDecryptedAccountTokens,
  type SessionContext,
  CommentStatus,
} from "@omnipost/database";
import { getSocialProvider } from "./providers/registry";
import { selectLLMProvider, classifyComment } from "@omnipost/ai";

/**
 * Synchronize comments from social platform for a specific post,
 * store them idempotently, and run AI intent classification.
 */
export async function syncCommentsForPost(
  ctx: SessionContext,
  postId: string
): Promise<{ syncedCount: number; classifiedCount: number }> {
  const orgId = ctx.organizationId;
  const post = await prisma.post.findFirst({
    where: { id: postId, organizationId: orgId },
    include: {
      scheduled: {
        where: { status: "PUBLISHED", platformPostId: { not: null } },
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

  let rawComments: Array<{
    platformCommentId: string;
    parentPlatformCommentId?: string | null;
    authorName?: string;
    authorId?: string;
    text: string;
    postedAt?: Date;
  }> = [];

  let tokens: { accessToken: string; platformAccountId: string } | undefined;
  if (scheduledPost?.socialAccountId) {
    try {
      const decrypted = await getDecryptedAccountTokens(orgId, scheduledPost.socialAccountId);
      tokens = {
        accessToken: decrypted.accessToken,
        platformAccountId: decrypted.platformAccountId,
      };
    } catch {
      // Dev/fallback mode if no encrypted tokens attached
    }
  }

  if (provider.getComments) {
    try {
      rawComments = await provider.getComments({
        platformPostId,
        accountTokens: tokens,
      });
    } catch (err) {
      console.warn(`[commentSync] Provider ${post.platform} getComments failed:`, err);
    }
  } else {
    // Platform does not support fetching comments via API
    return { syncedCount: 0, classifiedCount: 0 };
  }

  let syncedCount = 0;
  let classifiedCount = 0;
  const { provider: llm } = selectLLMProvider();

  for (const raw of rawComments) {
    const comment = await upsertComment(ctx, {
      postId: post.id,
      platform: post.platform,
      platformCommentId: raw.platformCommentId,
      parentPlatformCommentId: raw.parentPlatformCommentId,
      authorName: raw.authorName || "User",
      authorId: raw.authorId,
      text: raw.text,
      postedAt: raw.postedAt,
    });
    syncedCount++;

    // Classify if newly created or unclassified
    if (comment.status === CommentStatus.NEW || !comment.intent) {
      try {
        const classification = await classifyComment(llm, {
          platform: post.platform,
          commentText: raw.text,
          authorName: raw.authorName,
          postCaption: post.caption,
        });

        await updateCommentClassification(ctx, comment.id, {
          intent: classification.intent as any,
          intentConfidence: classification.confidence,
          sentiment: classification.sentiment,
          safetyFlags: classification.safetyFlags,
        });
        classifiedCount++;
      } catch (classifyErr) {
        console.warn(`[commentSync] Classification failed for comment ${comment.id}:`, classifyErr);
      }
    }
  }

  return { syncedCount, classifiedCount };
}

/**
 * Sync comments across all recently published posts for an organization.
 */
export async function syncRecentComments(
  ctx: SessionContext
): Promise<{ totalPosts: number; syncedCount: number; classifiedCount: number }> {
  const orgId = ctx.organizationId;
  const posts = await prisma.post.findMany({
    where: {
      organizationId: orgId,
      status: "PUBLISHED",
    },
    take: 20,
    orderBy: { updatedAt: "desc" },
  });

  let totalSynced = 0;
  let totalClassified = 0;

  for (const post of posts) {
    const result = await syncCommentsForPost(ctx, post.id);
    totalSynced += result.syncedCount;
    totalClassified += result.classifiedCount;
  }

  return {
    totalPosts: posts.length,
    syncedCount: totalSynced,
    classifiedCount: totalClassified,
  };
}

/**
 * Send reply to social platform and record local comment update.
 */
export async function replyToSocialComment(
  ctx: SessionContext,
  commentId: string,
  replyText: string,
  templateId?: string
) {
  const comment = await getCommentById(ctx, commentId);
  const provider = getSocialProvider(comment.platform as any);

  if (provider.replyToComment) {
    await provider.replyToComment({
      platformCommentId: comment.platformCommentId,
      text: replyText,
    });
  }

  return recordCommentReply(ctx, comment.id, {
    templateId,
    replyText,
  });
}
