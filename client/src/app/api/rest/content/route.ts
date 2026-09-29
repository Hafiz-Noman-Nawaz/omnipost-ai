import { z } from "zod";
import { createContent, listContent, writeAudit } from "@omnipost/database";
import type { ContentStatus, ContentType } from "@omnipost/database";
import { validationError } from "@omnipost/shared";
import { fail, ok, parseBody, requireApiRole, requireApiSession } from "@/lib/api";

export const dynamic = "force-dynamic";

const TYPES: ContentType[] = ["IMAGE", "VIDEO", "DOCUMENT", "TEXT", "LINK"];
const STATUSES: ContentStatus[] = [
  "DRAFT",
  "PROCESSING",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
  "ARCHIVED",
];

export async function GET(req: Request) {
  try {
    const ctx = await requireApiSession();
    const url = new URL(req.url);
    const p = url.searchParams;

    const type = p.get("type");
    const status = p.get("status");

    const result = await listContent(ctx.organizationId, {
      q: p.get("q") ?? undefined,
      type: type && TYPES.includes(type as ContentType) ? (type as ContentType) : undefined,
      status:
        status && STATUSES.includes(status as ContentStatus)
          ? (status as ContentStatus)
          : undefined,
      campaignId: p.get("campaignId") ?? undefined,
      tag: p.get("tag") ?? undefined,
      page: Number(p.get("page") ?? "1") || 1,
      pageSize: Number(p.get("pageSize") ?? "24") || 24,
      sort: (p.get("sort") as "createdAt" | "title" | "sizeBytes" | null) ?? "createdAt",
      order: p.get("order") === "asc" ? "asc" : "desc",
    });

    // Present fileUrl as a route the client may call (authorized download).
    return ok(
      result.data.map((item: any) => ({
        ...item,
        fileUrl: item.storageKey ? `/api/rest/content/${item.id}/file` : null,
      })),
      result.meta,
    );
  } catch (err) {
    return fail(err);
  }
}

const createTextSchema = z.object({
  type: z.enum(["TEXT", "LINK"]),
  title: z.string().min(1).max(200),
  text: z.string().max(50_000).optional(),
  linkUrl: z.string().url().max(2000).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  campaignId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const ctx = await requireApiRole("EDITOR");
    const body = await parseBody(req, createTextSchema);

    if (body.type === "TEXT" && !body.text?.trim()) {
      throw validationError("TEXT items need a body in `text`.");
    }
    if (body.type === "LINK") {
      if (!body.linkUrl) throw validationError("LINK items need `linkUrl`.");
    }

    const item = await createContent({
      organizationId: ctx.organizationId,
      createdById: ctx.user.id,
      type: body.type,
      title: body.title,
      text: body.text ?? null,
      linkUrl: body.linkUrl ?? null,
      description: body.description ?? null,
      tags: body.tags ?? [],
      campaignId: body.campaignId ?? null,
      status: "READY",
    });

    await writeAudit(ctx.organizationId, {
      actorType: "USER",
      actorId: ctx.user.id,
      action: "content.created",
      resourceType: "content",
      resourceId: item.id,
      metadata: { type: item.type, title: item.title },
    });

    return ok(item, undefined, 201);
  } catch (err) {
    return fail(err);
  }
}
