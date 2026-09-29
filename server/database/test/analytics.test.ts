import { describe, it, expect, beforeAll } from "vitest";
import {
  prisma,
  recordPostMetric,
  getAnalyticsOverview,
  getCampaignRollup,
  getPostAnalytics,
  type SessionContext,
} from "../src";

describe("Phase 11 Honest Metrics & Analytics", () => {
  let mockContext: SessionContext;
  let testCampaignId: string;
  let testPostId: string;

  beforeAll(async () => {
    let org = await prisma.organization.findFirst();
    if (!org) {
      org = await prisma.organization.create({
        data: { name: "Analytics Test Org", slug: `test-org-analytics-${Date.now()}` },
      });
    }

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `analytics-tester-${Date.now()}@example.com`,
          passwordHash: "dummyhash",
          name: "Analytics Tester",
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
      user: { id: user.id, email: user.email, role: "ADMIN", name: "Analytics Tester" },
      organizationId: org.id,
    };

    // Create a test campaign
    const campaign = await prisma.campaign.create({
      data: {
        organizationId: org.id,
        name: "Q4 Growth Campaign",
        objective: "Boost brand awareness and community engagement",
        status: "ACTIVE",
      },
    });
    testCampaignId = campaign.id;

    // Create a test content and post
    const content = await prisma.content.create({
      data: {
        organizationId: org.id,
        createdById: user.id,
        campaignId: campaign.id,
        title: "OmniPost Launch Post",
        type: "TEXT",
      },
    });

    const post = await prisma.post.create({
      data: {
        organizationId: org.id,
        contentId: content.id,
        campaignId: campaign.id,
        platform: "INSTAGRAM",
        caption: "Excited to launch our revolutionary social automation platform! #buildinpublic",
        status: "PUBLISHED",
      },
    });
    testPostId = post.id;
  });

  it("records post metric snapshot with honest values", async () => {
    const metric = await recordPostMetric(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      views: 1540,
      likes: 120,
      commentsCount: 18,
      shares: 12,
      clicks: null, // Instagram API does not track clicks
      source: "API",
    });

    expect(metric.id).toBeDefined();
    expect(metric.postId).toBe(testPostId);
    expect(metric.views).toBe(1540);
    expect(metric.likes).toBe(120);
    expect(metric.commentsCount).toBe(18);
    expect(metric.shares).toBe(12);
    expect(metric.clicks).toBeNull();
  });

  it("fetches analytics overview with honest platform capability matrix", async () => {
    const overview = await getAnalyticsOverview(mockContext, { timeframeDays: 30 });

    expect(overview.totalPosts).toBeGreaterThanOrEqual(1);
    expect(overview.totals.views).toBeGreaterThanOrEqual(1540);
    expect(overview.totals.likes).toBeGreaterThanOrEqual(120);
    expect(overview.totals.comments).toBeGreaterThanOrEqual(18);
    expect(overview.totals.overallEngagementRate).toBeGreaterThan(0);

    // Verify Honest Platform Matrix
    const instagramBreakdown = overview.platformBreakdown.find((p) => p.platform === "INSTAGRAM");
    expect(instagramBreakdown).toBeDefined();
    expect(instagramBreakdown?.supportedMetrics.available).toContain("likes");
    expect(instagramBreakdown?.supportedMetrics.available).toContain("views");
    expect(instagramBreakdown?.supportedMetrics.unavailable).toContain("clicks");

    // Verify time series
    expect(overview.timeSeries.length).toBe(30);

    // Verify top posts
    expect(overview.topPosts.length).toBeGreaterThanOrEqual(1);
    const top = overview.topPosts[0];
    expect(top.metrics.views).toBeGreaterThanOrEqual(1540);
  });

  it("aggregates campaign rollup accurately", async () => {
    const rollup = await getCampaignRollup(mockContext, testCampaignId);

    expect(rollup.campaign.id).toBe(testCampaignId);
    expect(rollup.campaign.name).toBe("Q4 Growth Campaign");
    expect(rollup.totalPosts).toBeGreaterThanOrEqual(1);
    expect(rollup.totals.views).toBeGreaterThanOrEqual(1540);
    expect(rollup.totals.likes).toBeGreaterThanOrEqual(120);
    expect(rollup.platforms.length).toBeGreaterThanOrEqual(1);
    expect(rollup.platforms[0].platform).toBe("INSTAGRAM");
  });

  it("retrieves detailed single post analytics history", async () => {
    // Record a second metric snapshot to simulate timeline progression
    await recordPostMetric(mockContext, {
      postId: testPostId,
      platform: "INSTAGRAM",
      views: 2100,
      likes: 185,
      commentsCount: 25,
      shares: 16,
      clicks: null,
      source: "API",
    });

    const postAnalytics = await getPostAnalytics(mockContext, testPostId);

    expect(postAnalytics.post.id).toBe(testPostId);
    expect(postAnalytics.support.available).toContain("likes");
    expect(postAnalytics.support.unavailable).toContain("clicks");
    expect(postAnalytics.latestMetrics?.views).toBe(2100);
    expect(postAnalytics.latestMetrics?.likes).toBe(185);
    expect(postAnalytics.history.length).toBeGreaterThanOrEqual(2);
  });
});
