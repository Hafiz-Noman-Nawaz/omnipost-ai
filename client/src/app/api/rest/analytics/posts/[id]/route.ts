import { getPostAnalytics } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { id } = await params;

    const data = await getPostAnalytics(ctx, id);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
