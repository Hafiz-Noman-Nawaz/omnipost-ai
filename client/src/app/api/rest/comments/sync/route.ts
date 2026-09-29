import { syncRecentComments } from "@omnipost/worker";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const ctx = await requireApiRole("EDITOR");
    const result = await syncRecentComments(ctx);

    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
