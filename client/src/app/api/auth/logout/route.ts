import { logout, resolveSession } from "@omnipost/auth";
import { writeAudit } from "@omnipost/database";
import { fail, ok, SESSION_COOKIE, clearSessionCookie } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export async function POST() {
  try {
    const token = await getSessionToken();
    const resolved = await resolveSession(token);
    if (token) await logout(token);
    await clearSessionCookie();

    if (resolved) {
      await writeAudit(resolved.context.organizationId, {
        actorType: "USER",
        actorId: resolved.context.user.id,
        action: "auth.logout",
        resourceType: "user",
        resourceId: resolved.context.user.id,
      });
    }

    return ok({ success: true });
  } catch (err) {
    return fail(err);
  }
}
