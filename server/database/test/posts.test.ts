import { describe, it, expect, beforeAll } from "vitest";
import {
  prisma,
  createPost,
  approvePost,
  rejectPost,
  duplicatePost,
  updatePost,
  bulkApprovePosts,
  bulkRejectPosts,
  listApprovalQueue,
  type SessionContext,
} from "../src";

describe("Phase 5 Approval Workflow & Post Management", () => {
  let mockContext: SessionContext;
  let testContentId: string;

  beforeAll(async () => {
    // Look up or setup test user & org from previous migrations/tests
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: { name: "Test Org", slug: `test-org-${Date.now()}` },
      });
    }

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          passwordHash: "dummyhash",
          name: "Tester",
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
      user: { id: user.id, email: user.email, role: "ADMIN", name: "Tester" },
      organizationId: org.id,
    };

    const content = await prisma.content.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        type: "TEXT",
        title: "Test Social Post",
        text: "Automated test content for post approvals",
        tags: ["test", "social"],
      },
    });
    testContentId = content.id;
  });

  it("should create a post awaiting approval", async () => {
    const post = await createPost(mockContext, {
      contentId: testContentId,
      platform: "LINKEDIN",
      caption: "Excited to share our new automation features!",
      hashtags: ["#automation", "#tech"],
      linkUrl: "https://example.com/demo",
    });

    expect(post.id).toBeDefined();
    expect(post.status).toBe("AWAITING_APPROVAL");
    expect(post.platform).toBe("LINKEDIN");
    expect(post.caption).toContain("Excited to share");
  });

  it("should edit post caption and metadata prior to approval", async () => {
    const post = await createPost(mockContext, {
      contentId: testContentId,
      platform: "X",
      caption: "Draft post needing revision",
    });

    const updated = await updatePost(mockContext, post.id, {
      caption: "Polished and ready post for X",
      hashtags: ["#launch", "#news"],
      linkUrl: "https://example.com/launch",
    });

    expect(updated.caption).toBe("Polished and ready post for X");
    expect(updated.hashtags).toContain("#launch");
    expect(updated.linkUrl).toBe("https://example.com/launch");
  });

  it("should approve a clean post", async () => {
    const post = await createPost(mockContext, {
      contentId: testContentId,
      platform: "INSTAGRAM",
      caption: "A stunning visual update for our community.",
    });

    const approved = await approvePost(mockContext, post.id);
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedById).toBe(mockContext.user.id);
    expect(approved.approvedAt).toBeInstanceOf(Date);
  });

  it("should block approval of a post with safety flags unless explicitly bypassed", async () => {
    const flaggedPost = await prisma.post.create({
      data: {
        organizationId: mockContext.organizationId,
        contentId: testContentId,
        platform: "X",
        caption: "Guaranteed 10x ROI for only $99! 100% risk-free.",
        safetyFlags: {
          ok: false,
          flags: [{ code: "BANNED_CLAIM", message: "Price and guarantee claims detected" }],
        },
        status: "AWAITING_APPROVAL",
      },
    });

    // Attempting normal approve without bypass should fail
    await expect(approvePost(mockContext, flaggedPost.id)).rejects.toThrow("safety warnings");

    // Approving with bypassSafetyWarnings should succeed
    const bypassed = await approvePost(mockContext, flaggedPost.id, { bypassSafetyWarnings: true });
    expect(bypassed.status).toBe("APPROVED");
  });

  it("should reject a post with a specified reason", async () => {
    const post = await createPost(mockContext, {
      contentId: testContentId,
      platform: "TIKTOK",
      caption: "Too casual of a caption",
    });

    const rejected = await rejectPost(mockContext, post.id, "Tone does not match brand voice guidelines");
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectedReason).toBe("Tone does not match brand voice guidelines");
  });

  it("should duplicate an existing post as a new draft", async () => {
    const post = await createPost(mockContext, {
      contentId: testContentId,
      platform: "FACEBOOK",
      caption: "Original post to duplicate",
      hashtags: ["#facebook"],
    });

    const duplicated = await duplicatePost(mockContext, post.id);
    expect(duplicated.id).not.toBe(post.id);
    expect(duplicated.status).toBe("DRAFT");
    expect(duplicated.caption).toBe(post.caption);
    expect(duplicated.platform).toBe(post.platform);
  });

  it("should bulk approve and bulk reject posts", async () => {
    const p1 = await createPost(mockContext, { contentId: testContentId, platform: "X", caption: "Bulk 1" });
    const p2 = await createPost(mockContext, { contentId: testContentId, platform: "LINKEDIN", caption: "Bulk 2" });

    const bulkApprove = await bulkApprovePosts(mockContext, [p1.id, p2.id]);
    expect(bulkApprove.approvedCount).toBe(2);

    const p3 = await createPost(mockContext, { contentId: testContentId, platform: "INSTAGRAM", caption: "Bulk 3" });
    const bulkReject = await bulkRejectPosts(mockContext, [p3.id], "Batch rejected");
    expect(bulkReject.rejectedCount).toBe(1);

    const queue = await listApprovalQueue(mockContext);
    expect(queue.summary.approved).toBeGreaterThanOrEqual(2);
    expect(queue.summary.rejected).toBeGreaterThanOrEqual(1);
  });
});
