import { getAnalyticsOverview, getCampaignRollup } from "@omnipost/database";
import { selectLLMProvider, summarizeAnalytics } from "@omnipost/ai";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("VIEWER");
    let body: { question?: string; campaignId?: string; days?: number } = {};

    try {
      body = await req.json();
    } catch {
      // Body optional
    }

    const days = body.days || 30;
    const overview = await getAnalyticsOverview(ctx, {
      timeframeDays: days,
      campaignId: body.campaignId,
    });

    let campaignName: string | null = null;
    let campaignGoal: string | null = null;

    if (body.campaignId) {
      try {
        const campaign = await getCampaignRollup(ctx, body.campaignId);
        campaignName = campaign.campaign.name;
        campaignGoal = campaign.campaign.objective ?? null;
      } catch {
        // Fallback if not found
      }
    }

    const { provider: llm } = selectLLMProvider();

    const summary = await summarizeAnalytics(llm, {
      timeframe: `Past ${days} days`,
      campaignName,
      campaignGoal,
      totalPosts: overview.totalPosts,
      totals: overview.totals,
      platformBreakdown: overview.platformBreakdown.map((p) => ({
        platform: p.platform,
        views: p.views,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        clicks: p.clicks,
        postsCount: p.postsCount,
        missingMetrics: p.supportedMetrics.unavailable,
      })),
      userQuestion: body.question,
    });

    return ok({
      question: body.question || null,
      summary,
    });
  } catch (err) {
    return fail(err);
  }
}
