import { hideComment } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const { id } = await params;
    const updated = await hideComment(ctx, id, "MANUAL");

    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
