import { getAnalyticsOverview } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { searchParams } = new URL(req.url);

    const days = searchParams.get("days") ? parseInt(searchParams.get("days")!, 10) : 30;
    const platform = searchParams.get("platform") || undefined;
    const campaignId = searchParams.get("campaignId") || undefined;

    const data = await getAnalyticsOverview(ctx, {
      timeframeDays: days,
      platform,
      campaignId,
    });

    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
