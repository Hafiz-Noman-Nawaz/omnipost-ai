import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/api";
import { getAnalyticsOverview } from "@omnipost/database";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    const platform = searchParams.get("platform") || undefined;

    const overview = await getAnalyticsOverview(ctx, {
      timeframeDays: days,
      platform,
    });

    // Generate CSV string
    const csvRows: string[] = [];

    // Header 1: Executive Totals
    csvRows.push("--- EXECUTIVE SUMMARY ---");
    csvRows.push("Timeframe (Days),Total Posts,Total Views,Total Likes,Total Comments,Total Shares,Total Clicks,Overall Engagement Rate (%)");
    csvRows.push(
      [
        overview.timeframeDays,
        overview.totalPosts,
        overview.totals.views,
        overview.totals.likes,
        overview.totals.comments,
        overview.totals.shares,
        overview.totals.clicks,
        overview.totals.overallEngagementRate.toFixed(2),
      ].join(",")
    );

    csvRows.push("");
    // Header 2: Platform Breakdown
    csvRows.push("--- PLATFORM BREAKDOWN ---");
    csvRows.push("Platform,Posts Count,Views,Likes,Comments,Shares,Clicks,Engagement Rate (%)");
    for (const p of overview.platformBreakdown) {
      csvRows.push(
        [
          p.platform,
          p.postsCount,
          p.views,
          p.likes,
          p.comments,
          p.shares,
          p.clicks,
          p.engagementRate.toFixed(2),
        ].join(",")
      );
    }

    csvRows.push("");
    // Header 3: Top Posts
    csvRows.push("--- TOP POST PERFORMANCE ---");
    csvRows.push("Post ID,Platform,Published Date,Campaign,Caption Snippet,Views,Likes,Comments,Shares,Clicks");
    for (const post of overview.topPosts) {
      const cleanCaption = `"${(post.caption || "").replace(/"/g, '""').slice(0, 100)}"`;
      const campaign = `"${(post.campaignName || "None").replace(/"/g, '""')}"`;
      csvRows.push(
        [
          post.id,
          post.platform,
          post.publishedAt || "N/A",
          campaign,
          cleanCaption,
          post.metrics.views,
          post.metrics.likes,
          post.metrics.comments,
          post.metrics.shares,
          post.metrics.clicks,
        ].join(",")
      );
    }

    const csvContent = csvRows.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="omnipost-analytics-${days}d-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to export analytics CSV";
    return NextResponse.json(
      { ok: false, error: { code: "EXPORT_FAILED", message } },
      { status: 500 }
    );
  }
}
