import { getCommentById } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { id } = await params;
    const comment = await getCommentById(ctx, id);

    return ok(comment);
  } catch (err) {
    return fail(err);
  }
}
