import { z } from "zod";
import { schedulePost } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const scheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
  timezone: z.string().optional(),
  socialAccountId: z.string().nullable().optional(),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    const body = await parseBody(req, scheduleSchema);

    const scheduled = await schedulePost(ctx, {
      postId: id,
      scheduledAt: body.scheduledAt,
      timezone: body.timezone,
      socialAccountId: body.socialAccountId,
    });

    return ok(scheduled, undefined, 201);
  } catch (err) {
    return fail(err);
  }
}
