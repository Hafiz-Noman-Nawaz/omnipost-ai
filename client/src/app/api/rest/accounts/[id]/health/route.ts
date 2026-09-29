import { testAccountHealth } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { id } = await params;
    const health = await testAccountHealth(ctx, id);

    return ok(health);
  } catch (err) {
    return fail(err);
  }
}
