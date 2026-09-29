import { fail, ok, requireApiSession } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireApiSession();
    return ok({ user: ctx.user, organizationId: ctx.organizationId });
  } catch (err) {
    return fail(err);
  }
}
