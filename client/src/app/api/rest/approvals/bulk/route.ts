import { z } from "zod";
import { bulkApprovePosts, bulkRejectPosts } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

const bulkSchema = z.object({
  action: z.enum(["approve", "reject"]),
  postIds: z.array(z.string().min(1)).min(1),
  reason: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const body = await parseBody(req, bulkSchema);

    if (body.action === "approve") {
      const res = await bulkApprovePosts(ctx, body.postIds);
      return ok(res);
    } else {
      const res = await bulkRejectPosts(ctx, body.postIds, body.reason);
      return ok(res);
    }
  } catch (err) {
    return fail(err);
  }
}
