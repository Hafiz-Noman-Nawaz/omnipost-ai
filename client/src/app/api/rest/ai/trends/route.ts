import { requireApiRole, ok, fail } from "@/lib/api";
import { surfaceTrendingTopics } from "@omnipost/ai";

export async function GET() {
  try {
    await requireApiRole("VIEWER");
    const trends = surfaceTrendingTopics();
    return ok(trends);
  } catch (err: unknown) {
    return fail(err);
  }
}
