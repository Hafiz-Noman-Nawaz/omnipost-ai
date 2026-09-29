import { z } from "zod";
import { deleteContent, getContentById, writeAudit } from "@omnipost/database";
import type { ContentStatus } from "@omnipost/database";
import { fail, ok, parseBody, requireApiRole, requireApiSession } from "@/lib/api";
import { notFound } from "@omnipost/shared";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireApiSession();
    const { id } = await params;
    const item = await getContentById(ctx.organizationId, id);
    if (!item) throw notFound("Content");
    return ok({
      ...item,
      fileUrl: item.storageKey ? `/api/rest/content/${item.id}/file` : null,
    });
  } catch (err) {
    return fail(err);
  }
}

const STATUSES: ContentStatus[] = [
  "DRAFT",
  "PROCESSING",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
  "ARCHIVED",
];

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  text: z.string().max(50_000).nullable().optional(),
  linkUrl: z.string().url().max(2000).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  campaignId: z.string().nullable().optional(),
  status: z
    .string()
    .refine((s): s is ContentStatus => STATUSES.includes(s as ContentStatus))
    .optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;
    const body = await parseBody(req, patchSchema);

    const { updateContent } = await import("@omnipost/database");
    const item = await updateContent(ctx.organizationId, id, body);

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: "content.updated",
      resourceType: "content",
      resourceId: id,
      metadata: { ...body },
    });

    return ok(item);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const { id } = await params;

    const result = await deleteContent(ctx.organizationId, id);

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: result === "deleted" ? "content.deleted" : "content.archived",
      resourceType: "content",
      resourceId: id,
    });

    return ok({ result });
  } catch (err) {
    return fail(err);
  }
}
