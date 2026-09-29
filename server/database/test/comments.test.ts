import { describe, it, expect, beforeAll } from "vitest";
import {
  prisma,
  upsertComment,
  listComments,
  getCommentById,
  updateCommentClassification,
  escalateComment,
  hideComment,
  recordCommentReply,
  getCommentsSummary,
  CommentIntent,
  CommentStatus,
  type SessionContext,
} from "../src";

describe("Phase 9 Comments Ingestion, AI Classification, & Moderation", () => {
  let mockContext: SessionContext;
  let testPostId: string;

  beforeAll(async () => {
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: { name: "Test Org Comments", slug: `test-org-comments-${Date.now()}` },
      });
    }

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `comments-tester-${Date.now()}@example.com`,
          passwordHash: "dummyhash",
          name: "Comments Tester",
        },
      });
      await prisma.membership.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "ADMIN",
        },
      });
    }

    mockContext = {
      user: { id: user.id, email: user.email, role: "ADMIN", name: "Comments Tester" },
      organizationId: org.id,
    };

    // Ensure we have a published test post to attach comments to
    let content = await prisma.content.findFirst({
      where: { organizationId: org.id },
    });
    if (!content) {
      content = await prisma.content.create({
        data: {
          organizationId: org.id,
          title: "Product Launch Announcement",
          type: "IMAGE",
          status: "PUBLISHED",
        },
      });
    }

    const post = await prisma.post.create({
      data: {
        organizationId: org.id,
        contentId: content.id,
        platform: "INSTAGRAM",
        caption: "Introducing the new workspace organizer! 🚀",
        status: "PUBLISHED",
      },
    });
    testPostId = post.id;
  });

  it("should upsert incoming comments idempotently and create conversation threads", async () => {
    const comment1 = await upsertComment(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      platformCommentId: `c_root_${Date.now()}`,
      authorName: "alex_traveler",
      authorId: "user_101",
      text: "Is worldwide shipping available for this?",
      postedAt: new Date(),
    });

    expect(comment1).toBeDefined();
    expect(comment1.id).toBeTruthy();
    expect(comment1.status).toBe(CommentStatus.NEW);
    expect(comment1.threadId).toBeTruthy();

    // Re-upsert with same ID should be idempotent
    const duplicate = await upsertComment(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      platformCommentId: comment1.platformCommentId,
      authorName: "alex_traveler",
      authorId: "user_101",
      text: "Is worldwide shipping available for this? (edited)",
      postedAt: new Date(),
    });

    expect(duplicate.id).toBe(comment1.id);
    expect(duplicate.text).toContain("(edited)");

    // Upsert threaded reply
    const replyComment = await upsertComment(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      platformCommentId: `c_reply_${Date.now()}`,
      parentPlatformCommentId: comment1.platformCommentId,
      authorName: "sam_buyer",
      text: "I want to know about shipping too!",
      postedAt: new Date(),
    });

    expect(replyComment.threadId).toBe(comment1.threadId);
  });

  it("should record AI classification and auto-escalate abuse/spam comments", async () => {
    const questionComment = await upsertComment(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      platformCommentId: `c_question_${Date.now()}`,
      authorName: "dev_customer",
      text: "What are the dimensions of this organizer?",
    });

    const classified = await updateCommentClassification(mockContext, questionComment.id, {
      intent: CommentIntent.QUESTION,
      intentConfidence: 0.96,
      sentiment: "NEUTRAL",
    });

    expect(classified.status).toBe(CommentStatus.CLASSIFIED);
    expect(classified.intent).toBe(CommentIntent.QUESTION);
    expect(classified.intentConfidence).toBe(0.96);

    // Spam comment auto-escalation
    const spamComment = await upsertComment(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      platformCommentId: `c_spam_${Date.now()}`,
      authorName: "crypto_bot",
      text: "DM for free bitcoin 100% guarantee!",
    });

    const escalatedSpam = await updateCommentClassification(mockContext, spamComment.id, {
      intent: CommentIntent.SPAM,
      intentConfidence: 0.99,
      sentiment: "NEGATIVE",
      safetyFlags: ["spam_detected"],
    });

    expect(escalatedSpam.status).toBe(CommentStatus.ESCALATED);
    expect(escalatedSpam.escalatedAt).toBeDefined();

    // Check thread was marked as requiring human review
    const detail = await getCommentById(mockContext, spamComment.id);
    expect(detail.thread?.requiresHuman).toBe(true);
  });

  it("should manually escalate a comment and audit the action", async () => {
    const comment = await upsertComment(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      platformCommentId: `c_manual_${Date.now()}`,
      authorName: "frustrated_user",
      text: "Package arrived damaged, need support right away.",
    });

    const escalated = await escalateComment(mockContext, comment.id, "Urgent support inquiry");
    expect(escalated.status).toBe(CommentStatus.ESCALATED);
    expect(escalated.escalatedAt).toBeDefined();

    const detail = await getCommentById(mockContext, comment.id);
    expect(detail.thread?.requiresHuman).toBe(true);
  });

  it("should hide a comment and mark hiddenBy", async () => {
    const comment = await upsertComment(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      platformCommentId: `c_hide_${Date.now()}`,
      authorName: "troll_user",
      text: "Disgusting trash product",
    });

    const hidden = await hideComment(mockContext, comment.id, "MANUAL");
    expect(hidden.hidden).toBe(true);
    expect(hidden.hiddenBy).toBe("MANUAL");
  });

  it("should record replies, transition status to HANDLED, and resolve thread", async () => {
    const comment = await upsertComment(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      platformCommentId: `c_to_reply_${Date.now()}`,
      authorName: "curious_shopper",
      text: "Do you have promo codes for first-time buyers?",
    });

    const replied = await recordCommentReply(mockContext, comment.id, {
      replyText: "Hi! Use code WELCOME10 for 10% off your first order.",
    });

    expect(replied.status).toBe(CommentStatus.HANDLED);
    expect(replied.repliedAt).toBeDefined();

    const detail = await getCommentById(mockContext, comment.id);
    expect(detail.thread?.requiresHuman).toBe(false);
    expect(detail.thread?.status).toBe("resolved");
  });

  it("should list comments with filtering and compute summary counts", async () => {
    const list = await listComments(mockContext, { limit: 10 });
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.total).toBeGreaterThanOrEqual(list.items.length);

    const summary = await getCommentsSummary(mockContext);
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.statusCounts).toBeDefined();
    expect(summary.intentCounts).toBeDefined();
  });
});
