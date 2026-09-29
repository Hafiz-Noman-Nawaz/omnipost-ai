import { syncPostMetrics, syncOrgMetrics } from "@omnipost/worker";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");
    let body: { postId?: string } = {};

    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    if (body.postId) {
      const res = await syncPostMetrics(ctx, body.postId);
      return ok({ synced: true, post: res });
    }

    const res = await syncOrgMetrics(ctx);
    return ok(res);
  } catch (err) {
    return fail(err);
  }
}
