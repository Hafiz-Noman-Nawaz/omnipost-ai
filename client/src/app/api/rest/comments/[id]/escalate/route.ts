import { escalateComment } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    let reason = "Manual escalation by operator";
    try {
      const body = await req.json();
      if (body.reason) reason = body.reason;
    } catch {
      // Body is optional
    }

    const updated = await escalateComment(ctx, id, reason);
    return ok(updated);
  } catch (err) {
    return fail(err);
  }
}
