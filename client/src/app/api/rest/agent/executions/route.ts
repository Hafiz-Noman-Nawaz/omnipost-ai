import { listAgentExecutions } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { searchParams } = new URL(req.url);

    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;
    const status = searchParams.get("status") || undefined;

    const data = await listAgentExecutions(ctx, { limit, offset, status });
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
