import { listApprovalQueue } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const url = new URL(req.url);

    const platform = url.searchParams.get("platform") ?? undefined;
    const campaignId = url.searchParams.get("campaignId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;

    const data = await listApprovalQueue(ctx, {
      platform,
      campaignId,
      status,
      search,
    });

    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
