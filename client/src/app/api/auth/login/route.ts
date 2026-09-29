import { z } from "zod";
import { login, resolveSession } from "@omnipost/auth";
import { writeAudit } from "@omnipost/database";
import { AppError, defaultAuthLimiter } from "@omnipost/shared";
import { fail, ok, parseBody, setSessionCookie } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!defaultAuthLimiter.take(`login:${ip}`)) {
      throw new AppError("RATE_LIMITED", "Too many attempts. Try again shortly.");
    }

    const body = await parseBody(req, schema);
    const result = await login({ ...body, ip });
    await setSessionCookie(result.token, result.expiresAt);

    const resolved = await resolveSession(result.token);
    if (resolved) {
      await writeAudit(resolved.context.organizationId, {
        actorType: "USER",
        actorId: result.user.id,
        action: "auth.login",
        resourceType: "user",
        resourceId: result.user.id,
        metadata: { userAgent: req.headers.get("user-agent") ?? undefined },
      });
    }

    return ok({ user: result.user });
  } catch (err) {
    return fail(err);
  }
}
