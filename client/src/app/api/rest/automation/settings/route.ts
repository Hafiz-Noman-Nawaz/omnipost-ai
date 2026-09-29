import { getSettings, updateSettings } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireApiRole("VIEWER");
    const settings = await getSettings(ctx.organizationId);
    return ok(settings);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const body = await req.json();

    const updated = await updateSettings(ctx.organizationId, {
      autoReplyMaster: body.autoReplyMaster,
      timezone: body.timezone,
    });

    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
