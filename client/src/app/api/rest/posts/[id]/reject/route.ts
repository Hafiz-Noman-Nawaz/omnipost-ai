import { z } from "zod";
import { rejectPost } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const rejectSchema = z.object({
  reason: z.string().optional(),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    let reason: string | undefined;

    try {
      const body = await parseBody(req, rejectSchema);
      reason = body.reason;
    } catch {
      // Reason is optional
    }

    const post = await rejectPost(ctx, id, reason);
    return ok(post);
  } catch (err) {
    return fail(err);
  }
}
