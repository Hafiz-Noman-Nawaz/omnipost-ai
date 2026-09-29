import { reorderAutomationRules } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const body = await req.json();

    if (!Array.isArray(body.ruleIds)) {
      throw new Error("ruleIds array is required");
    }

    const reordered = await reorderAutomationRules(ctx, body.ruleIds);
    return ok(reordered);
  } catch (err) {
    return fail(err);
  }
}
