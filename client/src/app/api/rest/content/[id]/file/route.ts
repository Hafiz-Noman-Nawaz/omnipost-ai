import { getContentById } from "@omnipost/database";
import { notFound } from "@omnipost/shared";
import { fail, requireApiSession } from "@/lib/api";
import { storage } from "@/lib/media";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Authorized media streaming: file bytes never sit on a public path — every
 * request passes session + org-scope checks here (docs/05 §1.3).
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireApiSession();
    const { id } = await params;

    const item = await getContentById(ctx.organizationId, id);
    if (!item?.storageKey) throw notFound("Content file");

    const stat = await storage.stat(item.storageKey);
    if (!stat.exists) throw notFound("Content file");

    const stream = await storage.get(item.storageKey);
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": item.mimeType ?? "application/octet-stream",
        ...(stat.size !== undefined ? { "Content-Length": String(stat.size) } : {}),
        "Content-Disposition": `inline; filename="${encodeURIComponent(item.originalFilename ?? "file")}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return fail(err);
  }
}
