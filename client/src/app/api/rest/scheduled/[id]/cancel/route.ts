import { cancelScheduledPost } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;

    const cancelled = await cancelScheduledPost(ctx, id);
    return ok(cancelled);
  } catch (err) {
    return fail(err);
  }
}
