import { z } from "zod";
import { regeneratePost } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const regenSchema = z.object({
  notes: z.string().optional(),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    let notes: string | undefined;

    try {
      const body = await parseBody(req, regenSchema);
      notes = body.notes;
    } catch {
      // Notes are optional
    }

    const post = await regeneratePost(ctx, id, notes);
    return ok(post);
  } catch (err) {
    return fail(err);
  }
}
