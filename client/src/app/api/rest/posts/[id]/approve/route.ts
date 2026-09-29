import { z } from "zod";
import { approvePost } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const approveSchema = z.object({
  scheduledAt: z.string().datetime().nullable().optional(),
  bypassSafetyWarnings: z.boolean().optional(),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    let body: z.infer<typeof approveSchema> = {};
    try {
      body = await parseBody(req, approveSchema);
    } catch {
      // Body is optional for direct approve
    }

    const post = await approvePost(ctx, id, {
      scheduledAt: body.scheduledAt,
      bypassSafetyWarnings: body.bypassSafetyWarnings,
    });

    return ok(post);
  } catch (err) {
    return fail(err);
  }
}
