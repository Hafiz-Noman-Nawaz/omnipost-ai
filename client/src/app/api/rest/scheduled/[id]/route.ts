import { z } from "zod";
import { getScheduledPost, reschedulePost } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchScheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
  timezone: z.string().optional(),
});

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("VIEWER");
    const { id } = await params;
    const item = await getScheduledPost(ctx, id);
    return ok(item);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    const body = await parseBody(req, patchScheduleSchema);

    const updated = await reschedulePost(ctx, id, {
      scheduledAt: body.scheduledAt,
      timezone: body.timezone,
    });

    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
