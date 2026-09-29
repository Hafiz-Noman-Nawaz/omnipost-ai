import { NextRequest, NextResponse } from "next/server";
import { requireApiRole, ok, fail } from "@/lib/api";
import { getAnalyticsOverview } from "@omnipost/database";

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const body = await req.json().catch(() => ({}));
    const webhookUrl = body.webhookUrl || process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "MISSING_WEBHOOK_URL",
            message: "A Slack or Discord incoming webhook URL is required to send the report.",
          },
        },
        { status: 400 }
      );
    }

    const days = typeof body.days === "number" ? body.days : 7;
    const overview = await getAnalyticsOverview(ctx, {
      timeframeDays: days,
    });

    // Format rich Slack payload
    const slackPayload = {
      text: `📊 *OmniPost Executive Social Media Digest* (Past ${days} Days)`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `📊 OmniPost Executive Digest (${days}-Day Report)`,
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Total Published:*\n${overview.totalPosts} posts`,
            },
            {
              type: "mrkdwn",
              text: `*Engagement Rate:*\n${overview.totals.overallEngagementRate.toFixed(2)}%`,
            },
            {
              type: "mrkdwn",
              text: `*Total Views:*\n${overview.totals.views.toLocaleString()}`,
            },
            {
              type: "mrkdwn",
              text: `*Total Likes & Shares:*\n${(overview.totals.likes + overview.totals.shares).toLocaleString()}`,
            },
          ],
        },
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Top Platform Performance:*\n${overview.platformBreakdown
              .map(
                (p) =>
                  `• *${p.platform}*: ${p.postsCount} posts | ${p.views.toLocaleString()} views | ${p.engagementRate.toFixed(1)}% eng.`
              )
              .join("\n") || "No platform activity in this period."}`,
          },
        },
      ],
    };

    // Send HTTP POST to webhook
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "WEBHOOK_DISPATCH_FAILED",
            message: `Webhook returned status ${resp.status}: ${errText}`,
          },
        },
        { status: 502 }
      );
    }

    return ok({
      dispatchedAt: new Date().toISOString(),
      timeframeDays: days,
      recipient: "Configured Webhook",
    });
  } catch (err: unknown) {
    return fail(err);
  }
}
