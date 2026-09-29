import { prisma } from "../client";
import { AppError, PLATFORM_METRICS_SUPPORT, PlatformKey } from "@omnipost/shared";
import type { SessionContext } from "./session-context";

function getOrgId(ctx: SessionContext): string {
  const id =
    ctx.organizationId ??
    (ctx as unknown as { organization?: { id: string } }).organization?.id;
  if (!id) {
    throw new AppError("UNAUTHENTICATED", "Missing organization context for analytics operation");
  }
  return id;
}

export interface RecordPostMetricInput {
  postId: string;
  platform: string;
  likes?: number | null;
  commentsCount?: number | null;
  shares?: number | null;
  views?: number | null;
  clicks?: number | null;
  source?: string | null;
  capturedAt?: Date;
}

export interface AnalyticsFilter {
  timeframeDays?: number;
  campaignId?: string;
  platform?: string;
}

export interface PlatformMetricAggregate {
  platform: string;
  postsCount: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagementRate: number;
  supportedMetrics: {
    available: string[];
    unavailable: string[];
    notes: string;
  };
}

export interface DailyDataPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
}

export interface AnalyticsOverviewResult {
  timeframeDays: number;
  totalPosts: number;
  totals: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    overallEngagementRate: number;
  };
  platformBreakdown: PlatformMetricAggregate[];
  timeSeries: DailyDataPoint[];
  topPosts: Array<{
    id: string;
    caption: string;
    platform: string;
    publishedAt: Date | null;
    campaignName?: string | null;
    metrics: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
      clicks: number;
    };
  }>;
}

/**
 * Record a metric snapshot for a post.
 */
export async function recordPostMetric(ctx: SessionContext, input: RecordPostMetricInput) {
  const orgId = getOrgId(ctx);

  const post = await prisma.post.findFirst({
    where: { id: input.postId, organizationId: orgId },
  });

  if (!post) {
    throw new AppError("NOT_FOUND", `Post ${input.postId} not found in this organization`);
  }

  const metric = await prisma.postMetric.create({
    data: {
      postId: input.postId,
      platform: input.platform || post.platform,
      likes: input.likes ?? null,
      commentsCount: input.commentsCount ?? null,
      shares: input.shares ?? null,
      views: input.views ?? null,
      clicks: input.clicks ?? null,
      source: input.source || "API",
      capturedAt: input.capturedAt || new Date(),
    },
  });

  return metric;
}

/**
 * Fetch organization-wide analytics overview.
 */
export async function getAnalyticsOverview(
  ctx: SessionContext,
  filter?: AnalyticsFilter
): Promise<AnalyticsOverviewResult> {
  const orgId = getOrgId(ctx);
  const days = filter?.timeframeDays ?? 30;
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const wherePost: any = {
    organizationId: orgId,
    createdAt: { gte: since },
  };

  if (filter?.platform) {
    wherePost.platform = filter.platform;
  }
  if (filter?.campaignId) {
    wherePost.campaignId = filter.campaignId;
  }

  const posts = await prisma.post.findMany({
    where: wherePost,
    include: {
      metrics: {
        orderBy: { capturedAt: "desc" },
        take: 1,
      },
      content: {
        include: { campaign: true },
      },
      scheduled: {
        where: { status: "PUBLISHED" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalClicks = 0;

  const platformMap = new Map<string, {
    postsCount: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
  }>();

  const topPostsList: AnalyticsOverviewResult["topPosts"] = [];

  for (const post of posts) {
    const latest = post.metrics[0];
    const views = latest?.views ?? 0;
    const likes = latest?.likes ?? 0;
    const comments = latest?.commentsCount ?? 0;
    const shares = latest?.shares ?? 0;
    const clicks = latest?.clicks ?? 0;

    totalViews += views;
    totalLikes += likes;
    totalComments += comments;
    totalShares += shares;
    totalClicks += clicks;

    const plat = post.platform.toUpperCase();
    const curr = platformMap.get(plat) ?? {
      postsCount: 0,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
    };

    curr.postsCount += 1;
    curr.views += views;
    curr.likes += likes;
    curr.comments += comments;
    curr.shares += shares;
    curr.clicks += clicks;
    platformMap.set(plat, curr);

    topPostsList.push({
      id: post.id,
      caption: post.caption,
      platform: post.platform,
      publishedAt: post.scheduled[0]?.publishedAt ?? post.createdAt,
      campaignName: post.content?.campaign?.name ?? null,
      metrics: { views, likes, comments, shares, clicks },
    });
  }

  // Sort top posts by views + likes
  topPostsList.sort((a, b) => (b.metrics.views + b.metrics.likes * 2) - (a.metrics.views + a.metrics.likes * 2));

  // Build platform aggregates with honest capabilities
  const platformBreakdown: PlatformMetricAggregate[] = [];
  const knownPlatforms: PlatformKey[] = ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "X", "YOUTUBE"];

  for (const plat of knownPlatforms) {
    const data = platformMap.get(plat);
    const support = PLATFORM_METRICS_SUPPORT[plat];
    if (data || !filter?.platform) {
      const postsCount = data?.postsCount ?? 0;
      const views = data?.views ?? 0;
      const likes = data?.likes ?? 0;
      const comments = data?.comments ?? 0;
      const shares = data?.shares ?? 0;
      const clicks = data?.clicks ?? 0;
      const eng = views > 0 ? Number((((likes + comments + shares) / views) * 100).toFixed(2)) : 0;

      platformBreakdown.push({
        platform: plat,
        postsCount,
        views,
        likes,
        comments,
        shares,
        clicks,
        engagementRate: eng,
        supportedMetrics: {
          available: support.available,
          unavailable: support.unavailable,
          notes: support.notes,
        },
      });
    }
  }

  // Generate continuous timeSeries data points
  const timeSeriesMap = new Map<string, DailyDataPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000);
    const dateStr = d.toISOString().split("T")[0]!;
    timeSeriesMap.set(dateStr, {
      date: dateStr,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
    });
  }

  for (const post of posts) {
    const dateStr = post.createdAt.toISOString().split("T")[0]!;
    const point = timeSeriesMap.get(dateStr);
    if (point && post.metrics[0]) {
      const m = post.metrics[0];
      point.views += m.views ?? 0;
      point.likes += m.likes ?? 0;
      point.comments += m.commentsCount ?? 0;
      point.shares += m.shares ?? 0;
      point.clicks += m.clicks ?? 0;
    }
  }

  const timeSeries = Array.from(timeSeriesMap.values());
  const overallEngagement =
    totalViews > 0
      ? Number((((totalLikes + totalComments + totalShares) / totalViews) * 100).toFixed(2))
      : 0;

  return {
    timeframeDays: days,
    totalPosts: posts.length,
    totals: {
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      clicks: totalClicks,
      overallEngagementRate: overallEngagement,
    },
    platformBreakdown,
    timeSeries,
    topPosts: topPostsList.slice(0, 10),
  };
}

/**
 * Fetch aggregated metrics for a specific campaign.
 */
export async function getCampaignRollup(ctx: SessionContext, campaignId: string) {
  const orgId = getOrgId(ctx);

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId: orgId },
  });

  if (!campaign) {
    throw new AppError("NOT_FOUND", `Campaign ${campaignId} not found`);
  }

  // Posts can be linked directly or via Content
  const posts = await prisma.post.findMany({
    where: {
      organizationId: orgId,
      OR: [
        { campaignId },
        { content: { campaignId } },
      ],
    },
    include: {
      metrics: {
        orderBy: { capturedAt: "desc" },
        take: 1,
      },
    },
  });

  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalClicks = 0;

  const platformMap = new Map<string, { views: number; likes: number; comments: number; shares: number; clicks: number; count: number }>();

  for (const post of posts) {
    const m = post.metrics[0];
    const views = m?.views ?? 0;
    const likes = m?.likes ?? 0;
    const comments = m?.commentsCount ?? 0;
    const shares = m?.shares ?? 0;
    const clicks = m?.clicks ?? 0;

    totalViews += views;
    totalLikes += likes;
    totalComments += comments;
    totalShares += shares;
    totalClicks += clicks;

    const plat = post.platform.toUpperCase();
    const curr = platformMap.get(plat) ?? { views: 0, likes: 0, comments: 0, shares: 0, clicks: 0, count: 0 };
    curr.views += views;
    curr.likes += likes;
    curr.comments += comments;
    curr.shares += shares;
    curr.clicks += clicks;
    curr.count += 1;
    platformMap.set(plat, curr);
  }

  const platforms = Array.from(platformMap.entries()).map(([plat, stats]) => ({
    platform: plat,
    ...stats,
    supportedMetrics: PLATFORM_METRICS_SUPPORT[plat as PlatformKey] || {
      available: [],
      unavailable: [],
      notes: "",
    },
  }));

  const engagementRate = totalViews > 0 ? Number((((totalLikes + totalComments + totalShares) / totalViews) * 100).toFixed(2)) : 0;

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      targetAudience: campaign.targetAudience,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
    },
    totalPosts: posts.length,
    totals: {
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      shares: totalShares,
      clicks: totalClicks,
      engagementRate,
    },
    platforms,
  };
}

/**
 * Fetch detailed metrics history for a single post.
 */
export async function getPostAnalytics(ctx: SessionContext, postId: string) {
  const orgId = getOrgId(ctx);

  const post = await prisma.post.findFirst({
    where: { id: postId, organizationId: orgId },
    include: {
      content: { include: { campaign: true } },
      scheduled: { take: 1, orderBy: { createdAt: "desc" } },
      metrics: { orderBy: { capturedAt: "asc" } },
    },
  });

  if (!post) {
    throw new AppError("NOT_FOUND", `Post ${postId} not found`);
  }

  const platformKey = post.platform.toUpperCase() as PlatformKey;
  const support = PLATFORM_METRICS_SUPPORT[platformKey] ?? {
    available: [],
    unavailable: [],
    notes: "",
  };

  const latest = post.metrics.length > 0 ? post.metrics[post.metrics.length - 1] : null;

  return {
    post: {
      id: post.id,
      platform: post.platform,
      caption: post.caption,
      status: post.status,
      createdAt: post.createdAt,
      campaignName: post.content?.campaign?.name ?? null,
      publishedAt: post.scheduled[0]?.publishedAt ?? null,
      platformPostId: post.scheduled[0]?.platformPostId ?? null,
    },
    support,
    latestMetrics: latest ? {
      views: latest.views,
      likes: latest.likes,
      comments: latest.commentsCount,
      shares: latest.shares,
      clicks: latest.clicks,
      source: latest.source,
      capturedAt: latest.capturedAt,
    } : null,
    history: post.metrics.map((m) => ({
      id: m.id,
      capturedAt: m.capturedAt,
      views: m.views,
      likes: m.likes,
      comments: m.commentsCount,
      shares: m.shares,
      clicks: m.clicks,
      source: m.source,
    })),
  };
}
