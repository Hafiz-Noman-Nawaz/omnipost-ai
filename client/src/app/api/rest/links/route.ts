import { NextRequest } from "next/server";
import { requireApiRole, ok, fail } from "@/lib/api";
import { createShortLink, listShortLinks } from "@omnipost/database";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const links = await listShortLinks(ctx.organizationId);
    return ok(links);
  } catch (err: unknown) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const body = await req.json().catch(() => ({}));

    if (!body.originalUrl) {
      throw new Error("originalUrl is required to create a short link");
    }

    const link = await createShortLink({
      organizationId: ctx.organizationId,
      originalUrl: body.originalUrl,
      campaignId: body.campaignId,
      platform: body.platform,
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
      utmContent: body.utmContent,
    });

    return ok(link);
  } catch (err: unknown) {
    return fail(err);
  }
}
