import { listAuditLogs } from "@omnipost/database";
import { fail, ok, requireApiRole } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await requireApiRole("ADMIN");
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") ?? "1") || 1;
    const pageSize = Number(url.searchParams.get("pageSize") ?? "25") || 25;
    const actorType = url.searchParams.get("actorType") ?? undefined;
    const action = url.searchParams.get("action") ?? undefined;
    const resourceType = url.searchParams.get("resourceType") ?? undefined;

    const result = await listAuditLogs(ctx.organizationId, {
      page,
      pageSize,
      actorType: actorType || undefined,
      action: action || undefined,
      resourceType: resourceType || undefined,
    });

    return ok(result.data, result.meta);
  } catch (err) {
    return fail(err);
  }
}
