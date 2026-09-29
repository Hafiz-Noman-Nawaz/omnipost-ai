import { listVariantsForContent } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { id } = await params;
    const variants = await listVariantsForContent(ctx.organizationId, id);
    return ok(variants);
  } catch (err) {
    return fail(err);
  }
}
