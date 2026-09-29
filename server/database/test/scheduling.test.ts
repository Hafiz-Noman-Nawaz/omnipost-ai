import { describe, it, expect, beforeAll } from "vitest";
import {
  prisma,
  createPost,
  approvePost,
  schedulePost,
  reschedulePost,
  cancelScheduledPost,
  retryScheduledPost,
  listScheduledPosts,
  getScheduledPost,
  type SessionContext,
} from "../src";
import { processScheduledJob } from "../../worker/src/dispatcher";

describe("Phase 6 Scheduling & Worker Publishing", () => {
  let mockContext: SessionContext;
  let testContentId: string;
  let testCampaignId: string;

  beforeAll(async () => {
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: { name: "Test Org Scheduling", slug: `test-org-sched-${Date.now()}` },
      });
    }

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `sched-tester-${Date.now()}@example.com`,
          passwordHash: "dummyhash",
          name: "Schedule Tester",
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
      user: { id: user.id, email: user.email, role: "ADMIN", name: "Schedule Tester" },
      organizationId: org.id,
    };

    const campaign = await prisma.campaign.create({
      data: {
        organizationId: org.id,
        name: "Spring Launch Campaign",
        status: "ACTIVE",
        platforms: ["LINKEDIN", "X"],
      },
    });
    testCampaignId = campaign.id;

    const content = await prisma.content.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        type: "TEXT",
        title: "Scheduled Social Update",
        text: "Preview text for scheduled dispatching",
        tags: ["scheduled", "social"],
      },
    });
    testContentId = content.id;
  });

  it("should fail to schedule a post that has not been approved", async () => {
    const post = await createPost(mockContext, {
      contentId: testContentId,
      platform: "LINKEDIN",
      caption: "Unapproved post caption",
    });

    const scheduledAt = new Date(Date.now() + 3600 * 1000).toISOString();

    await expect(
      schedulePost(mockContext, {
        postId: post.id,
        scheduledAt,
        timezone: "America/New_York",
      }),
    ).rejects.toThrow("Cannot schedule post with status AWAITING_APPROVAL");
  });

  it("should schedule an approved post with timezone normalization and unique idempotency key", async () => {
    const post = await createPost(mockContext, {
      contentId: testContentId,
      campaignId: testCampaignId,
      platform: "LINKEDIN",
      caption: "Approved post ready for scheduling",
    });

    await approvePost(mockContext, post.id);

    const scheduledAt = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    const scheduled = await schedulePost(mockContext, {
      postId: post.id,
      scheduledAt,
      timezone: "America/New_York",
    });

    expect(scheduled.id).toBeDefined();
    expect(scheduled.status).toBe("QUEUED");
    expect(scheduled.timezone).toBe("America/New_York");
    expect(scheduled.idempotencyKey).toContain(`sched_${post.id}_`);
    expect(scheduled.post.status).toBe("SCHEDULED");
  });

  it("should reschedule an existing pending post", async () => {
    const post = await createPost(mockContext, {
      contentId: testContentId,
      platform: "X",
      caption: "Post for rescheduling test",
    });
    await approvePost(mockContext, post.id);

    const scheduled = await schedulePost(mockContext, {
      postId: post.id,
      scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      timezone: "UTC",
    });

    const newTime = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const updated = await reschedulePost(mockContext, scheduled.id, {
      scheduledAt: newTime,
      timezone: "America/Los_Angeles",
    });

    expect(updated.timezone).toBe("America/Los_Angeles");
    expect(new Date(updated.scheduledAt).getTime()).toBe(new Date(newTime).getTime());
  });

  it("should cancel a scheduled post and return post status to APPROVED", async () => {
    const post = await createPost(mockContext, {
      contentId: testContentId,
      platform: "X",
      caption: "Post for cancellation test",
    });
    await approvePost(mockContext, post.id);

    const scheduled = await schedulePost(mockContext, {
      postId: post.id,
      scheduledAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    const cancelled = await cancelScheduledPost(mockContext, scheduled.id);
    expect(cancelled.status).toBe("CANCELLED");

    const refreshedPost = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(refreshedPost.status).toBe("APPROVED");
  });

  it("should process a scheduled job cleanly through the worker dispatcher", async () => {
    const post = await createPost(mockContext, {
      contentId: testContentId,
      platform: "LINKEDIN",
      caption: "Live worker dispatch test",
    });
    await approvePost(mockContext, post.id);

    const scheduled = await schedulePost(mockContext, {
      postId: post.id,
      scheduledAt: new Date(Date.now() - 1000).toISOString(), // Due now
    });

    const success = await processScheduledJob(scheduled.id);
    expect(success).toBe(true);

    const refreshed = await prisma.scheduledPost.findUniqueOrThrow({
      where: { id: scheduled.id },
      include: { attemptsLog: true, post: true },
    });

    expect(refreshed.status).toBe("PUBLISHED");
    expect(refreshed.publishedAt).toBeDefined();
    expect(refreshed.attemptsLog.length).toBe(1);
    expect(refreshed.attemptsLog[0].ok).toBe(true);
    expect(refreshed.platformPostId).toMatch(/^(linkedin_pub_|urn:li:share:)/);
    expect(refreshed.post.status).toBe("PUBLISHED");
  });

  it("should handle publishing errors with backoff retry tracking", async () => {
    const post = await createPost(mockContext, {
      contentId: testContentId,
      platform: "X",
      caption: "Failing test post [SIMULATE_FAILURE]",
    });
    await approvePost(mockContext, post.id);

    const scheduled = await schedulePost(mockContext, {
      postId: post.id,
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
    });

    const result = await processScheduledJob(scheduled.id);
    expect(result).toBe(false);

    const refreshed = await prisma.scheduledPost.findUniqueOrThrow({
      where: { id: scheduled.id },
      include: { attemptsLog: true },
    });

    expect(refreshed.status).toBe("RETRYING");
    expect(refreshed.attempts).toBe(1);
    expect(JSON.stringify(refreshed.error)).toContain("rate limit exceeded");
    expect(refreshed.attemptsLog.length).toBe(1);
    expect(refreshed.attemptsLog[0].ok).toBe(false);
  });

  it("should allow manual retry of a failed or retrying post", async () => {
    const post = await createPost(mockContext, {
      contentId: testContentId,
      platform: "X",
      caption: "Retry test post [SIMULATE_FAILURE]",
    });
    await approvePost(mockContext, post.id);

    const scheduled = await schedulePost(mockContext, {
      postId: post.id,
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
    });

    await processScheduledJob(scheduled.id);

    const retried = await retryScheduledPost(mockContext, scheduled.id);
    expect(retried.status).toBe("QUEUED");
    expect(new Date(retried.scheduledAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
