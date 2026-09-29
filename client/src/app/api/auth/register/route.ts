import { z } from "zod";
import { login, registerUser, resolveSession } from "@omnipost/auth";
import { writeAudit } from "@omnipost/database";
import { AppError, defaultAuthLimiter } from "@omnipost/shared";
import { fail, ok, parseBody, setSessionCookie } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  name: z.string().max(80).optional(),
  organizationName: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (!defaultAuthLimiter.take(`register:${ip}`)) {
      throw new AppError("RATE_LIMITED", "Too many attempts. Try again shortly.");
    }

    const body = await parseBody(req, schema);
    const { userId } = await registerUser(body);

    // Log the user straight in after registration.
    const result = await login({ email: body.email, password: body.password, ip });
    await setSessionCookie(result.token, result.expiresAt);

    // Audit is org-scoped; resolve the org from the fresh session.
    const resolved = await resolveSession(result.token);
    if (resolved) {
      await writeAudit(resolved.context.organizationId, {
        actorType: "USER",
        actorId: userId,
        action: "auth.register",
        resourceType: "user",
        resourceId: userId,
        metadata: { email: body.email },
      });
    }

    return ok({ user: result.user }, undefined, 201);
  } catch (err) {
    return fail(err);
  }
}
