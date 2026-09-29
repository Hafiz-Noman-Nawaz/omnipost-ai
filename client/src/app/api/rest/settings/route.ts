import { z } from "zod";
import { getSettings, updateSettings, writeAudit } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole, requireApiSession } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireApiSession();
    const settings = await getSettings(ctx.organizationId);
    return ok(settings);
  } catch (err) {
    return fail(err);
  }
}

const patchSchema = z.object({
  timezone: z.string().min(1).max(64).optional(),
  autoReplyMaster: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const body = await parseBody(req, patchSchema);

    if (body.timezone !== undefined && !isValidIANATimezone(body.timezone)) {
      return fail(
        new (await import("@omnipost/shared")).AppError(
          "VALIDATION_ERROR",
          "Enter a valid IANA timezone, e.g. Asia/Karachi or Europe/Berlin.",
        ),
      );
    }

    const updated = await updateSettings(ctx.organizationId, body);

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: "settings.updated",
      resourceType: "settings",
      resourceId: ctx.organizationId,
      metadata: { ...body },
    });

    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}

function isValidIANATimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
